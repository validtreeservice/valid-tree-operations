-- Automatic deposit tiers for accepted and manually-created contracts.
-- $1,500 or less: $0; over $1,500 through $5,000: 30%; over $5,000: 35%.
-- Signed historical contracts and all payment/Stripe records are preserved.

begin;

create or replace function public.required_contract_deposit(p_total numeric)
returns numeric
language sql
immutable
set search_path = public
as $$
  select round(case
    when coalesce(p_total, 0) > 5000 then greatest(p_total, 0) * 0.35
    when coalesce(p_total, 0) > 1500 then greatest(p_total, 0) * 0.30
    else 0
  end, 2)
$$;

create or replace function public.enforce_contract_deposit_policy()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Lock the required amount while a contract is being prepared and again at
  -- signature. Never rewrite an already-signed historical agreement.
  if new.signed_at is null or (tg_op = 'UPDATE' and old.signed_at is null) then
    new.deposit := public.required_contract_deposit(new.total_price);
  end if;
  return new;
end
$$;

drop trigger if exists contracts_automatic_deposit on public.contracts;
create trigger contracts_automatic_deposit
before insert or update of total_price, deposit, signed_at on public.contracts
for each row execute function public.enforce_contract_deposit_policy();

-- Bring pending agreements into the new policy without touching signed records.
update public.contracts
set deposit = public.required_contract_deposit(total_price), updated_at = now()
where signed_at is null
  and deposit is distinct from public.required_contract_deposit(total_price);

commit;
