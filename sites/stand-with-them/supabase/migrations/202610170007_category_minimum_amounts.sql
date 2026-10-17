-- Give each support category an independently configurable minimum donation.

alter table public.support_categories
  add column if not exists minimum_amount_minor integer;

update public.support_categories
set minimum_amount_minor = greatest(
  100,
  coalesce((select min(amount) from unnest(suggested_amounts_minor) as amount), 100)
)
where minimum_amount_minor is null;

alter table public.support_categories
  alter column minimum_amount_minor set default 100,
  alter column minimum_amount_minor set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'support_categories_minimum_amount_check'
      and conrelid = 'public.support_categories'::regclass
  ) then
    alter table public.support_categories
      add constraint support_categories_minimum_amount_check
      check (minimum_amount_minor between 100 and 100000000);
  end if;
end $$;

-- Gift cards do not require a wallet, so make the three supported card types
-- available immediately. Existing matching options are preserved.
with gift_card_defaults(label, gift_card_type, instructions, sort_order) as (
  values
    ('Apple Gift Card', 'apple', 'Purchase a new Apple Gift Card for the donation amount. Enter the complete gift card code below and upload a clear image of the card or purchase receipt. Do not submit a card that has already been redeemed.', 10),
    ('Razer Gold Gift Card', 'razer', 'Purchase a new Razer Gold Gift Card for the donation amount. Enter the complete gift card code below and upload a clear image of the card or purchase receipt. Do not submit a card that has already been redeemed.', 20),
    ('Xbox Gift Card', 'xbox', 'Purchase a new Xbox Gift Card for the donation amount. Enter the complete gift card code below and upload a clear image of the card or purchase receipt. Do not submit a card that has already been redeemed.', 30)
)
insert into public.payment_options(method, label, instructions, config, active, sort_order)
select
  'gift_card'::public.payment_method,
  defaults.label,
  defaults.instructions,
  jsonb_build_object('gift_card_type', defaults.gift_card_type),
  true,
  defaults.sort_order
from gift_card_defaults defaults
where not exists (
  select 1
  from public.payment_options existing
  where existing.method = 'gift_card'
    and (
      lower(coalesce(existing.config->>'gift_card_type', '')) like '%' || defaults.gift_card_type || '%'
      or lower(existing.label) like '%' || defaults.gift_card_type || '%'
    )
);

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
  if p_amount_minor < v_category.minimum_amount_minor then raise exception 'amount_below_category_minimum'; end if;
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
