-- New donation starts remain drafts until payment evidence is submitted and a
-- receipt is generated. The enum value is introduced in the preceding migration
-- so PostgreSQL can safely use it after that migration commits.

alter table public.donations
  alter column payment_status set default 'draft'::public.payment_status;

update public.donations donation
set payment_status = 'draft'::public.payment_status
where donation.payment_status = 'pending'
  and not exists (
    select 1
    from public.payment_submissions submission
    where submission.donation_id = donation.id
  );

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
  update public.donations
  set payment_status='pending'::public.payment_status
  where id=p_donation_id;
  insert into public.fulfilment_events(donation_id,event_type,public_description)
  values(p_donation_id,'payment_submitted','Payment evidence was submitted and is awaiting administrative verification.');
  return jsonb_build_object('donationId',p_donation_id,'verificationCode',v_verification);
end; $$;

revoke all on function public.submit_payment(uuid,text,text,uuid,text,text,text,text,text,bigint,text,text) from public;
grant execute on function public.submit_payment(uuid,text,text,uuid,text,text,text,text,text,bigint,text,text) to service_role;
