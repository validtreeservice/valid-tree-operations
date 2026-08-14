-- Company contact correction, staff Sunday scheduling, and safe contract disposition.
-- Additive/idempotent migration: existing operational and Stripe records are preserved.

begin;

update public.company_settings set phone = '832-445-6535'
where phone is distinct from '832-445-6535';

alter table public.contracts
  add column if not exists voided_at timestamptz,
  add column if not exists void_reason text;

-- Sunday is blocked in the anonymous booking RPC, not at table level. This lets
-- authenticated owner/office users create a Sunday slot or schedule a Sunday job.
alter table public.schedule_slots drop constraint if exists schedule_slots_no_sunday;

create or replace function public.safe_void_or_delete_contract(p_contract_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.contracts;
  v_has_history boolean;
begin
  if auth.uid() is null or public.my_role() not in ('owner','office') then
    raise exception 'Office access is required';
  end if;

  select * into c from public.contracts
  where id = p_contract_id and owner_id = public.current_owner_id()
  for update;
  if c.id is null then raise exception 'Contract not found'; end if;

  select c.signed_at is not null or c.signature_data is not null or exists(
    select 1 from public.jobs j where j.contract_id = c.id
  ) into v_has_history;

  if not v_has_history then
    delete from public.contracts where id = c.id;
    insert into public.audit_log(owner_id, actor_id, action, entity_type, entity_id, metadata)
    values(c.owner_id, auth.uid(), 'contract_deleted', 'contract', c.id,
      jsonb_build_object('contract_number', c.contract_number, 'reason', nullif(trim(p_reason),'')));
    return jsonb_build_object('ok', true, 'action', 'deleted', 'contract_number', c.contract_number);
  end if;

  if nullif(trim(p_reason),'') is null then raise exception 'A void reason is required'; end if;
  update public.contracts set status = 'cancelled', voided_at = now(),
    void_reason = trim(p_reason), updated_at = now()
  where id = c.id;
  insert into public.audit_log(owner_id, actor_id, action, entity_type, entity_id, metadata)
  values(c.owner_id, auth.uid(), 'contract_voided', 'contract', c.id,
    jsonb_build_object('contract_number', c.contract_number, 'reason', trim(p_reason)));
  return jsonb_build_object('ok', true, 'action', 'voided', 'contract_number', c.contract_number);
end
$$;

revoke all on function public.safe_void_or_delete_contract(uuid,text) from public;
grant execute on function public.safe_void_or_delete_contract(uuid,text) to authenticated;

commit;
