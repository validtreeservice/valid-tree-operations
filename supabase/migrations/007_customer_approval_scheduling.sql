-- Customer estimate approval, automatic contracts, and owner-controlled booking.
-- Safe to run against the existing production database. Existing records are preserved.

begin;

alter table public.estimates
  add column if not exists approval_token uuid default gen_random_uuid();

update public.estimates
set approval_token = gen_random_uuid()
where approval_token is null;

alter table public.estimates
  alter column approval_token set default gen_random_uuid(),
  alter column approval_token set not null;

create unique index if not exists estimates_approval_token_key
  on public.estimates(approval_token);

create table if not exists public.schedule_slots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  slot_date date not null,
  start_time time not null default '08:00',
  capacity integer not null default 1 check (capacity between 1 and 10),
  active boolean not null default true,
  customer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, slot_date, start_time),
  constraint schedule_slots_no_sunday check (extract(dow from slot_date) <> 0)
);

alter table public.contracts
  add column if not exists schedule_slot_id uuid references public.schedule_slots(id) on delete set null;

alter table public.jobs
  add column if not exists schedule_slot_id uuid references public.schedule_slots(id) on delete set null;

create index if not exists schedule_slots_owner_date_idx
  on public.schedule_slots(owner_id, slot_date, active);
create index if not exists jobs_schedule_slot_idx
  on public.jobs(schedule_slot_id);

alter table public.schedule_slots enable row level security;
drop policy if exists "company read schedule slots" on public.schedule_slots;
create policy "company read schedule slots" on public.schedule_slots
  for select to authenticated
  using (owner_id = public.current_owner_id());
drop policy if exists "office manage schedule slots" on public.schedule_slots;
create policy "office manage schedule slots" on public.schedule_slots
  for all to authenticated
  using (owner_id = public.current_owner_id() and public.my_role() in ('owner','office'))
  with check (owner_id = public.current_owner_id() and public.my_role() in ('owner','office'));

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
  v_number text;
  v_sequence integer;
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
    perform pg_advisory_xact_lock(hashtext(e.owner_id::text || ':contracts'));

    select count(*) + 1 into v_sequence
    from public.contracts
    where owner_id = e.owner_id
      and extract(year from created_at) = extract(year from now());

    loop
      v_number := format('VTS-%s-%s', extract(year from now())::integer, lpad(v_sequence::text, 4, '0'));
      exit when not exists (
        select 1 from public.contracts where owner_id = e.owner_id and contract_number = v_number
      );
      v_sequence := v_sequence + 1;
    end loop;

    insert into public.contracts(
      owner_id, customer_id, estimate_id, contract_number, title,
      scope_of_work, total_price, deposit, status, sent_at,
      contractor_name, contractor_title, contractor_signed_at
    ) values (
      e.owner_id, e.customer_id, e.id, v_number, coalesce(nullif(e.title,''),'Tree Service Agreement'),
      coalesce(nullif(e.scope,''),'Tree service work described in the accepted estimate.'),
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
  ), available as (
    select s.id, s.slot_date, s.start_time, s.customer_note,
      greatest(s.capacity - count(j.id), 0)::integer as remaining
    from public.schedule_slots s
    join selected_contract c on c.owner_id = s.owner_id
    left join public.jobs j on j.schedule_slot_id = s.id
      and j.status not in ('cancelled','void')
      and j.contract_id is distinct from c.id
    where s.active = true
      and s.slot_date >= current_date
      and extract(dow from s.slot_date) <> 0
    group by s.id
    having count(j.id) < s.capacity
    order by s.slot_date, s.start_time
    limit 60
  )
  select jsonb_build_object(
    'booked_slot_id', c.schedule_slot_id,
    'service_date', c.service_date,
    'sunday_message', 'Sunday appointments require direct approval from Valid Tree Service.',
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
  v_count integer;
  v_sequence integer;
  v_number text;
begin
  select * into c from public.contracts where sign_token = p_token for update;
  if c.id is null then raise exception 'Agreement not found'; end if;
  if c.signed_at is null then raise exception 'Please sign the agreement before choosing a date'; end if;

  select * into s from public.schedule_slots
  where id = p_slot_id and owner_id = c.owner_id
  for update;
  if s.id is null or not s.active then raise exception 'That appointment is no longer available'; end if;
  if s.slot_date < current_date then raise exception 'That appointment has passed'; end if;
  if extract(dow from s.slot_date) = 0 then
    raise exception 'Sunday appointments require direct approval from Valid Tree Service';
  end if;

  select count(*) into v_count from public.jobs
  where schedule_slot_id = s.id
    and status not in ('cancelled','void')
    and contract_id is distinct from c.id;
  if v_count >= s.capacity then raise exception 'That appointment was just booked. Please choose another date.'; end if;

  update public.contracts
  set schedule_slot_id = s.id, service_date = s.slot_date, updated_at = now()
  where id = c.id;

  select * into cu from public.customers where id = c.customer_id;
  select * into j from public.jobs where contract_id = c.id limit 1;

  if j.id is null then
    perform pg_advisory_xact_lock(hashtext(c.owner_id::text || ':jobs'));

    select count(*) + 1 into v_sequence
    from public.jobs
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
      s.slot_date, s.start_time, 'scheduled', cu.service_address,
      c.scope_of_work, true
    ) returning * into j;
  else
    update public.jobs
    set schedule_slot_id = s.id, date = s.slot_date, start_time = s.start_time,
        status = case when status in ('completed','in_progress','in progress') then status else 'scheduled' end,
        customer_confirmed = true, updated_at = now()
    where id = j.id
    returning * into j;
  end if;

  return jsonb_build_object(
    'ok', true,
    'job_id', j.id,
    'job_number', j.number,
    'slot_id', s.id,
    'slot_date', s.slot_date,
    'start_time', s.start_time
  );
end
$$;

revoke all on function public.get_estimate_for_approval(uuid) from public;
revoke all on function public.accept_estimate(uuid) from public;
revoke all on function public.get_contract_schedule_options(uuid) from public;
revoke all on function public.book_contract_schedule(uuid,uuid) from public;
grant execute on function public.get_estimate_for_approval(uuid) to anon, authenticated;
grant execute on function public.accept_estimate(uuid) to anon, authenticated;
grant execute on function public.get_contract_schedule_options(uuid) to anon, authenticated;
grant execute on function public.book_contract_schedule(uuid,uuid) to anon, authenticated;

commit;
