-- Additive proposal controls and versioned acceptance. Existing signed snapshots stay unchanged.
begin;
alter table public.commercial_proposals add column if not exists deleted_at timestamptz;
alter table public.commercial_proposals add column if not exists readiness_cleared_at timestamptz;
alter table public.commercial_proposals add column if not exists readiness_record jsonb;

create or replace function public.proposal_customer_snapshot(r public.commercial_proposals)
returns jsonb language sql stable set search_path=public as $$
select jsonb_build_object('document_version',2,'submitted_by','Mark Guerrero','acceptance_terms','By signing or electronically accepting, the undersigned authorized representative accepts this proposal’s scope of work, pricing, payment terms, project conditions, exclusions and all other terms contained in this proposal. The accepted proposal constitutes the parties’ agreement for the described work, unless this proposal expressly requires a separate signed construction contract. The customer authorizes Valid Tree Service LLC to proceed only after the stated deposit, approvals and pre-mobilization requirements have been satisfied and the start date has been confirmed in writing. Acceptance does not waive the asbestos/environmental clearance or other demolition requirements stated in this proposal. Changes to accepted scope, price or terms require a separately approved written revision or change order; the accepted version remains unchanged.','electronic_consent','I have reviewed the entire proposal and its acceptance terms. I am the person named below and am authorized to bind the named customer/company. I agree to this transaction electronically and adopt my typed full legal name as my electronic signature. I understand that clicking Confirm acceptance records my acceptance of this proposal. I can download and retain the document, and may contact Valid Tree Service to arrange a paper signature instead.','number',r.number,'project_name',r.project_name,'project_address',r.project_address,
  'contact_name',r.contact_name,'company_name',r.company_name,'proposal_type',r.proposal_type,
  'proposal_date',r.proposal_date,'expires_at',r.expires_at,'amount',r.amount,
  'company',jsonb_build_object('legalName',coalesce(s.legal_name,'Valid Tree Service LLC'),'phone',s.phone,'email',s.email,'website',s.website,'address',s.address),
  'content',jsonb_build_object(
    'phone',r.content->>'phone','email',r.content->>'email','description',r.content->>'description',
    'sections',(select coalesce(jsonb_agg(jsonb_build_object('title',value->>'title','body',value->>'body')),'[]') from jsonb_array_elements(r.content->'sections')),
    'pricing_mode',r.content->>'pricing_mode',
    'lines',case when r.content->>'pricing_mode'='itemized' then
      (select coalesce(jsonb_agg(jsonb_build_object('label',value->>'label','amount',value->>'amount','included',value->'included')),'[]') from jsonb_array_elements(r.content->'lines')) else '[]'::jsonb end,
    'duration',r.content->>'duration','estimated_start',r.content->>'estimated_start','mobilization',r.content->>'mobilization',
    'payment_terms',r.content->>'payment_terms','milestones',r.content->>'milestones','special_conditions',r.content->>'special_conditions',
    'photos',(select coalesce(jsonb_agg(jsonb_build_object('data',value->>'data','caption',value->>'caption')),'[]') from jsonb_array_elements(r.content->'photos'))
  )) from (select 1) base left join public.company_settings s on s.owner_id=r.owner_id
$$;


create or replace function public.respond_commercial_proposal(
  p_token uuid,p_revision integer,p_action text,p_name text,p_company text,p_signature text,p_consent boolean,p_reason text default ''
) returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.commercial_proposals; consent constant text := 'I am authorized to accept this proposal for the customer/company named below. I have reviewed the scope, exclusions, price, schedule and payment terms, and agree to use my typed signature as my electronic signature.';
begin
  select * into r from public.commercial_proposals where share_token=p_token for update;
  if r.id is null or r.revision is distinct from p_revision then raise exception 'The proposal changed or this link was withdrawn. Request the current proposal.'; end if;
  if r.status not in ('sent','viewed') then raise exception 'This proposal is no longer awaiting a response.'; end if;
  if r.expires_at < (now() at time zone 'America/Chicago')::date then raise exception 'This proposal has expired. Contact Valid Tree Service for an updated proposal.'; end if;
  if (r.published_snapshot->>'document_version')::integer>=2 then raise exception 'Reload the current proposal acceptance page.'; end if;
  if p_action='accept' then
    if not coalesce(p_consent,false) or length(trim(coalesce(p_name,''))) not between 2 and 200
      or length(trim(coalesce(p_signature,''))) not between 2 and 200 or length(trim(coalesce(p_company,''))) not between 1 and 300
      then raise exception 'Enter the authorized representative, company, typed signature and acceptance consent.'; end if;
    update public.commercial_proposals set status='accepted',accepted_at=now(),
      acceptance=jsonb_build_object('name',trim(p_name),'company',trim(p_company),'signature',trim(p_signature),
        'signed_at',now(),'consent',consent,'revision',r.revision,
        'document_hash',encode(sha256(convert_to(r.published_snapshot::text,'UTF8')),'hex'))
      where id=r.id;
  elsif p_action='decline' then
    update public.commercial_proposals set status='declined',declined_at=now(),decline_reason=left(coalesce(p_reason,''),1500) where id=r.id;
  else raise exception 'Invalid response.'; end if;
  insert into public.audit_log(owner_id,actor_id,action,entity_type,entity_id,metadata)
    values(r.owner_id,null,'proposal_'||p_action,'commercial_proposal',r.id,jsonb_build_object('number',r.number,'revision',r.revision));
  return public.get_commercial_proposal(p_token);
end $$;



create or replace function public.respond_commercial_proposal_v2(
 p_token uuid,p_revision integer,p_action text,p_name text,p_company text,p_signature text,p_consent boolean,p_reason text,p_title text,p_email text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.commercial_proposals; headers jsonb;
begin
 select * into r from public.commercial_proposals where share_token=p_token and deleted_at is null for update;
 if r.id is null or r.revision is distinct from p_revision then raise exception 'The proposal changed or this link was withdrawn. Request the current proposal.'; end if;
 if r.status not in ('sent','viewed') then raise exception 'This proposal is no longer awaiting a response.'; end if;
 if r.expires_at<(now() at time zone 'America/Chicago')::date then raise exception 'This proposal has expired. Request an updated proposal.'; end if;
 if coalesce((r.published_snapshot->>'document_version')::integer,1)<>2 then raise exception 'Use the original acceptance page for this version.'; end if;
 if p_action='accept' then
  if not coalesce(p_consent,false) or length(trim(coalesce(p_name,''))) not between 2 and 200
   or length(trim(coalesce(p_signature,''))) not between 2 and 200
   or lower(trim(p_signature)) is distinct from lower(trim(p_name))
   or length(coalesce(p_company,''))>300 or length(coalesce(p_title,''))>200
   or length(coalesce(p_email,'')) not between 3 and 300 or coalesce(p_email,'') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
   or (length(trim(r.company_name))>0 and (length(trim(coalesce(p_company,'')))=0 or length(trim(coalesce(p_title,'')))=0))
   then raise exception 'Enter your full legal name, matching typed signature, contact email, company/title when representing a company, and acceptance consent.'; end if;
  begin headers:=coalesce(nullif(current_setting('request.headers',true),'')::jsonb,'{}'::jsonb); exception when others then headers:='{}'::jsonb; end;
  update public.commercial_proposals set status='accepted',accepted_at=now(),
   acceptance=jsonb_build_object('name',trim(p_name),'company',coalesce(nullif(trim(p_company),''),trim(p_name)),
    'title',trim(coalesce(p_title,'')),'email',lower(trim(p_email)),'signature',trim(p_signature),'signed_at',now(),
    'consent',r.published_snapshot->>'electronic_consent','revision',r.revision,
    'document_hash',encode(sha256(convert_to(r.published_snapshot::text,'UTF8')),'hex'),
    'method','typed_name_with_explicit_consent','email_verified',false)
   where id=r.id;
  insert into public.audit_log(owner_id,actor_id,action,entity_type,entity_id,metadata)
   values(r.owner_id,null,'proposal_accept','commercial_proposal',r.id,jsonb_build_object(
    'number',r.number,'revision',r.revision,'signed_at',now(),'name',trim(p_name),'company',trim(p_company),'title',trim(p_title),
    'email',lower(trim(p_email)),'user_agent',left(coalesce(headers->>'user-agent',''),1000),
    'forwarded_for_unverified',left(coalesce(headers->>'x-forwarded-for',''),500),
    'document_hash',encode(sha256(convert_to(r.published_snapshot::text,'UTF8')),'hex')));
 elsif p_action='decline' then
  update public.commercial_proposals set status='declined',declined_at=now(),decline_reason=left(coalesce(p_reason,''),1500) where id=r.id;
  insert into public.audit_log(owner_id,actor_id,action,entity_type,entity_id,metadata)
   values(r.owner_id,null,'proposal_decline','commercial_proposal',r.id,jsonb_build_object('number',r.number,'revision',r.revision));
 else raise exception 'Invalid response.'; end if;
 return public.get_commercial_proposal(p_token);
end $$;

create or replace function public.trash_commercial_proposal(p_id uuid,p_revision integer,p_restore boolean default false)
returns public.commercial_proposals language plpgsql security definer set search_path=public as $$
declare o uuid; r public.commercial_proposals;
begin
 o:=public.proposal_require_office();
 select * into r from public.commercial_proposals where id=p_id and owner_id=o for update;
 if r.id is null or r.revision is distinct from p_revision or r.status<>'draft' then raise exception 'Only a current draft can be moved to Trash or restored.'; end if;
 update public.commercial_proposals set deleted_at=case when p_restore then null else now() end,revision=revision+1 where id=p_id returning * into r;
 insert into public.audit_log(owner_id,actor_id,action,entity_type,entity_id,metadata)
  values(o,auth.uid(),case when p_restore then 'proposal_restored' else 'proposal_trashed' end,'commercial_proposal',p_id,jsonb_build_object('number',r.number));
 return r;
end $$;

create or replace function public.renumber_commercial_proposal(p_id uuid,p_revision integer,p_sequence integer)
returns public.commercial_proposals language plpgsql security definer set search_path=public as $$
declare o uuid; r public.commercial_proposals; y integer; previous text; next_number text;
begin
 o:=public.proposal_require_office();
 if public.my_role()::text<>'owner' then raise exception 'Only the owner can change proposal numbering.'; end if;
 if p_sequence is null or p_sequence not between 1 and 999999 then raise exception 'Use a sequence from 1 to 999999.'; end if;
 select * into r from public.commercial_proposals where id=p_id and owner_id=o for update;
 if r.id is null or r.revision is distinct from p_revision or r.status<>'draft' or r.deleted_at is not null or r.sent_at is not null
  or exists(select 1 from public.audit_log where entity_id=p_id and action='proposal_issued')
  then raise exception 'Only a current draft that has never been issued can be renumbered.'; end if;
 y:=substring(r.number from '^PROP-([0-9]{4})-')::integer; previous:=r.number;
 next_number:='PROP-'||y||'-'||lpad(p_sequence::text,greatest(4,length(p_sequence::text)),'0');
 -- Reserve the high-water mark atomically using the same counter row as new proposals.
 insert into public.commercial_proposal_counters(owner_id,year,last_value) values(o,y,p_sequence)
 on conflict(owner_id,year) do update set last_value=greatest(commercial_proposal_counters.last_value,excluded.last_value);
 if exists(select 1 from public.commercial_proposals where owner_id=o and number=next_number and id<>p_id) then raise exception 'That proposal number is already reserved.'; end if;
 update public.commercial_proposals set number=next_number,revision=revision+1 where id=p_id returning * into r;
 insert into public.audit_log(owner_id,actor_id,action,entity_type,entity_id,metadata)
  values(o,auth.uid(),'proposal_renumbered','commercial_proposal',p_id,jsonb_build_object('previous_number',previous,'number',next_number,'year',y));
 return r;
end $$;

create or replace function public.clear_commercial_proposal_readiness(p_id uuid,p_revision integer,p_payment_reference text,p_approval_reference text)
returns public.commercial_proposals language plpgsql security definer set search_path=public as $$
declare o uuid; r public.commercial_proposals;
begin
 o:=public.proposal_require_office();
 select * into r from public.commercial_proposals where id=p_id and owner_id=o for update;
 if r.id is null or r.revision is distinct from p_revision or r.status<>'accepted' then raise exception 'Only a current accepted proposal can be cleared.'; end if;
 if length(trim(coalesce(p_payment_reference,''))) not between 5 and 2000 or length(trim(coalesce(p_approval_reference,''))) not between 5 and 4000 then raise exception 'Record the payment and required approval document references.'; end if;
 if r.readiness_cleared_at is not null then raise exception 'Manual verification is already recorded.'; end if;
 update public.commercial_proposals set readiness_cleared_at=now(),readiness_record=jsonb_build_object(
  'verified_by',auth.uid(),'verified_at',now(),'method','manual_office_review','payment_reference',trim(p_payment_reference),'approval_reference',trim(p_approval_reference))
  where id=p_id returning * into r;
 insert into public.audit_log(owner_id,actor_id,action,entity_type,entity_id,metadata)
  values(o,auth.uid(),'proposal_readiness_verified','commercial_proposal',p_id,r.readiness_record);
 return r;
end $$;

-- Defense in depth: operational metadata may change, the agreed document may not.
create or replace function public.proposal_protect_accepted()
returns trigger language plpgsql set search_path=public as $$
begin
 if old.status='accepted' and (
  (to_jsonb(new)-array['updated_at','customer_id','readiness_cleared_at','readiness_record']) is distinct from
  (to_jsonb(old)-array['updated_at','customer_id','readiness_cleared_at','readiness_record'])
 ) then raise exception 'Accepted document is locked. Use a separate revision/change order.'; end if;
 if old.deleted_at is not null and new.deleted_at is not null then raise exception 'Restore this draft from Trash before editing.'; end if;
 return new;
end $$;
drop trigger if exists protect_accepted_proposal on public.commercial_proposals;
create trigger protect_accepted_proposal before update on public.commercial_proposals for each row execute function public.proposal_protect_accepted();

create or replace function public.convert_commercial_proposal(p_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare o uuid; r public.commercial_proposals; j uuid; cu uuid; n integer; y integer; brief text; item jsonb;
begin
  o := public.proposal_require_office();
  select * into r from public.commercial_proposals where id=p_id and owner_id=o for update;
  if r.id is null or r.status<>'accepted' then raise exception 'Only an accepted proposal can become a job.'; end if;
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


revoke all on function public.proposal_protect_accepted() from public,anon,authenticated;
revoke all on function public.respond_commercial_proposal_v2(uuid,integer,text,text,text,text,boolean,text,text,text) from public,anon,authenticated;
grant execute on function public.respond_commercial_proposal_v2(uuid,integer,text,text,text,text,boolean,text,text,text) to anon,authenticated;
revoke all on function public.trash_commercial_proposal(uuid,integer,boolean),public.renumber_commercial_proposal(uuid,integer,integer),public.clear_commercial_proposal_readiness(uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.trash_commercial_proposal(uuid,integer,boolean),public.renumber_commercial_proposal(uuid,integer,integer),public.clear_commercial_proposal_readiness(uuid,integer,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
