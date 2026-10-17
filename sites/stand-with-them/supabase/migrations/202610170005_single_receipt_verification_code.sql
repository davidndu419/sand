-- Keep donation and receipt references as internal audit identifiers while using
-- one donor-facing verification code throughout payment and fulfilment states.
-- New codes are hashed for public lookup and encrypted for protected admin reveal.
-- Existing hashes remain valid; their original plaintext cannot be recovered.

alter table public.receipts
  add column if not exists verification_code_ciphertext text
  check (verification_code_ciphertext is null or char_length(verification_code_ciphertext) between 20 and 1000);

drop function if exists public.submit_payment(uuid,text,text,uuid,text,text,text,text,text,bigint);

create or replace function public.submit_payment(
  p_donation_id uuid, p_access_code text, p_method text, p_payment_option_id uuid,
  p_gift_code_ciphertext text, p_transaction_hash text,
  p_evidence_path text, p_evidence_name text, p_evidence_mime text, p_evidence_size bigint,
  p_verification_code text, p_verification_code_ciphertext text
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_donation public.donations; v_option public.payment_options; v_payment_id uuid;
  v_receipt text; v_verification text;
begin
  select * into v_donation from public.donations where id=p_donation_id
    and access_code_hash=digest(p_access_code,'sha256') for update;
  if not found then raise exception 'not_found'; end if;
  if exists(select 1 from public.payment_submissions where donation_id=p_donation_id) then raise exception 'already_submitted'; end if;
  select * into v_option from public.payment_options where id=p_payment_option_id and active and method=p_method::public.payment_method;
  if not found then raise exception 'payment_option_unavailable'; end if;
  if p_method='gift_card' and nullif(p_gift_code_ciphertext,'') is null then raise exception 'gift_code_required'; end if;
  v_verification := upper(trim(p_verification_code));
  if v_verification is null or v_verification !~ '^[A-HJ-NP-Z2-9]{20}$'
    or nullif(trim(p_verification_code_ciphertext),'') is null then raise exception 'verification_code_required'; end if;
  insert into public.payment_submissions(donation_id,method,payment_option_id,gift_card_code_ciphertext,transaction_hash)
  values(p_donation_id,p_method::public.payment_method,p_payment_option_id,
    case when p_method='gift_card' then p_gift_code_ciphertext end,
    case when p_method='cryptocurrency' then nullif(trim(p_transaction_hash),'') end)
  returning id into v_payment_id;
  if p_evidence_path is not null then
    insert into public.payment_evidence(payment_submission_id,object_path,original_filename,mime_type,size_bytes)
    values(v_payment_id,p_evidence_path,p_evidence_name,p_evidence_mime,p_evidence_size);
  end if;
  v_receipt := 'STW-' || to_char(now() at time zone 'UTC','YYYY') || '-' || lpad(nextval('public.receipt_number_seq')::text,6,'0');
  insert into public.receipts(donation_id,receipt_number,verification_code_hash,verification_code_ciphertext)
  values(p_donation_id,v_receipt,digest(v_verification,'sha256'),trim(p_verification_code_ciphertext));
  insert into public.fulfilment_events(donation_id,event_type,public_description)
  values(p_donation_id,'payment_submitted','Payment evidence was submitted and is awaiting administrative verification.');
  return jsonb_build_object('donationId',p_donation_id,'verificationCode',v_verification);
end; $$;

create or replace function public.public_verify_receipt(p_verification_code text)
returns jsonb language sql security definer set search_path = public, extensions as $$
  select jsonb_build_object(
    'donation_date',d.created_at,'soldier_tag',d.soldier_tag_snapshot,'category_name',c.name,
    'amount_minor',d.amount_minor,'currency',d.currency,'payment_method',ps.method,
    'payment_status',ps.status,'fulfilment_status',d.fulfilment_status,'generated_at',r.generated_at,
    'events',coalesce((select jsonb_agg(jsonb_build_object(
      'description',e.public_description,'at',e.event_at
    ) order by e.event_at) from public.fulfilment_events e where e.donation_id=d.id),'[]'::jsonb)
  ) from public.receipts r join public.donations d on d.id=r.donation_id
  join public.support_categories c on c.id=d.category_id
  join public.payment_submissions ps on ps.donation_id=d.id
  where r.verification_code_hash=digest(upper(trim(p_verification_code)),'sha256');
$$;

create or replace function public.public_get_receipt(p_donation_id uuid, p_verification_code text)
returns jsonb language sql security definer set search_path = public, extensions as $$
  select jsonb_build_object(
    'donation_date',d.created_at,'soldier_tag',d.soldier_tag_snapshot,'category_name',c.name,
    'amount_minor',d.amount_minor,'currency',d.currency,'payment_method',ps.method,
    'payment_status',ps.status,'fulfilment_status',d.fulfilment_status,'generated_at',r.generated_at
  ) from public.donations d join public.receipts r on r.donation_id=d.id
  join public.support_categories c on c.id=d.category_id
  join public.payment_submissions ps on ps.donation_id=d.id
  where d.id=p_donation_id and r.verification_code_hash=digest(upper(trim(p_verification_code)),'sha256');
$$;

create or replace function public.link_receipt_verification_code(
  p_admin_id uuid, p_receipt_id uuid, p_verification_code text, p_verification_code_ciphertext text
) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare v_role public.admin_role; v_code text; v_updated uuid;
begin
  select role into v_role from public.admin_profiles where id=p_admin_id and active;
  if v_role is null then raise exception 'forbidden'; end if;
  v_code := upper(trim(p_verification_code));
  if v_code is null or v_code !~ '^([A-HJ-NP-Z2-9]{20}|[A-F0-9]{32})$'
    or nullif(trim(p_verification_code_ciphertext),'') is null then raise exception 'invalid_code'; end if;
  if exists(select 1 from public.receipts where id=p_receipt_id and verification_code_ciphertext is not null)
    then raise exception 'already_linked'; end if;
  update public.receipts set verification_code_ciphertext=trim(p_verification_code_ciphertext)
  where id=p_receipt_id and verification_code_ciphertext is null
    and verification_code_hash=digest(v_code,'sha256')
  returning id into v_updated;
  if v_updated is null then raise exception 'invalid_code'; end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(p_admin_id,'receipt.verification_code_linked','receipt',p_receipt_id::text,jsonb_build_object('legacy',true));
  return true;
end; $$;

revoke all on function public.submit_payment(uuid,text,text,uuid,text,text,text,text,text,bigint,text,text) from public;
revoke all on function public.public_verify_receipt(text) from public;
revoke all on function public.public_get_receipt(uuid,text) from public;
revoke all on function public.link_receipt_verification_code(uuid,uuid,text,text) from public;
grant execute on function public.submit_payment(uuid,text,text,uuid,text,text,text,text,text,bigint,text,text) to service_role;
grant execute on function public.public_verify_receipt(text) to service_role;
grant execute on function public.public_get_receipt(uuid,text) to service_role;
grant execute on function public.link_receipt_verification_code(uuid,uuid,text,text) to service_role;
