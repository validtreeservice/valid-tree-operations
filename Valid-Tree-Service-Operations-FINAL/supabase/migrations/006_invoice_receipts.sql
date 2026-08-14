-- Permanent customer receipt links and safe invoice voiding.

alter table public.invoices
  add column if not exists receipt_token uuid default gen_random_uuid(),
  add column if not exists voided_at timestamptz,
  add column if not exists void_reason text;

update public.invoices set receipt_token = gen_random_uuid() where receipt_token is null;
alter table public.invoices alter column receipt_token set not null;
create unique index if not exists invoices_receipt_token_unique on public.invoices(receipt_token);

create or replace function public.get_invoice_receipt(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
select jsonb_build_object(
  'invoice', jsonb_build_object(
    'number', i.number, 'amount', i.amount, 'paid', i.paid, 'status', i.status,
    'due_date', i.due_date, 'created_at', i.created_at, 'last_payment_at', i.last_payment_at,
    'notes', i.notes, 'voided_at', i.voided_at, 'void_reason', i.void_reason
  ),
  'customer', jsonb_build_object(
    'full_name', c.full_name, 'email', c.email, 'phone', c.phone,
    'service_address', c.service_address
  ),
  'company', jsonb_build_object(
    'legal_name', s.legal_name, 'phone', s.phone, 'email', s.email,
    'website', s.website, 'address', s.address, 'tagline', s.tagline
  ),
  'payments', coalesce((
    select jsonb_agg(jsonb_build_object(
      'amount', p.amount, 'payment_date', p.payment_date,
      'method', p.method, 'status', p.status
    ) order by p.payment_date desc, p.created_at desc)
    from public.payments p
    where p.invoice_id = i.id and p.status = 'succeeded'
  ), '[]'::jsonb)
)
from public.invoices i
left join public.customers c on c.id = i.customer_id
left join public.company_settings s on s.owner_id = i.owner_id
where i.receipt_token = p_token
limit 1
$$;

revoke all on function public.get_invoice_receipt(uuid) from public;
grant execute on function public.get_invoice_receipt(uuid) to anon, authenticated;
