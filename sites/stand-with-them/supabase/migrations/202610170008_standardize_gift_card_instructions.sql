-- Replace legacy or manually entered gift-card copy with the approved public instructions.

update public.payment_options
set instructions = case
  when lower(coalesce(config->>'gift_card_type', '') || ' ' || label) like '%apple%'
    then 'Purchase a new Apple Gift Card for the donation amount. Enter the complete gift card code below and upload a clear image of the card or purchase receipt. Do not submit a card that has already been redeemed.'
  when lower(coalesce(config->>'gift_card_type', '') || ' ' || label) like '%razer%'
    then 'Purchase a new Razer Gold Gift Card for the donation amount. Enter the complete gift card code below and upload a clear image of the card or purchase receipt. Do not submit a card that has already been redeemed.'
  when lower(coalesce(config->>'gift_card_type', '') || ' ' || label) like '%xbox%'
    then 'Purchase a new Xbox Gift Card for the donation amount. Enter the complete gift card code below and upload a clear image of the card or purchase receipt. Do not submit a card that has already been redeemed.'
  else instructions
end,
updated_at = now()
where method = 'gift_card'
  and (
    lower(coalesce(config->>'gift_card_type', '') || ' ' || label) like '%apple%'
    or lower(coalesce(config->>'gift_card_type', '') || ' ' || label) like '%razer%'
    or lower(coalesce(config->>'gift_card_type', '') || ' ' || label) like '%xbox%'
  );
