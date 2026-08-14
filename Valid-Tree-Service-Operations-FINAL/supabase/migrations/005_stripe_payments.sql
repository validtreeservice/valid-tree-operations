-- Stripe Checkout support for signed contracts and invoices.
-- Existing invoice/payment data is preserved.

alter table public.invoices
  add column if not exists contract_id uuid references public.contracts(id) on delete set null,
  add column if not exists manual_paid numeric(12,2) not null default 0,
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists stripe_status text,
  add column if not exists stripe_fee numeric(12,2) not null default 0,
  add column if not exists stripe_net numeric(12,2) not null default 0,
  add column if not exists last_payment_at timestamptz;

update public.invoices
set manual_paid = paid
where manual_paid = 0 and paid > 0;

alter table public.payments
  add column if not exists provider text not null default 'manual',
  add column if not exists provider_payment_id text,
  add column if not exists provider_session_id text,
  add column if not exists processing_fee numeric(12,2) not null default 0,
  add column if not exists net_amount numeric(12,2) not null default 0,
  add column if not exists status text not null default 'succeeded';

create unique index if not exists payments_provider_payment_unique
  on public.payments(provider, provider_payment_id);

create index if not exists invoices_contract_id_idx on public.invoices(contract_id);
create index if not exists invoices_stripe_session_idx on public.invoices(stripe_checkout_session_id);

create table if not exists public.stripe_webhook_events (
  id text primary key,
  owner_id uuid references auth.users(id) on delete cascade,
  event_type text not null,
  processed_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;

drop policy if exists stripe_webhook_events_owner_read on public.stripe_webhook_events;
create policy stripe_webhook_events_owner_read
on public.stripe_webhook_events for select to authenticated
using (owner_id = public.current_owner_id());
