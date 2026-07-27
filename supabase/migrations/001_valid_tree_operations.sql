-- Valid Tree Service Operations Platform — production schema
-- Designed for a NEW Supabase project. Safe to re-run during initial setup.

begin;
create extension if not exists pgcrypto;

do $$ begin
  create type public.staff_role as enum ('owner','office','foreman','crew');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade,
  full_name text not null default '',
  role public.staff_role not null default 'crew',
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  legal_name text not null default 'Valid Tree Service LLC',
  display_name text not null default 'Valid Tree Service',
  phone text,
  email text,
  website text default 'validtreeservice.com',
  address text default 'Houston, Texas',
  tagline text default 'Safe. Skilled. Reliable.',
  deposit_percent numeric(5,2) not null default 30,
  payment_terms text,
  review_url text,
  updated_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  service_address text,
  billing_address text,
  notes text,
  preferred_contact text default 'text',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.estimates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  number text not null,
  title text not null,
  scope text,
  amount numeric(12,2) not null default 0,
  status text not null default 'draft',
  expires_at date,
  sent_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, number)
);

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  estimate_id uuid references public.estimates(id) on delete set null,
  contract_number text not null,
  title text not null,
  scope_of_work text not null,
  terms text,
  total_price numeric(12,2) not null default 0,
  deposit numeric(12,2) not null default 0,
  status text not null default 'draft',
  service_date date,
  sign_token uuid not null default gen_random_uuid() unique,
  sent_at timestamptz,
  signed_at timestamptz,
  signature_name text,
  signer_email text,
  signature_data text,
  acceptance_ip inet,
  acceptance_user_agent text,
  consent_text text,
  document_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, contract_number)
);

create table if not exists public.crews (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  foreman text,
  foreman_id uuid references public.profiles(id) on delete set null,
  phone text,
  color text default '#5c8f70',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  contract_id uuid references public.contracts(id) on delete set null,
  crew_id uuid references public.crews(id) on delete set null,
  number text not null,
  title text not null,
  date date,
  start_time time,
  end_time time,
  status text not null default 'scheduled',
  address text,
  foreman_notes text,
  equipment text,
  completion_notes text,
  customer_confirmed boolean not null default false,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, number)
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  number text not null,
  amount numeric(12,2) not null default 0,
  paid numeric(12,2) not null default 0,
  status text not null default 'open',
  due_date date,
  notes text,
  payment_link text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, number)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  job_id uuid references public.jobs(id) on delete cascade,
  assigned_to uuid references public.profiles(id) on delete set null,
  assigned_label text,
  title text not null,
  type text,
  due_date date,
  priority text not null default 'normal',
  done boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_photos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  storage_path text not null,
  category text not null default 'progress',
  caption text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  owner_id uuid,
  actor_id uuid,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.my_owner_id()
returns uuid language sql stable security definer set search_path=public
as $$ select coalesce((select owner_id from public.profiles where id=auth.uid()), auth.uid()) $$;

create or replace function public.my_role()
returns public.staff_role language sql stable security definer set search_path=public
as $$ select role from public.profiles where id=auth.uid() and active=true $$;

create or replace function public.current_owner_id() returns uuid language sql stable security definer set search_path=public as $$ select public.my_owner_id() $$;
grant execute on function public.current_owner_id() to authenticated;

create or replace function public.bootstrap_owner(p_full_name text default 'Owner')
returns public.profiles language plpgsql security definer set search_path=public
as $$
declare result public.profiles;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if exists(select 1 from public.profiles) then raise exception 'Owner bootstrap has already been completed'; end if;
  insert into public.profiles(id, owner_id, full_name, role)
  values(auth.uid(), auth.uid(), coalesce(nullif(trim(p_full_name),''),'Owner'), 'owner')
  returning * into result;
  insert into public.company_settings(owner_id, phone, email, payment_terms)
  values(auth.uid(), '(713) 555-0128', auth.jwt()->>'email', 'Balance is due upon completion unless otherwise stated in writing.')
  on conflict(owner_id) do nothing;
  return result;
end $$;

grant execute on function public.bootstrap_owner(text) to authenticated;

-- Public signing functions expose only the one contract matching the supplied token.
create or replace function public.get_contract_for_signing(p_token uuid)
returns jsonb language sql stable security definer set search_path=public
as $$
select jsonb_build_object(
  'id', c.id, 'contract_number', c.contract_number, 'title', c.title,
  'scope_of_work', c.scope_of_work, 'terms', c.terms,
  'total_price', c.total_price, 'deposit', c.deposit, 'status', c.status,
  'service_date', c.service_date, 'signed_at', c.signed_at,
  'customer', jsonb_build_object('full_name',cu.full_name,'email',cu.email,'service_address',cu.service_address),
  'company', jsonb_build_object('legal_name',s.legal_name,'display_name',s.display_name,'phone',s.phone,'email',s.email,'tagline',s.tagline,'payment_terms',s.payment_terms)
)
from public.contracts c
left join public.customers cu on cu.id=c.customer_id
left join public.company_settings s on s.owner_id=c.owner_id
where c.sign_token=p_token and c.status in ('draft','sent','signed')
limit 1
$$;

grant execute on function public.get_contract_for_signing(uuid) to anon, authenticated;

create or replace function public.submit_contract_signature(
  p_token uuid, p_name text, p_email text, p_signature_data text,
  p_user_agent text, p_consent_text text
) returns jsonb language plpgsql security definer set search_path=public
as $$
declare c public.contracts;
begin
  select * into c from public.contracts where sign_token=p_token for update;
  if c.id is null then raise exception 'Agreement not found'; end if;
  if c.signed_at is not null then return jsonb_build_object('ok',true,'already_signed',true,'contract_number',c.contract_number); end if;
  if c.status not in ('draft','sent') then raise exception 'Agreement is not available for signature'; end if;
  if length(trim(coalesce(p_name,''))) < 2 then raise exception 'Printed name is required'; end if;
  if length(coalesce(p_signature_data,'')) < 100 then raise exception 'Signature is required'; end if;
  update public.contracts set status='signed', signed_at=now(), signature_name=trim(p_name),
    signer_email=nullif(trim(p_email),''), signature_data=p_signature_data,
    acceptance_user_agent=p_user_agent, consent_text=p_consent_text, updated_at=now()
  where id=c.id;
  insert into public.audit_log(owner_id, actor_id, action, entity_type, entity_id, metadata)
  values(c.owner_id, null, 'contract_signed', 'contract', c.id,
    jsonb_build_object('signature_name',trim(p_name),'signer_email',nullif(trim(p_email),'')));
  return jsonb_build_object('ok',true,'contract_number',c.contract_number,'signed_at',now());
end $$;

grant execute on function public.submit_contract_signature(uuid,text,text,text,text,text) to anon, authenticated;

-- Updated-at trigger
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
do $$ declare t text; begin
  foreach t in array array['profiles','company_settings','customers','estimates','contracts','crews','jobs','invoices','tasks'] loop
    execute format('drop trigger if exists touch_updated_at on public.%I',t);
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()',t);
  end loop;
end $$;

-- Row-level security
alter table public.profiles enable row level security;
alter table public.company_settings enable row level security;
alter table public.customers enable row level security;
alter table public.estimates enable row level security;
alter table public.contracts enable row level security;
alter table public.crews enable row level security;
alter table public.jobs enable row level security;
alter table public.invoices enable row level security;
alter table public.tasks enable row level security;
alter table public.job_photos enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists "profiles read company" on public.profiles;
create policy "profiles read company" on public.profiles for select to authenticated using(owner_id=public.my_owner_id() or id=auth.uid());
drop policy if exists "owner manages profiles" on public.profiles;
create policy "owner manages profiles" on public.profiles for all to authenticated using(public.my_role()='owner') with check(public.my_role()='owner' and owner_id=public.my_owner_id());

drop policy if exists "company settings read" on public.company_settings;
create policy "company settings read" on public.company_settings for select to authenticated using(owner_id=public.my_owner_id());
drop policy if exists "company settings write" on public.company_settings;
create policy "company settings write" on public.company_settings for all to authenticated using(public.my_role() in ('owner','office') and owner_id=public.my_owner_id()) with check(public.my_role() in ('owner','office') and owner_id=public.my_owner_id());

do $$ declare t text; begin
  foreach t in array array['customers','estimates','contracts','crews','invoices','tasks'] loop
    execute format('drop policy if exists "company read" on public.%I',t);
    execute format('drop policy if exists "office manage" on public.%I',t);
    execute format('create policy "company read" on public.%I for select to authenticated using(owner_id=public.my_owner_id())',t);
    execute format('create policy "office manage" on public.%I for all to authenticated using(owner_id=public.my_owner_id() and public.my_role() in (''owner'',''office'')) with check(owner_id=public.my_owner_id() and public.my_role() in (''owner'',''office''))',t);
  end loop;
end $$;

drop policy if exists "jobs read company" on public.jobs;
create policy "jobs read company" on public.jobs for select to authenticated using(owner_id=public.my_owner_id());
drop policy if exists "jobs manage" on public.jobs;
create policy "jobs manage" on public.jobs for all to authenticated using(owner_id=public.my_owner_id() and public.my_role() in ('owner','office','foreman')) with check(owner_id=public.my_owner_id() and public.my_role() in ('owner','office','foreman'));

drop policy if exists "photos read company" on public.job_photos;
create policy "photos read company" on public.job_photos for select to authenticated using(owner_id=public.my_owner_id());
drop policy if exists "photos add field" on public.job_photos;
create policy "photos add field" on public.job_photos for insert to authenticated with check(owner_id=public.my_owner_id() and public.my_role() in ('owner','office','foreman','crew'));
drop policy if exists "photos manage office" on public.job_photos;
create policy "photos manage office" on public.job_photos for update to authenticated using(owner_id=public.my_owner_id() and public.my_role() in ('owner','office','foreman')) with check(owner_id=public.my_owner_id());

drop policy if exists "audit owner read" on public.audit_log;
create policy "audit owner read" on public.audit_log for select to authenticated using(owner_id=public.my_owner_id() and public.my_role()='owner');

-- Storage buckets and policies
insert into storage.buckets(id,name,public) values
 ('job-photos','job-photos',false),('signed-documents','signed-documents',false)
on conflict(id) do nothing;

drop policy if exists "job photo authenticated read" on storage.objects;
create policy "job photo authenticated read" on storage.objects for select to authenticated using(bucket_id='job-photos');
drop policy if exists "job photo authenticated upload" on storage.objects;
create policy "job photo authenticated upload" on storage.objects for insert to authenticated with check(bucket_id='job-photos');
drop policy if exists "job photo authenticated update" on storage.objects;
create policy "job photo authenticated update" on storage.objects for update to authenticated using(bucket_id='job-photos');

create index if not exists customers_owner_idx on public.customers(owner_id);
create index if not exists contracts_owner_status_idx on public.contracts(owner_id,status);
create index if not exists jobs_owner_date_idx on public.jobs(owner_id,date);
create index if not exists tasks_owner_due_idx on public.tasks(owner_id,due_date,done);
create index if not exists invoices_owner_status_idx on public.invoices(owner_id,status);

commit;
