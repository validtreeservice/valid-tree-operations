-- Collision-proof estimate/contract numbering plus estimate service types.
-- Additive and idempotent: no customer, estimate, contract, signature, job,
-- invoice, payment, or other operational record is deleted or renumbered.

begin;

alter table public.estimates
  add column if not exists service_type text;

update public.estimates
set service_type = 'tree_service'
where service_type is null
   or service_type not in ('tree_service', 'junk_removal', 'demolition');

alter table public.estimates
  alter column service_type set default 'tree_service',
  alter column service_type set not null;

alter table public.estimates
  drop constraint if exists estimates_service_type_check;

alter table public.estimates
  add constraint estimates_service_type_check
  check (service_type in ('tree_service', 'junk_removal', 'demolition'));

create index if not exists estimates_owner_service_type_idx
  on public.estimates(owner_id, service_type, created_at desc);

create or replace function public.ensure_unique_estimate_number()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_year integer := extract(year from coalesce(new.created_at, now()))::integer;
  v_sequence integer;
  v_candidate text;
begin
  perform pg_advisory_xact_lock(hashtext(new.owner_id::text || ':estimates:' || v_year::text));

  if new.number is null
     or btrim(new.number) = ''
     or exists (
       select 1
       from public.estimates e
       where e.owner_id = new.owner_id
         and e.number = new.number
         and e.id <> new.id
     ) then
    select coalesce(max(substring(e.number from '([0-9]+)$')::integer), 0) + 1
    into v_sequence
    from public.estimates e
    where e.owner_id = new.owner_id
      and e.number like format('EST-%s-%%', v_year);

    loop
      v_candidate := format('EST-%s-%s', v_year, lpad(v_sequence::text, 4, '0'));
      exit when not exists (
        select 1 from public.estimates e
        where e.owner_id = new.owner_id and e.number = v_candidate
      );
      v_sequence := v_sequence + 1;
    end loop;

    new.number := v_candidate;
  end if;

  return new;
end
$$;

drop trigger if exists estimates_unique_number_before_insert on public.estimates;
create trigger estimates_unique_number_before_insert
before insert on public.estimates
for each row execute function public.ensure_unique_estimate_number();

create or replace function public.ensure_unique_contract_number()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_year integer := extract(year from coalesce(new.created_at, now()))::integer;
  v_prefix text := case coalesce(new.contract_type, 'tree_service')
    when 'junk_removal' then 'VJR'
    when 'demolition' then 'VDM'
    else 'VTS'
  end;
  v_sequence integer;
  v_candidate text;
begin
  perform pg_advisory_xact_lock(hashtext(new.owner_id::text || ':contracts:' || v_prefix || ':' || v_year::text));

  if new.contract_number is null
     or btrim(new.contract_number) = ''
     or exists (
       select 1
       from public.contracts c
       where c.owner_id = new.owner_id
         and c.contract_number = new.contract_number
         and c.id <> new.id
     ) then
    select coalesce(max(substring(c.contract_number from '([0-9]+)$')::integer), 0) + 1
    into v_sequence
    from public.contracts c
    where c.owner_id = new.owner_id
      and c.contract_number like format('%s-%s-%%', v_prefix, v_year);

    loop
      v_candidate := format('%s-%s-%s', v_prefix, v_year, lpad(v_sequence::text, 4, '0'));
      exit when not exists (
        select 1 from public.contracts c
        where c.owner_id = new.owner_id and c.contract_number = v_candidate
      );
      v_sequence := v_sequence + 1;
    end loop;

    new.contract_number := v_candidate;
  end if;

  return new;
end
$$;

drop trigger if exists contracts_unique_number_before_insert on public.contracts;
create trigger contracts_unique_number_before_insert
before insert on public.contracts
for each row execute function public.ensure_unique_contract_number();

create or replace function public.get_estimate_for_approval(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', e.id,
    'number', e.number,
    'service_type', e.service_type,
    'title', e.title,
    'scope', e.scope,
    'amount', e.amount,
    'status', e.status,
    'expires_at', e.expires_at,
    'approved_at', e.approved_at,
    'customer', jsonb_build_object(
      'full_name', cu.full_name,
      'email', cu.email,
      'phone', cu.phone,
      'service_address', cu.service_address
    ),
    'company', jsonb_build_object(
      'legal_name', s.legal_name,
      'display_name', s.display_name,
      'phone', s.phone,
      'email', s.email,
      'website', s.website,
      'tagline', s.tagline
    )
  )
  from public.estimates e
  left join public.customers cu on cu.id = e.customer_id
  left join public.company_settings s on s.owner_id = e.owner_id
  where e.approval_token = p_token
    and e.status not in ('void','declined')
    and (e.expires_at is null or e.expires_at >= current_date)
  limit 1
$$;

create or replace function public.accept_estimate(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.estimates;
  c public.contracts;
  v_prefix text;
  v_number text;
  v_sequence integer;
  v_contract_title text;
  v_default_scope text;
begin
  select * into e
  from public.estimates
  where approval_token = p_token
  for update;

  if e.id is null then raise exception 'Estimate not found'; end if;
  if e.status in ('void','declined') then raise exception 'This estimate is no longer available'; end if;
  if e.expires_at is not null and e.expires_at < current_date then raise exception 'This estimate has expired'; end if;

  select * into c from public.contracts where estimate_id = e.id limit 1;

  if c.id is null then
    v_prefix := case e.service_type
      when 'junk_removal' then 'VJR'
      when 'demolition' then 'VDM'
      else 'VTS'
    end;
    v_contract_title := case e.service_type
      when 'junk_removal' then 'Junk Removal Agreement'
      when 'demolition' then 'Demolition Agreement'
      else 'Tree Service Agreement'
    end;
    v_default_scope := case e.service_type
      when 'junk_removal' then 'Junk-removal work described in the accepted estimate.'
      when 'demolition' then 'Demolition work described in the accepted estimate.'
      else 'Tree-service work described in the accepted estimate.'
    end;

    perform pg_advisory_xact_lock(hashtext(e.owner_id::text || ':contracts:' || v_prefix || ':' || extract(year from now())::integer::text));

    select coalesce(max(substring(contract_number from '([0-9]+)$')::integer), 0) + 1
    into v_sequence
    from public.contracts
    where owner_id = e.owner_id
      and contract_number like format('%s-%s-%%', v_prefix, extract(year from now())::integer);

    v_number := format('%s-%s-%s', v_prefix, extract(year from now())::integer, lpad(v_sequence::text, 4, '0'));

    insert into public.contracts(
      owner_id, customer_id, estimate_id, contract_number, contract_type, title,
      scope_of_work, total_price, deposit, status, sent_at,
      contractor_name, contractor_title, contractor_signed_at
    ) values (
      e.owner_id, e.customer_id, e.id, v_number, e.service_type, v_contract_title,
      coalesce(nullif(e.scope,''), v_default_scope),
      e.amount, 0, 'sent', now(),
      'Mark Guerrero', 'Owner / Authorized Representative', now()
    ) returning * into c;
  end if;

  update public.estimates
  set status = 'approved', approved_at = coalesce(approved_at, now()), updated_at = now()
  where id = e.id;

  return jsonb_build_object(
    'ok', true,
    'contract_id', c.id,
    'contract_number', c.contract_number,
    'sign_token', c.sign_token,
    'already_accepted', e.approved_at is not null
  );
end
$$;

grant execute on function public.get_estimate_for_approval(uuid) to anon, authenticated;
grant execute on function public.accept_estimate(uuid) to anon, authenticated;

commit;
