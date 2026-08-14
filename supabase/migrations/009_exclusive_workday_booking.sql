-- One customer per workday. Monday-Saturday dates are loaded automatically.
-- Existing jobs, contracts, payments, Stripe data, and staff Sunday access are preserved.

begin;

create or replace function public.ensure_work_schedule(p_days integer default 550)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_inserted integer := 0;
begin
  if auth.uid() is null or public.my_role() not in ('owner','office') then
    raise exception 'Office access is required';
  end if;
  v_owner := public.current_owner_id();

  insert into public.schedule_slots(owner_id, slot_date, start_time, capacity, active, customer_note)
  select v_owner, day::date, '08:00'::time, 1, true,
    'Your service day is reserved exclusively for your project.'
  from generate_series(current_date, current_date + least(greatest(p_days, 30), 730), interval '1 day') day
  where extract(dow from day) between 1 and 6
  on conflict(owner_id, slot_date, start_time) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end
$$;

revoke all on function public.ensure_work_schedule(integer) from public;
grant execute on function public.ensure_work_schedule(integer) to authenticated;

-- Load the next 18 months for every existing company during installation.
insert into public.schedule_slots(owner_id, slot_date, start_time, capacity, active, customer_note)
select settings.owner_id, day::date, '08:00'::time, 1, true,
  'Your service day is reserved exclusively for your project.'
from public.company_settings settings
cross join generate_series(current_date, current_date + 550, interval '1 day') day
where extract(dow from day) between 1 and 6
on conflict(owner_id, slot_date, start_time) do nothing;

create or replace function public.get_contract_schedule_options(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with selected_contract as (
    select c.* from public.contracts c
    where c.sign_token = p_token and c.signed_at is not null
  ), one_slot_per_day as (
    select distinct on (s.slot_date)
      s.id, s.owner_id, s.slot_date, s.start_time, s.customer_note
    from public.schedule_slots s
    join selected_contract c on c.owner_id = s.owner_id
    where s.active = true
      and s.slot_date >= current_date
      and extract(dow from s.slot_date) between 1 and 6
    order by s.slot_date, s.start_time
  ), available as (
    select s.id, s.slot_date, s.start_time, s.customer_note, 1::integer as remaining
    from one_slot_per_day s
    join selected_contract c on c.owner_id = s.owner_id
    where not exists (
      select 1 from public.jobs j
      where j.owner_id = c.owner_id
        and j.date = s.slot_date
        and j.status not in ('cancelled','void')
        and j.contract_id is distinct from c.id
    )
    order by s.slot_date
    limit 120
  )
  select jsonb_build_object(
    'booked_slot_id', c.schedule_slot_id,
    'service_date', c.service_date,
    'sunday_message', 'Sunday appointments require direct approval from Valid Tree Service.',
    'exclusive_day_message', 'Only one customer may reserve each workday.',
    'slots', coalesce((select jsonb_agg(to_jsonb(a)) from available a), '[]'::jsonb)
  )
  from selected_contract c
$$;

create or replace function public.book_contract_schedule(p_token uuid, p_slot_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.contracts;
  s public.schedule_slots;
  cu public.customers;
  j public.jobs;
  v_sequence integer;
  v_number text;
begin
  select * into c from public.contracts where sign_token = p_token for update;
  if c.id is null then raise exception 'Agreement not found'; end if;
  if c.signed_at is null then raise exception 'Please sign the agreement before choosing a date'; end if;

  select * into s from public.schedule_slots
  where id = p_slot_id and owner_id = c.owner_id
  for update;
  if s.id is null or not s.active then raise exception 'That workday is no longer available'; end if;
  if s.slot_date < current_date then raise exception 'That workday has passed'; end if;
  if extract(dow from s.slot_date) = 0 then
    raise exception 'Sunday appointments require direct approval from Valid Tree Service';
  end if;

  -- Serialize bookings for the company/date so two customers cannot take the
  -- same day in simultaneous browser requests.
  perform pg_advisory_xact_lock(hashtext(c.owner_id::text || ':' || s.slot_date::text));
  if exists (
    select 1 from public.jobs existing
    where existing.owner_id = c.owner_id
      and existing.date = s.slot_date
      and existing.status not in ('cancelled','void')
      and existing.contract_id is distinct from c.id
  ) then
    raise exception 'That workday was just booked. Please choose another date.';
  end if;

  update public.contracts
  set schedule_slot_id = s.id, service_date = s.slot_date, updated_at = now()
  where id = c.id;

  select * into cu from public.customers where id = c.customer_id;
  select * into j from public.jobs where contract_id = c.id limit 1;

  if j.id is null then
    perform pg_advisory_xact_lock(hashtext(c.owner_id::text || ':jobs'));
    select count(*) + 1 into v_sequence from public.jobs
    where owner_id = c.owner_id and extract(year from created_at) = extract(year from now());
    loop
      v_number := format('JOB-%s-%s', extract(year from now())::integer, lpad(v_sequence::text, 4, '0'));
      exit when not exists (select 1 from public.jobs where owner_id = c.owner_id and number = v_number);
      v_sequence := v_sequence + 1;
    end loop;
    insert into public.jobs(
      owner_id, customer_id, contract_id, schedule_slot_id, number, title,
      date, start_time, status, address, foreman_notes, customer_confirmed
    ) values (
      c.owner_id, c.customer_id, c.id, s.id, v_number, c.title,
      s.slot_date, s.start_time, 'scheduled', cu.service_address, c.scope_of_work, true
    ) returning * into j;
  else
    update public.jobs
    set schedule_slot_id = s.id, date = s.slot_date, start_time = s.start_time,
        status = case when status in ('completed','in_progress','in progress') then status else 'scheduled' end,
        customer_confirmed = true, updated_at = now()
    where id = j.id returning * into j;
  end if;

  return jsonb_build_object('ok', true, 'job_id', j.id, 'job_number', j.number,
    'slot_id', s.id, 'slot_date', s.slot_date, 'start_time', s.start_time);
end
$$;

revoke all on function public.get_contract_schedule_options(uuid) from public;
revoke all on function public.book_contract_schedule(uuid,uuid) from public;
grant execute on function public.get_contract_schedule_options(uuid) to anon, authenticated;
grant execute on function public.book_contract_schedule(uuid,uuid) to anon, authenticated;

commit;
