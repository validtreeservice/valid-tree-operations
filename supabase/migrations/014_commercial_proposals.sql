-- Additive commercial proposal system. Does not change estimates or contracts.
begin;

create table if not exists public.commercial_proposal_counters (
  owner_id uuid not null references auth.users(id) on delete cascade,
  year integer not null, last_value integer not null default 0, primary key(owner_id,year)
);
create table if not exists public.commercial_proposals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  number text not null, project_name text not null, project_address text not null default '',
  contact_name text not null default '', company_name text not null default '',
  proposal_type text not null, proposal_date date not null, expires_at date not null,
  amount numeric(12,2) not null default 0 check(amount >= 0),
  status text not null default 'draft' check(status in ('draft','sent','viewed','accepted','declined','expired')),
  content jsonb not null default '{}'::jsonb,
  internal_notes text not null default '',
  revision integer not null default 1,
  share_token uuid unique, published_snapshot jsonb,
  sent_at timestamptz, viewed_at timestamptz, accepted_at timestamptz,
  acceptance jsonb, declined_at timestamptz, decline_reason text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(owner_id,number), check(expires_at >= proposal_date)
);
create table if not exists public.proposal_clauses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check(length(title) between 1 and 200),
  body text not null check(length(body) between 1 and 16000),
  updated_at timestamptz not null default now()
);
alter table public.jobs add column if not exists proposal_id uuid references public.commercial_proposals(id) on delete restrict;
alter table public.jobs add column if not exists proposal_amount numeric(12,2);
alter table public.jobs add column if not exists proposal_snapshot jsonb;
create unique index if not exists jobs_one_per_proposal on public.jobs(proposal_id) where proposal_id is not null;
create index if not exists commercial_proposals_owner_created on public.commercial_proposals(owner_id,created_at desc);
alter table public.commercial_proposals enable row level security;
alter table public.commercial_proposal_counters enable row level security;
alter table public.proposal_clauses enable row level security;
revoke all on public.commercial_proposals,public.commercial_proposal_counters,public.proposal_clauses from anon,authenticated;
grant select on public.commercial_proposals,public.proposal_clauses to authenticated;
grant insert,update,delete on public.proposal_clauses to authenticated;
drop policy if exists proposal_office_read on public.commercial_proposals;
create policy proposal_office_read on public.commercial_proposals for select to authenticated
  using(owner_id=public.current_owner_id() and public.my_role() in ('owner','office'));
drop policy if exists clause_office_manage on public.proposal_clauses;
create policy clause_office_manage on public.proposal_clauses for all to authenticated
  using(owner_id=public.current_owner_id() and public.my_role() in ('owner','office'))
  with check(owner_id=public.current_owner_id() and public.my_role() in ('owner','office'));
drop trigger if exists touch_updated_at on public.commercial_proposals;
create trigger touch_updated_at before update on public.commercial_proposals for each row execute function public.touch_updated_at();
drop trigger if exists touch_updated_at on public.proposal_clauses;
create trigger touch_updated_at before update on public.proposal_clauses for each row execute function public.touch_updated_at();

create or replace function public.proposal_require_office()
returns uuid language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or coalesce(public.my_role()::text,'') not in ('owner','office') then
    raise exception 'Only active owner or office staff can manage proposals.';
  end if;
  return public.current_owner_id();
end $$;

-- Normalize nested customer content; reject invalid prices and oversized images server-side.
-- Small optimized site photos are embedded in the versioned document so links never expire.
create or replace function public.proposal_clean_content(c jsonb)
returns jsonb language plpgsql set search_path=public as $$
declare result jsonb; a jsonb; item jsonb; key text;
begin
  if c is null or jsonb_typeof(c) <> 'object' or octet_length(c::text)>6000000 then raise exception 'Proposal content is invalid or exceeds 6 MB.'; end if;
  result := '{}'::jsonb;
  foreach key in array array['phone','email','description','duration','estimated_start','mobilization','payment_terms','milestones','special_conditions'] loop
    if length(coalesce(c->>key,''))>16000 then raise exception 'A proposal field is too long.'; end if;
    result := result || jsonb_build_object(key,coalesce(c->>key,''));
  end loop;
  if coalesce(c->>'pricing_mode','') not in ('lump_sum','itemized') then raise exception 'Choose lump sum or itemized pricing.'; end if;
  if coalesce(nullif(c->>'lump_sum',''),'0') !~ '^[0-9]{1,9}(\.[0-9]{1,2})?$' then raise exception 'Invalid lump sum price.'; end if;
  result := result || jsonb_build_object('pricing_mode',c->>'pricing_mode','lump_sum',coalesce(c->>'lump_sum',''));
  if jsonb_typeof(c->'sections') is distinct from 'array' or jsonb_array_length(c->'sections')>60 then raise exception 'Use at most 60 scope sections.'; end if;
  a := '[]'::jsonb;
  for item in select value from jsonb_array_elements(c->'sections') loop
    if length(coalesce(item->>'title',''))>200 or length(coalesce(item->>'body',''))>16000 then raise exception 'Scope section is too long.'; end if;
    a := a || jsonb_build_array(jsonb_build_object('id',left(coalesce(item->>'id',''),80),'title',coalesce(item->>'title',''),'body',coalesce(item->>'body','')));
  end loop;
  result := result || jsonb_build_object('sections',a);
  if jsonb_typeof(c->'lines') is distinct from 'array' or jsonb_array_length(c->'lines')>100 then raise exception 'Use at most 100 price lines.'; end if;
  a := '[]'::jsonb;
  for item in select value from jsonb_array_elements(c->'lines') loop
    if length(coalesce(item->>'label',''))>300 or coalesce(nullif(item->>'amount',''),'0') !~ '^[0-9]{1,9}(\.[0-9]{1,2})?$' then raise exception 'Invalid price line.'; end if;
    a := a || jsonb_build_array(jsonb_build_object('id',left(coalesce(item->>'id',''),80),'label',coalesce(item->>'label',''),'amount',coalesce(item->>'amount',''),'included',coalesce((item->>'included')::boolean,false)));
  end loop;
  result := result || jsonb_build_object('lines',a);
  if jsonb_typeof(c->'photos') is distinct from 'array' or jsonb_array_length(c->'photos')>16 then raise exception 'Use at most 16 site photos per proposal.'; end if;
  a := '[]'::jsonb;
  for item in select value from jsonb_array_elements(c->'photos') loop
    if length(coalesce(item->>'data','')) not between 100 and 350000
       or coalesce(item->>'data','') !~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$'
       or length(coalesce(item->>'caption',''))>1000 then raise exception 'Photo is invalid or too large. Upload an optimized image.'; end if;
    a := a || jsonb_build_array(jsonb_build_object('id',left(coalesce(item->>'id',''),80),'data',item->>'data','caption',coalesce(item->>'caption','')));
  end loop;
  return result || jsonb_build_object('photos',a);
end $$;

create or replace function public.proposal_price(c jsonb)
returns numeric language sql immutable set search_path=public as $$
  select case when c->>'pricing_mode'='itemized' then
    coalesce((select sum(case when (value->>'included')::boolean then 0 else coalesce(nullif(value->>'amount',''),'0')::numeric end) from jsonb_array_elements(c->'lines')),0)
    else coalesce(nullif(c->>'lump_sum',''),'0')::numeric end
$$;

create or replace function public.save_commercial_proposal(p_id uuid,p_revision integer,p_data jsonb)
returns public.commercial_proposals language plpgsql security definer set search_path=public as $$
declare o uuid; r public.commercial_proposals; c jsonb; n integer; y integer; customer uuid;
begin
  o := public.proposal_require_office();
  if p_id is null then raise exception 'Proposal ID required.'; end if;
  -- Serialize saves of the same new draft; a retry cannot create another proposal.
  perform pg_advisory_xact_lock(hashtext(p_id::text));
  select * into r from public.commercial_proposals where id=p_id for update;
  if r.id is not null and (r.owner_id<>o or r.revision is distinct from p_revision or r.status<>'draft') then
    raise exception 'This proposal changed or is not a draft. Reopen it before editing.';
  end if;
  if r.id is null and p_revision is distinct from 0 then raise exception 'Proposal no longer exists.'; end if;
  if length(trim(coalesce(p_data->>'project_name',''))) not between 1 and 300 then raise exception 'Enter a project name (300 characters maximum).'; end if;
  if p_data->>'proposal_date' is null or p_data->>'expires_at' is null then raise exception 'Proposal and expiration dates are required.'; end if;
  if (p_data->>'expires_at')::date < (p_data->>'proposal_date')::date then raise exception 'Expiration must be on or after the proposal date.'; end if;
  if length(coalesce(p_data->>'internal_notes',''))>20000 or length(coalesce(p_data->>'project_address',''))>1000 or length(coalesce(p_data->>'contact_name',''))>300 or length(coalesce(p_data->>'company_name',''))>300 then raise exception 'Project information is too long.'; end if;
  if coalesce(p_data->>'proposal_type','') not in ('Commercial Land Clearing','Commercial Tree Removal','Demolition & Site Clearing','Storm/Emergency Work','Large Residential Project','Custom/Blank Proposal') then raise exception 'Invalid proposal type.'; end if;
  customer := nullif(p_data->>'customer_id','')::uuid;
  if customer is not null and not exists(select 1 from public.customers where id=customer and owner_id=o) then raise exception 'Customer is not in your workspace.'; end if;
  c := public.proposal_clean_content(p_data->'content');
  if r.id is null then
    y := extract(year from (now() at time zone 'America/Chicago'))::integer;
    insert into public.commercial_proposal_counters(owner_id,year,last_value) values(o,y,1)
      on conflict(owner_id,year) do update set last_value=commercial_proposal_counters.last_value+1 returning last_value into n;
    insert into public.commercial_proposals(id,owner_id,number,project_name,proposal_type,proposal_date,expires_at)
      values(p_id,o,'PROP-'||y||'-'||lpad(n::text,greatest(4,length(n::text)),'0'),trim(p_data->>'project_name'),p_data->>'proposal_type',(p_data->>'proposal_date')::date,(p_data->>'expires_at')::date);
  end if;
  update public.commercial_proposals set
    customer_id=customer,project_name=trim(p_data->>'project_name'),project_address=coalesce(p_data->>'project_address',''),
    contact_name=coalesce(p_data->>'contact_name',''),company_name=coalesce(p_data->>'company_name',''),
    proposal_type=p_data->>'proposal_type',proposal_date=(p_data->>'proposal_date')::date,expires_at=(p_data->>'expires_at')::date,
    content=c,amount=public.proposal_price(c),internal_notes=coalesce(p_data->>'internal_notes',''),revision=p_revision+1
    where id=p_id returning * into r;
  return r;
end $$;

-- Snapshot is a strict allowlist, never to_jsonb(row) minus a few secrets.
create or replace function public.proposal_customer_snapshot(r public.commercial_proposals)
returns jsonb language sql stable set search_path=public as $$
select jsonb_build_object('number',r.number,'project_name',r.project_name,'project_address',r.project_address,
  'contact_name',r.contact_name,'company_name',r.company_name,'proposal_type',r.proposal_type,
  'proposal_date',r.proposal_date,'expires_at',r.expires_at,'amount',r.amount,
  'company',jsonb_build_object('legalName',coalesce(s.legal_name,'Valid Tree Service LLC'),'phone',s.phone,'email',s.email,'website',s.website,'address',s.address),
  'content',jsonb_build_object(
    'phone',r.content->>'phone','email',r.content->>'email','description',r.content->>'description',
    'sections',(select coalesce(jsonb_agg(jsonb_build_object('title',value->>'title','body',value->>'body')),'[]') from jsonb_array_elements(r.content->'sections')),
    'pricing_mode',r.content->>'pricing_mode',
    'lines',case when r.content->>'pricing_mode'='itemized' then
      (select coalesce(jsonb_agg(jsonb_build_object('label',value->>'label','amount',value->>'amount','included',value->'included')),'[]') from jsonb_array_elements(r.content->'lines')) else '[]'::jsonb end,
    'duration',r.content->>'duration','estimated_start',r.content->>'estimated_start','mobilization',r.content->>'mobilization',
    'payment_terms',r.content->>'payment_terms','milestones',r.content->>'milestones','special_conditions',r.content->>'special_conditions',
    'photos',(select coalesce(jsonb_agg(jsonb_build_object('data',value->>'data','caption',value->>'caption')),'[]') from jsonb_array_elements(r.content->'photos'))
  )) from (select 1) base left join public.company_settings s on s.owner_id=r.owner_id
$$;

create or replace function public.publish_commercial_proposal(p_id uuid,p_revision integer)
returns public.commercial_proposals language plpgsql security definer set search_path=public as $$
declare o uuid; r public.commercial_proposals;
begin
  o := public.proposal_require_office();
  select * into r from public.commercial_proposals where id=p_id and owner_id=o for update;
  if r.id is null or r.revision is distinct from p_revision then raise exception 'Proposal changed. Reopen it and try again.'; end if;
  if r.status<>'draft' then raise exception 'Only drafts can be issued.'; end if;
  if r.expires_at < (now() at time zone 'America/Chicago')::date then raise exception 'Update the expiration date.'; end if;
  if length(trim(r.project_address))=0 or length(trim(r.contact_name))=0 or r.amount<=0 or length(trim(r.content->>'payment_terms'))=0
    or jsonb_array_length(r.content->'sections')=0
    or exists(select 1 from jsonb_array_elements(r.content->'sections') where length(trim(value->>'title'))=0 or length(trim(value->>'body'))=0)
    or (r.content->>'pricing_mode'='itemized' and exists(select 1 from jsonb_array_elements(r.content->'lines') where length(trim(value->>'label'))=0 or (not (value->>'included')::boolean and value->>'amount'='')))
    then raise exception 'Complete contact, address, scope, pricing and payment terms before sending.'; end if;
  update public.commercial_proposals set status='sent',share_token=gen_random_uuid(),
    published_snapshot=public.proposal_customer_snapshot(r),sent_at=now(),revision=revision+1
    where id=p_id returning * into r;
  insert into public.audit_log(owner_id,actor_id,action,entity_type,entity_id,metadata)
    values(o,auth.uid(),'proposal_issued','commercial_proposal',p_id,jsonb_build_object('number',r.number,'revision',r.revision));
  return r;
end $$;

create or replace function public.reopen_commercial_proposal(p_id uuid,p_revision integer)
returns public.commercial_proposals language plpgsql security definer set search_path=public as $$
declare o uuid; r public.commercial_proposals;
begin
  o := public.proposal_require_office();
  select * into r from public.commercial_proposals where id=p_id and owner_id=o for update;
  if r.id is null or r.revision is distinct from p_revision or r.status='accepted' then raise exception 'Accepted or changed proposals cannot be reopened. Duplicate an accepted proposal instead.'; end if;
  insert into public.audit_log(owner_id,actor_id,action,entity_type,entity_id,metadata)
    values(o,auth.uid(),'proposal_link_revoked','commercial_proposal',p_id,jsonb_build_object('number',r.number,'revision',r.revision,'previous_status',r.status,'document',r.published_snapshot));
  update public.commercial_proposals set status='draft',share_token=null,published_snapshot=null,sent_at=null,viewed_at=null,
    declined_at=null,decline_reason=null,revision=revision+1 where id=p_id returning * into r;
  return r;
end $$;

create or replace function public.get_commercial_proposal(p_token uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.commercial_proposals;
begin
  select * into r from public.commercial_proposals where share_token=p_token and status<>'draft' for update;
  if r.id is null then raise exception 'This proposal link is unavailable. Ask Valid Tree Service for the current link.'; end if;
  if r.status in ('sent','viewed') and r.expires_at < (now() at time zone 'America/Chicago')::date then
    update public.commercial_proposals set status='expired' where id=r.id returning * into r;
  elsif r.status='sent' then
    update public.commercial_proposals set status='viewed',viewed_at=coalesce(viewed_at,now()) where id=r.id returning * into r;
  end if;
  return jsonb_build_object('document',r.published_snapshot,'status',r.status,'revision',r.revision,'acceptance',r.acceptance);
end $$;

create or replace function public.respond_commercial_proposal(
  p_token uuid,p_revision integer,p_action text,p_name text,p_company text,p_signature text,p_consent boolean,p_reason text default ''
) returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.commercial_proposals; consent constant text := 'I am authorized to accept this proposal for the customer/company named below. I have reviewed the scope, exclusions, price, schedule and payment terms, and agree to use my typed signature as my electronic signature.';
begin
  select * into r from public.commercial_proposals where share_token=p_token for update;
  if r.id is null or r.revision is distinct from p_revision then raise exception 'The proposal changed or this link was withdrawn. Request the current proposal.'; end if;
  if r.status not in ('sent','viewed') then raise exception 'This proposal is no longer awaiting a response.'; end if;
  if r.expires_at < (now() at time zone 'America/Chicago')::date then raise exception 'This proposal has expired. Contact Valid Tree Service for an updated proposal.'; end if;
  if p_action='accept' then
    if not coalesce(p_consent,false) or length(trim(coalesce(p_name,''))) not between 2 and 200
      or length(trim(coalesce(p_signature,''))) not between 2 and 200 or length(trim(coalesce(p_company,''))) not between 1 and 300
      then raise exception 'Enter the authorized representative, company, typed signature and acceptance consent.'; end if;
    update public.commercial_proposals set status='accepted',accepted_at=now(),
      acceptance=jsonb_build_object('name',trim(p_name),'company',trim(p_company),'signature',trim(p_signature),
        'signed_at',now(),'consent',consent,'revision',r.revision,
        'document_hash',encode(sha256(convert_to(r.published_snapshot::text,'UTF8')),'hex'))
      where id=r.id;
  elsif p_action='decline' then
    update public.commercial_proposals set status='declined',declined_at=now(),decline_reason=left(coalesce(p_reason,''),1500) where id=r.id;
  else raise exception 'Invalid response.'; end if;
  insert into public.audit_log(owner_id,actor_id,action,entity_type,entity_id,metadata)
    values(r.owner_id,null,'proposal_'||p_action,'commercial_proposal',r.id,jsonb_build_object('number',r.number,'revision',r.revision));
  return public.get_commercial_proposal(p_token);
end $$;

create or replace function public.convert_commercial_proposal(p_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare o uuid; r public.commercial_proposals; j uuid; cu uuid; n integer; y integer; brief text; item jsonb;
begin
  o := public.proposal_require_office();
  select * into r from public.commercial_proposals where id=p_id and owner_id=o for update;
  if r.id is null or r.status<>'accepted' then raise exception 'Only an accepted proposal can become a job.'; end if;
  select id into j from public.jobs where proposal_id=r.id and owner_id=o;
  if j is not null then return j; end if;
  cu := r.customer_id;
  if cu is null then
    insert into public.customers(owner_id,full_name,phone,email,service_address,notes)
      values(o,r.contact_name,r.content->>'phone',r.content->>'email',r.project_address,'Company: '||r.company_name)
      returning id into cu;
    update public.commercial_proposals set customer_id=cu where id=r.id;
  elsif not exists(select 1 from public.customers where id=cu and owner_id=o) then raise exception 'Customer is not in your workspace.'; end if;
  brief := r.number||' - '||r.project_name;
  for item in select value from jsonb_array_elements(r.content->'sections') loop
    brief := brief||E'\n\n'||(item->>'title')||E'\n'||(item->>'body');
  end loop;
  brief := brief||E'\n\nPayment terms\n'||(r.content->>'payment_terms')||E'\n\nMilestones\n'||(r.content->>'milestones')||E'\n\nInternal office notes\n'||r.internal_notes;
  perform pg_advisory_xact_lock(hashtext(o::text||':jobs'));
  y := extract(year from (now() at time zone 'America/Chicago'))::integer;
  select greatest(coalesce(max(substring(number from '^JOB-[0-9]{4}-([0-9]+)$')::integer),89),89)+1 into n from public.jobs where owner_id=o;
  loop
    begin
      insert into public.jobs(owner_id,customer_id,number,title,status,address,foreman_notes,proposal_id,proposal_amount,proposal_snapshot)
        values(o,cu,'JOB-'||y||'-'||lpad(n::text,greatest(4,length(n::text)),'0'),r.project_name,'unscheduled',r.project_address,brief,r.id,r.amount,
          r.published_snapshot||jsonb_build_object('acceptance',r.acceptance)) returning id into j;
      exit;
    exception when unique_violation then n:=n+1;
    end;
  end loop;
  insert into public.audit_log(owner_id,actor_id,action,entity_type,entity_id,metadata)
    values(o,auth.uid(),'proposal_converted','commercial_proposal',r.id,jsonb_build_object('job_id',j));
  return j;
end $$;

revoke all on function public.proposal_require_office(),public.proposal_clean_content(jsonb),public.proposal_price(jsonb),public.proposal_customer_snapshot(public.commercial_proposals) from public,anon,authenticated;
revoke all on function public.save_commercial_proposal(uuid,integer,jsonb),public.publish_commercial_proposal(uuid,integer),public.reopen_commercial_proposal(uuid,integer),public.convert_commercial_proposal(uuid) from public,anon,authenticated;
grant execute on function public.save_commercial_proposal(uuid,integer,jsonb),public.publish_commercial_proposal(uuid,integer),public.reopen_commercial_proposal(uuid,integer),public.convert_commercial_proposal(uuid) to authenticated;
revoke all on function public.get_commercial_proposal(uuid),public.respond_commercial_proposal(uuid,integer,text,text,text,text,boolean,text) from public,anon,authenticated;
grant execute on function public.get_commercial_proposal(uuid),public.respond_commercial_proposal(uuid,integer,text,text,text,text,boolean,text) to anon,authenticated;
commit;
