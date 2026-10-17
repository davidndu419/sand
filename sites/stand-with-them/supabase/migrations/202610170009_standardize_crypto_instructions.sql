-- Replace legacy or manually entered cryptocurrency copy with approved instructions.

with recognised_options as (
  select
    id,
    case
      when lower(coalesce(config->>'token', '') || ' ' || label) like '%usdt%'
        or lower(coalesce(config->>'token', '') || ' ' || label) like '%tether%' then 'Tether (USDT)'
      when lower(coalesce(config->>'token', '') || ' ' || label) like '%bitcoin%'
        or lower(coalesce(config->>'token', '')) = 'btc' then 'Bitcoin (BTC)'
      when lower(coalesce(config->>'token', '') || ' ' || label) like '%ethereum%'
        or lower(coalesce(config->>'token', '')) = 'eth' then 'Ethereum (ETH)'
      when lower(coalesce(config->>'token', '') || ' ' || label) like '%solana%'
        or lower(coalesce(config->>'token', '')) = 'sol' then 'Solana (SOL)'
    end as asset_label,
    case
      when lower(coalesce(config->>'token', '') || ' ' || label) like '%usdt%'
        or lower(coalesce(config->>'token', '') || ' ' || label) like '%tether%' then
        case
          when lower(coalesce(config->>'network', '')) like '%trc20%'
            or lower(coalesce(config->>'network', '')) like '%tron%' then 'TRC20'
          when lower(coalesce(config->>'network', '')) like '%bep20%'
            or lower(coalesce(config->>'network', '')) like '%bsc%'
            or lower(coalesce(config->>'network', '')) like '%binance%' then 'BEP20'
          when lower(coalesce(config->>'network', '')) like '%erc20%'
            or lower(coalesce(config->>'network', '')) like '%ethereum%' then 'ERC20'
        end
      when lower(coalesce(config->>'token', '') || ' ' || label) like '%bitcoin%'
        or lower(coalesce(config->>'token', '')) = 'btc' then 'Bitcoin'
      when lower(coalesce(config->>'token', '') || ' ' || label) like '%ethereum%'
        or lower(coalesce(config->>'token', '')) = 'eth' then 'ERC20'
      when lower(coalesce(config->>'token', '') || ' ' || label) like '%solana%'
        or lower(coalesce(config->>'token', '')) = 'sol' then 'Solana'
    end as network_label
  from public.payment_options
  where method = 'cryptocurrency'
), approved_instructions as (
  select
    id,
    'Send the exact donation amount in ' || asset_label ||
    ' to the wallet address shown, using only the ' || network_label ||
    ' network. Ensure the coin and network match before sending, as transfers made through the wrong network may be permanently lost. Cover any network fees, then upload a clear screenshot or payment receipt for verification. Your donation will remain pending until an administrator confirms the payment.' as instructions
  from recognised_options
  where asset_label is not null and network_label is not null
)
update public.payment_options options
set instructions = approved.instructions,
    updated_at = now()
from approved_instructions approved
where options.id = approved.id;
