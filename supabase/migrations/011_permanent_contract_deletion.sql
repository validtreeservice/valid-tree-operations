-- Explicit permanent contract deletion for owner/office cleanup of test records.
-- Jobs, invoices, change orders, payments, and Stripe identifiers are preserved.

begin;

create or replace function public.permanently_delete_contract(
  p_contract_id uuid,
  p_confirmation text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.contracts;
  v_jobs integer := 0;
  v_invoices integer := 0;
  v_change_orders integer := 0;
begin
  if auth.uid() is null or public.my_role() not in ('owner','office') then
    raise exception 'Office access is required';
  end if;

  select * into c
  from public.contracts
  where id = p_contract_id
    and owner_id = public.current_owner_id()
  for update;

  if c.id is null then raise exception 'Contract not found'; end if;
  if coalesce(p_confirmation, '') <> c.contract_number then
    raise exception 'Type the exact contract number to permanently delete this contract';
  end if;

  select count(*) into v_jobs from public.jobs where contract_id = c.id;
  select count(*) into v_invoices from public.invoices where contract_id = c.id;
  select count(*) into v_change_orders from public.change_orders where contract_id = c.id;

  -- These foreign keys use ON DELETE SET NULL, preserving operational and
  -- financial history while removing the contract and invalidating its sign URL.
  delete from public.contracts where id = c.id;

  insert into public.audit_log(owner_id, actor_id, action, entity_type, entity_id, metadata)
  values(
    c.owner_id,
    auth.uid(),
    'contract_permanently_deleted',
    'contract',
    c.id,
    jsonb_build_object(
      'contract_number', c.contract_number,
      'title', c.title,
      'customer_id', c.customer_id,
      'status', c.status,
      'signed_at', c.signed_at,
      'reason', nullif(trim(p_reason), ''),
      'jobs_preserved', v_jobs,
      'invoices_preserved', v_invoices,
      'change_orders_preserved', v_change_orders
    )
  );

  return jsonb_build_object(
    'ok', true,
    'action', 'permanently_deleted',
    'contract_number', c.contract_number,
    'jobs_preserved', v_jobs,
    'invoices_preserved', v_invoices,
    'change_orders_preserved', v_change_orders
  );
end
$$;

revoke all on function public.permanently_delete_contract(uuid,text,text) from public;
grant execute on function public.permanently_delete_contract(uuid,text,text) to authenticated;

commit;
