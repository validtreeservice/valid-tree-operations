begin;

alter table public.contracts
  add column if not exists contract_type text;

update public.contracts
set contract_type = 'tree_service'
where contract_type is null
   or contract_type not in ('tree_service', 'junk_removal', 'demolition');

alter table public.contracts
  alter column contract_type set default 'tree_service',
  alter column contract_type set not null;

alter table public.contracts
  drop constraint if exists contracts_contract_type_check;

alter table public.contracts
  add constraint contracts_contract_type_check
  check (contract_type in ('tree_service', 'junk_removal', 'demolition'));

create index if not exists contracts_owner_contract_type_idx
  on public.contracts(owner_id, contract_type, created_at desc);

create or replace function public.get_contract_for_signing(p_token uuid)
returns jsonb language sql stable security definer set search_path=public
as $$
select jsonb_build_object(
  'id', c.id, 'contract_number', c.contract_number,
  'contract_type', c.contract_type, 'title', c.title,
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

commit;
