-- Valid Tree Service Operations Center v2
-- Adds job costing, field reporting, fleet, change orders, and payments.

create extension if not exists pgcrypto;

alter table public.jobs
  add column if not exists completion_percent numeric(5,2) not null default 0 check (completion_percent between 0 and 100),
  add column if not exists acres numeric(10,2) check (acres is null or acres >= 0),
  add column if not exists project_type text,
  add column if not exists estimated_days numeric(10,2) check (estimated_days is null or estimated_days >= 0),
  add column if not exists actual_start_date date,
  add column if not exists actual_end_date date;

create table if not exists public.job_budgets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  category text not null check (category in ('labor','fuel','equipment','rental','maintenance','subcontractor','materials','disposal','permit','travel','insurance','other')),
  description text not null default '',
  estimated_amount numeric(14,2) not null default 0 check (estimated_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  category text not null check (category in ('labor','fuel','equipment','rental','maintenance','subcontractor','materials','disposal','permit','travel','insurance','other')),
  vendor text not null default '',
  description text not null,
  amount numeric(14,2) not null check (amount >= 0),
  expense_date date not null default current_date,
  payment_method text not null default 'business account',
  receipt_path text,
  receipt_url text,
  billable boolean not null default false,
  reimbursed boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  crew_id uuid references public.crews(id) on delete set null,
  worker_name text not null,
  worker_type text not null default 'contractor' check (worker_type in ('employee','contractor','owner')),
  work_date date not null default current_date,
  regular_hours numeric(8,2) not null default 0 check (regular_hours >= 0),
  overtime_hours numeric(8,2) not null default 0 check (overtime_hours >= 0),
  hourly_rate numeric(12,2) not null default 0 check (hourly_rate >= 0),
  overtime_multiplier numeric(5,2) not null default 1.5 check (overtime_multiplier >= 1),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  crew_id uuid references public.crews(id) on delete set null,
  report_date date not null default current_date,
  weather text not null default '',
  crew_size integer not null default 0 check (crew_size >= 0),
  hours_worked numeric(8,2) not null default 0 check (hours_worked >= 0),
  work_completed text not null,
  delays text not null default '',
  safety_incidents text not null default '',
  next_steps text not null default '',
  completion_percent numeric(5,2) check (completion_percent is null or completion_percent between 0 and 100),
  submitted_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(job_id, report_date)
);

create table if not exists public.production_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  report_date date not null default current_date,
  activity text not null,
  quantity numeric(14,2) not null default 0 check (quantity >= 0),
  unit text not null default 'units',
  equipment_hours numeric(10,2) not null default 0 check (equipment_hours >= 0),
  downtime_hours numeric(10,2) not null default 0 check (downtime_hours >= 0),
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null,
  make text not null default '',
  model text not null default '',
  year integer check (year is null or year between 1900 and 2200),
  serial_number text not null default '',
  ownership text not null default 'owned' check (ownership in ('owned','financed','leased','customer','rented')),
  status text not null default 'available' check (status in ('available','assigned','maintenance','out_of_service','retired')),
  current_hours numeric(12,1) not null default 0 check (current_hours >= 0),
  hourly_cost numeric(12,2) not null default 0 check (hourly_cost >= 0),
  payment_amount numeric(12,2) not null default 0 check (payment_amount >= 0),
  payment_frequency text not null default 'monthly',
  next_service_hours numeric(12,1),
  next_service_date date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.equipment_assignments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  assigned_date date not null default current_date,
  returned_date date,
  start_hours numeric(12,1),
  end_hours numeric(12,1),
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.fuel_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  equipment_id uuid references public.equipment(id) on delete set null,
  fuel_date date not null default current_date,
  fuel_type text not null default 'diesel',
  gallons numeric(12,3) not null check (gallons >= 0),
  price_per_gallon numeric(10,4) not null default 0 check (price_per_gallon >= 0),
  total_cost numeric(14,2) generated always as (round(gallons * price_per_gallon, 2)) stored,
  vendor text not null default '',
  receipt_path text,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  service_date date not null default current_date,
  service_type text not null,
  description text not null,
  meter_hours numeric(12,1),
  vendor text not null default '',
  cost numeric(14,2) not null default 0 check (cost >= 0),
  next_service_date date,
  next_service_hours numeric(12,1),
  downtime_hours numeric(10,2) not null default 0 check (downtime_hours >= 0),
  receipt_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.rentals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  equipment_name text not null,
  vendor text not null default '',
  start_date date not null,
  end_date date,
  rate numeric(14,2) not null default 0 check (rate >= 0),
  rate_unit text not null default 'day' check (rate_unit in ('hour','day','week','month','flat')),
  customer_provided boolean not null default false,
  fuel_responsibility text not null default 'contractor',
  status text not null default 'reserved' check (status in ('reserved','active','returned','cancelled')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.change_orders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  contract_id uuid references public.contracts(id) on delete set null,
  number text not null,
  title text not null,
  description text not null,
  amount numeric(14,2) not null default 0,
  status text not null default 'draft' check (status in ('draft','sent','approved','rejected','void')),
  requested_by text not null default '',
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, number)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  amount numeric(14,2) not null check (amount > 0),
  payment_date date not null default current_date,
  method text not null default 'other',
  reference text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.estimator_scenarios (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  name text not null,
  project_type text not null default 'land_clearing',
  acres numeric(10,2) not null default 0 check (acres >= 0),
  density text not null default 'medium' check (density in ('light','medium','heavy','extreme')),
  timber_type text not null default 'mixed',
  average_diameter numeric(8,2) not null default 0 check (average_diameter >= 0),
  stump_removal boolean not null default false,
  finish_grade boolean not null default false,
  customer_equipment boolean not null default false,
  crew_size integer not null default 1 check (crew_size > 0),
  work_days numeric(10,2) not null default 0 check (work_days >= 0),
  direct_cost numeric(14,2) not null default 0 check (direct_cost >= 0),
  contingency_percent numeric(6,2) not null default 10 check (contingency_percent between 0 and 100),
  overhead_percent numeric(6,2) not null default 15 check (overhead_percent between 0 and 100),
  target_margin_percent numeric(6,2) not null default 30 check (target_margin_percent between 0 and 95),
  recommended_price numeric(14,2) not null default 0 check (recommended_price >= 0),
  assumptions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare
  t text;
begin
  foreach t in array array[
    'job_budgets','expenses','time_entries','daily_reports','production_logs',
    'equipment','equipment_assignments','fuel_logs','maintenance_records',
    'rentals','change_orders','payments','estimator_scenarios'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_owner_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (owner_id = public.current_owner_id()) with check (owner_id = public.current_owner_id())',
      t || '_owner_all', t
    );
  end loop;
end $$;

create index if not exists idx_job_budgets_job on public.job_budgets(job_id);
create index if not exists idx_expenses_job_date on public.expenses(job_id, expense_date desc);
create index if not exists idx_time_entries_job_date on public.time_entries(job_id, work_date desc);
create index if not exists idx_daily_reports_job_date on public.daily_reports(job_id, report_date desc);
create index if not exists idx_production_logs_job_date on public.production_logs(job_id, report_date desc);
create index if not exists idx_fuel_logs_job_date on public.fuel_logs(job_id, fuel_date desc);
create index if not exists idx_maintenance_equipment_date on public.maintenance_records(equipment_id, service_date desc);
create index if not exists idx_change_orders_job on public.change_orders(job_id);
create index if not exists idx_payments_invoice on public.payments(invoice_id);

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

drop policy if exists "receipt owners read" on storage.objects;
create policy "receipt owners read" on storage.objects for select to authenticated
using (bucket_id = 'receipts' and (storage.foldername(name))[1] = public.current_owner_id()::text);

drop policy if exists "receipt owners insert" on storage.objects;
create policy "receipt owners insert" on storage.objects for insert to authenticated
with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = public.current_owner_id()::text);

drop policy if exists "receipt owners update" on storage.objects;
create policy "receipt owners update" on storage.objects for update to authenticated
using (bucket_id = 'receipts' and (storage.foldername(name))[1] = public.current_owner_id()::text);

drop policy if exists "receipt owners delete" on storage.objects;
create policy "receipt owners delete" on storage.objects for delete to authenticated
using (bucket_id = 'receipts' and (storage.foldername(name))[1] = public.current_owner_id()::text);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'job_budgets','expenses','time_entries','daily_reports','equipment',
    'rentals','change_orders','estimator_scenarios'
  ] loop
    execute format('drop trigger if exists touch_updated_at on public.%I', t);
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

