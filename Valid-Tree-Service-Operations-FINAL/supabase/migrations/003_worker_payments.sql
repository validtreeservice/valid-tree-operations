-- Worker roster and payment ledger. Run after migrations 001 and 002.
-- Never store a full SSN or ITIN here. Retain signed W-9/I-9 records separately.

create table if not exists public.workers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  phone text not null default '',
  classification text not null default 'unreviewed'
    check (classification in ('unreviewed','employee','independent_contractor')),
  default_rate numeric(12,2) not null default 0 check (default_rate >= 0),
  rate_type text not null default 'day'
    check (rate_type in ('hour','day','job','flat')),
  tax_form_type text not null default 'none'
    check (tax_form_type in ('none','w9','w4')),
  tax_form_on_file boolean not null default false,
  tax_id_last4 text check (tax_id_last4 is null or tax_id_last4 ~ '^[0-9]{4}$'),
  work_authorization_reviewed boolean not null default false,
  active boolean not null default true,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.worker_payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  worker_id uuid not null references public.workers(id) on delete restrict,
  job_id uuid references public.jobs(id) on delete set null,
  expense_id uuid references public.expenses(id) on delete set null,
  work_date date not null default current_date,
  payment_date date not null default current_date,
  units numeric(10,2) not null default 1 check (units > 0),
  rate numeric(12,2) not null default 0 check (rate >= 0),
  amount numeric(14,2) not null check (amount > 0),
  payment_method text not null default 'business account',
  payment_reference text not null default '',
  work_description text not null,
  receipt_acknowledged boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workers enable row level security;
alter table public.worker_payments enable row level security;

drop policy if exists workers_owner_all on public.workers;
create policy workers_owner_all on public.workers for all to authenticated
using (owner_id = public.current_owner_id())
with check (owner_id = public.current_owner_id());

drop policy if exists worker_payments_owner_all on public.worker_payments;
create policy worker_payments_owner_all on public.worker_payments for all to authenticated
using (owner_id = public.current_owner_id())
with check (owner_id = public.current_owner_id());

create index if not exists idx_worker_payments_worker_date
  on public.worker_payments(worker_id, payment_date desc);
create index if not exists idx_worker_payments_job
  on public.worker_payments(job_id);

drop trigger if exists touch_updated_at on public.workers;
create trigger touch_updated_at before update on public.workers
for each row execute function public.touch_updated_at();

drop trigger if exists touch_updated_at on public.worker_payments;
create trigger touch_updated_at before update on public.worker_payments
for each row execute function public.touch_updated_at();

