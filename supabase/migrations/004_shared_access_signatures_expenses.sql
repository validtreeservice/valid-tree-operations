-- Shared company access, reliable contract signatures, and receipt access support.

alter table public.contracts
  add column if not exists contractor_name text,
  add column if not exists contractor_title text,
  add column if not exists contractor_signed_at timestamptz;

update public.contracts
set contractor_name = coalesce(contractor_name, 'Mark Guerrero'),
    contractor_title = coalesce(contractor_title, 'Owner / Authorized Representative'),
    contractor_signed_at = coalesce(contractor_signed_at, created_at)
where contractor_name is null or contractor_title is null or contractor_signed_at is null;

create or replace function public.owner_link_staff(
  p_email text,
  p_role public.staff_role default 'office',
  p_full_name text default null
) returns public.profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  staff_user auth.users;
  result public.profiles;
  company_owner uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if public.my_role() <> 'owner' then raise exception 'Only the owner can link staff accounts'; end if;
  if p_role = 'owner' then raise exception 'A second owner cannot be assigned from this screen'; end if;

  company_owner := public.current_owner_id();
  select * into staff_user from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if staff_user.id is null then raise exception 'No login exists for that email. Create the user in Supabase Authentication first.'; end if;
  if staff_user.id = company_owner then raise exception 'That email belongs to the owner account'; end if;

  insert into public.profiles(id, owner_id, full_name, role, active)
  values(
    staff_user.id,
    company_owner,
    coalesce(nullif(trim(p_full_name), ''), nullif(staff_user.raw_user_meta_data->>'full_name', ''), split_part(staff_user.email, '@', 1)),
    p_role,
    true
  )
  on conflict(id) do update set
    owner_id = excluded.owner_id,
    full_name = excluded.full_name,
    role = excluded.role,
    active = true,
    updated_at = now()
  returning * into result;

  insert into public.audit_log(owner_id, actor_id, action, entity_type, entity_id, metadata)
  values(company_owner, auth.uid(), 'staff_linked', 'profile', staff_user.id, jsonb_build_object('email', staff_user.email, 'role', p_role));
  return result;
end $$;

revoke all on function public.owner_link_staff(text, public.staff_role, text) from public;
grant execute on function public.owner_link_staff(text, public.staff_role, text) to authenticated;

create or replace function public.get_contract_for_signing(p_token uuid)
returns jsonb language sql stable security definer set search_path=public
as $$
select jsonb_build_object(
  'id', c.id, 'contract_number', c.contract_number, 'title', c.title,
  'scope_of_work', c.scope_of_work, 'terms', c.terms,
  'total_price', c.total_price, 'deposit', c.deposit, 'status', c.status,
  'service_date', c.service_date, 'created_at', c.created_at,
  'signed_at', c.signed_at, 'signature_name', c.signature_name,
  'signer_email', c.signer_email, 'signature_data', c.signature_data,
  'contractor_name', coalesce(c.contractor_name, 'Mark Guerrero'),
  'contractor_title', coalesce(c.contractor_title, 'Owner / Authorized Representative'),
  'contractor_signed_at', coalesce(c.contractor_signed_at, c.created_at),
  'customer', jsonb_build_object('full_name',cu.full_name,'email',cu.email,'phone',cu.phone,'service_address',cu.service_address),
  'company', jsonb_build_object('legal_name',s.legal_name,'display_name',s.display_name,'phone',s.phone,'email',s.email,'tagline',s.tagline,'payment_terms',s.payment_terms)
)
from public.contracts c
left join public.customers cu on cu.id=c.customer_id
left join public.company_settings s on s.owner_id=c.owner_id
where c.sign_token=p_token and c.status in ('draft','sent','signed')
limit 1
$$;

grant execute on function public.get_contract_for_signing(uuid) to anon, authenticated;

create or replace function public.submit_contract_signature(
  p_token uuid, p_name text, p_email text, p_signature_data text,
  p_user_agent text, p_consent_text text
) returns jsonb language plpgsql security definer set search_path=public
as $$
declare c public.contracts;
begin
  select * into c from public.contracts where sign_token=p_token for update;
  if c.id is null then raise exception 'Agreement not found'; end if;
  if c.signature_data is not null and length(c.signature_data) > 100 then
    return jsonb_build_object('ok',true,'already_signed',true,'contract_number',c.contract_number,'signed_at',c.signed_at);
  end if;
  if c.status not in ('draft','sent','signed') then raise exception 'Agreement is not available for signature'; end if;
  if length(trim(coalesce(p_name,''))) < 2 then raise exception 'Printed name is required'; end if;
  if length(coalesce(p_signature_data,'')) < 100 then raise exception 'Signature is required'; end if;

  update public.contracts set
    status='signed', signed_at=now(), signature_name=trim(p_name),
    signer_email=nullif(trim(p_email),''), signature_data=p_signature_data,
    contractor_name=coalesce(contractor_name,'Mark Guerrero'),
    contractor_title=coalesce(contractor_title,'Owner / Authorized Representative'),
    contractor_signed_at=coalesce(contractor_signed_at,created_at),
    acceptance_user_agent=p_user_agent, consent_text=p_consent_text, updated_at=now()
  where id=c.id;

  insert into public.audit_log(owner_id, actor_id, action, entity_type, entity_id, metadata)
  values(c.owner_id, null, 'contract_signed', 'contract', c.id, jsonb_build_object('signature_name',trim(p_name),'signer_email',nullif(trim(p_email),'')));
  return jsonb_build_object('ok',true,'contract_number',c.contract_number,'signed_at',now());
end $$;

grant execute on function public.submit_contract_signature(uuid,text,text,text,text,text) to anon, authenticated;

