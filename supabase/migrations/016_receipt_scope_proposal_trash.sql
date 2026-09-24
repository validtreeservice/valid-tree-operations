begin;
alter table public.invoices add column if not exists work_description text;
create or replace function public.get_invoice_receipt(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
select jsonb_build_object(
  'invoice', jsonb_build_object(
    'work_description', coalesce(nullif(btrim(i.work_description),''),nullif(btrim(ct.scope_of_work),'')),
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
left join public.jobs j on j.id=i.job_id and j.owner_id=i.owner_id and j.customer_id=i.customer_id
left join public.contracts ct on ct.id=coalesce(i.contract_id,j.contract_id) and ct.owner_id=i.owner_id and ct.customer_id=i.customer_id
left join public.customers c on c.id = i.customer_id and c.owner_id=i.owner_id
left join public.company_settings s on s.owner_id = i.owner_id
where i.receipt_token = p_token
limit 1
$$;

revoke all on function public.get_invoice_receipt(uuid) from public;
grant execute on function public.get_invoice_receipt(uuid) to anon, authenticated;

create or replace function public.proposal_protect_accepted()
returns trigger language plpgsql set search_path=public as $$
begin
 -- Trash/restore may change only archival metadata; signed content remains immutable.
 if old.deleted_at is distinct from new.deleted_at and
    (to_jsonb(new)-array['deleted_at','revision','updated_at']) = (to_jsonb(old)-array['deleted_at','revision','updated_at']) and
    new.revision=old.revision+1 then return new; end if;
 if old.deleted_at is not null then raise exception 'Restore this proposal from Trash before editing.'; end if;
 if old.status='accepted' and
    (to_jsonb(new)-array['updated_at','customer_id','readiness_cleared_at','readiness_record']) is distinct from
    (to_jsonb(old)-array['updated_at','customer_id','readiness_cleared_at','readiness_record'])
 then raise exception 'Accepted document is locked. Use a separate revision/change order.'; end if;
 return new;
end $$;
create or replace function public.trash_commercial_proposal(p_id uuid,p_revision integer,p_restore boolean default false)
returns public.commercial_proposals language plpgsql security definer set search_path=public as $$
declare o uuid; r public.commercial_proposals;
begin
 o:=public.proposal_require_office();
 select * into r from public.commercial_proposals where id=p_id and owner_id=o for update;
 if r.id is null or r.revision is distinct from p_revision then raise exception 'This proposal changed. Reopen it before moving it to Trash or restoring it.'; end if;
 update public.commercial_proposals set deleted_at=case when p_restore then null else now() end,revision=revision+1 where id=p_id returning * into r;
 insert into public.audit_log(owner_id,actor_id,action,entity_type,entity_id,metadata)
  values(o,auth.uid(),case when p_restore then 'proposal_restored' else 'proposal_trashed' end,'commercial_proposal',p_id,jsonb_build_object('number',r.number,'status',r.status,'recoverable',true));
 return r;
end $$;

create or replace function public.get_commercial_proposal(p_token uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.commercial_proposals;
begin
  select * into r from public.commercial_proposals where share_token=p_token and status<>'draft' and deleted_at is null for update;
  if r.id is null then raise exception 'This proposal link is unavailable. Ask Valid Tree Service for the current link.'; end if;
  if r.status in ('sent','viewed') and r.expires_at < (now() at time zone 'America/Chicago')::date then
    update public.commercial_proposals set status='expired' where id=r.id returning * into r;
  elsif r.status='sent' then
    update public.commercial_proposals set status='viewed',viewed_at=coalesce(viewed_at,now()) where id=r.id returning * into r;
  end if;
  return jsonb_build_object('document',r.published_snapshot,'status',r.status,'revision',r.revision,'acceptance',r.acceptance);
end $$;

create or replace function public.convert_commercial_proposal(p_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare o uuid; r public.commercial_proposals; j uuid; cu uuid; n integer; y integer; brief text; item jsonb;
begin
  o := public.proposal_require_office();
  select * into r from public.commercial_proposals where id=p_id and owner_id=o for update;
  if r.id is null or r.status<>'accepted' or r.deleted_at is not null then raise exception 'Only an accepted proposal can become a job.'; end if;
  select id into j from public.jobs where proposal_id=r.id and owner_id=o;
  if j is not null then return j; end if;
  if r.readiness_cleared_at is null then raise exception 'Verify the actual deposit and required pre-mobilization documents first.'; end if;
  cu := r.customer_id;
  if cu is null then
    insert into public.customers(owner_id,full_name,phone,email,service_address,notes)
      values(o,r.contact_name,r.content->>'phone',r.content->>'email',r.project_address,'Company: '||r.company_name)
      returning id into cu;
    update public.commercial_proposals set customer_id=cu where id=r.id;
  elsif not exists(select 1 from public.customers where id=cu and owner_id=o) then raise exception 'Customer is not in your workspace.'; end if;
  brief := r.number||' - '||r.project_name;
  for item in select value from jsonb_array_elements(r.content->'sections') loop
    brief := brief||E'\n\n'||(item->>'title')||E'\n'||(item->>'body');
  end loop;
  brief := brief||E'\n\nPayment terms\n'||(r.content->>'payment_terms')||E'\n\nMilestones\n'||(r.content->>'milestones')||E'\n\nInternal office notes\n'||r.internal_notes;
  perform pg_advisory_xact_lock(hashtext(o::text||':jobs'));
  y := extract(year from (now() at time zone 'America/Chicago'))::integer;
  select greatest(coalesce(max(substring(number from '^JOB-[0-9]{4}-([0-9]+)$')::integer),89),89)+1 into n from public.jobs where owner_id=o;
  loop
    begin
      insert into public.jobs(owner_id,customer_id,number,title,status,address,foreman_notes,proposal_id,proposal_amount,proposal_snapshot)
        values(o,cu,'JOB-'||y||'-'||lpad(n::text,greatest(4,length(n::text)),'0'),r.project_name,'unscheduled',r.project_address,brief,r.id,r.amount,
          r.published_snapshot||jsonb_build_object('acceptance',r.acceptance)) returning id into j;
      exit;
    exception when unique_violation then n:=n+1;
    end;
  end loop;
  insert into public.audit_log(owner_id,actor_id,action,entity_type,entity_id,metadata)
    values(o,auth.uid(),'proposal_converted','commercial_proposal',r.id,jsonb_build_object('job_id',j));
  return j;
end $$;



notify pgrst,'reload schema';
commit;
