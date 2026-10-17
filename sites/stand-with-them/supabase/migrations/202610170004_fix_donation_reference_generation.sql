-- Normalise the random suffix after uppercasing it so lowercase base64 i/o
-- cannot become the I/O characters forbidden by the donation reference check.

create or replace function public.create_donation_draft(
  p_kind text, p_soldier_tag text, p_category_slug text, p_amount_minor bigint,
  p_currency text, p_donor_name text, p_donor_email text
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_kind public.donation_kind; v_category public.support_categories; v_soldier public.soldiers;
  v_access text; v_reference text; v_id uuid;
begin
  v_kind := p_kind::public.donation_kind;
  if p_amount_minor < 100 or p_amount_minor > 100000000 then raise exception 'invalid_amount'; end if;
  if upper(p_currency) <> 'USD' then raise exception 'unsupported_currency'; end if;
  select * into v_category from public.support_categories
  where slug=p_category_slug and active and ((v_kind='soldier' and allows_soldier) or (v_kind='general' and allows_general));
  if not found then raise exception 'category_unavailable'; end if;
  if v_kind='soldier' then
    select s.* into v_soldier from public.soldiers s
    join public.soldier_category_eligibility e on e.soldier_id=s.id and e.category_id=v_category.id
    where s.tag=upper(trim(p_soldier_tag)) and s.status='active';
    if not found then raise exception 'tag_unavailable'; end if;
  end if;
  v_access := upper(encode(gen_random_bytes(18),'hex'));
  v_reference := 'DON-' || to_char(now() at time zone 'UTC','YYYYMMDD') || '-' ||
    regexp_replace(
      upper(substr(encode(gen_random_bytes(8),'base64'),1,8)),
      '[^A-HJ-NP-Z2-9]', 'K', 'g'
    );
  insert into public.donations(reference,kind,soldier_id,soldier_tag_snapshot,category_id,
    amount_minor,currency,donor_name,donor_email,access_code_hash)
  values(v_reference,v_kind,case when v_kind='soldier' then v_soldier.id end,
    case when v_kind='soldier' then v_soldier.tag end,v_category.id,p_amount_minor,upper(p_currency),
    nullif(trim(p_donor_name),''),nullif(lower(trim(p_donor_email)),''),digest(v_access,'sha256'))
  returning id into v_id;
  insert into public.fulfilment_events(donation_id,event_type,public_description)
  values(v_id,'donation_started','Donation details were recorded; payment submission is still required.');
  return jsonb_build_object('donationId',v_id,'reference',v_reference,'accessCode',v_access);
end; $$;

revoke all on function public.create_donation_draft(text,text,text,bigint,text,text,text) from public;
grant execute on function public.create_donation_draft(text,text,text,bigint,text,text,text) to service_role;
