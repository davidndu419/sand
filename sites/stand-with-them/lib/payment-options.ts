import type { PaymentMethod } from "@/lib/types";

export const GIFT_CARD_TYPES = [
  { value: "apple", label: "Apple Gift Card" },
  { value: "razer", label: "Razer Gold Gift Card" },
  { value: "xbox", label: "Xbox Gift Card" },
] as const;

export const CRYPTO_ASSETS = [
  { value: "BTC", label: "Bitcoin (BTC)" },
  { value: "USDT", label: "Tether (USDT)" },
  { value: "ETH", label: "Ethereum (ETH)" },
  { value: "SOL", label: "Solana (SOL)" },
] as const;

export const USDT_NETWORKS = ["TRC20", "BEP20", "ERC20"] as const;

export type GiftCardType = (typeof GIFT_CARD_TYPES)[number]["value"];
export type CryptoAsset = (typeof CRYPTO_ASSETS)[number]["value"];
export type UsdtNetwork = (typeof USDT_NETWORKS)[number];

export type PaymentOptionLike = {
  id: string;
  method: PaymentMethod;
  label: string;
  instructions: string;
  config: Record<string, unknown>;
};

export type PaymentOptionDescriptor =
  | { method: "gift_card"; giftCardType: GiftCardType }
  | { method: "cryptocurrency"; asset: CryptoAsset; network: string };

function normalized(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase().replaceAll(/[^a-z0-9]/g, "") : "";
}

export function giftCardLabel(value: GiftCardType) {
  return GIFT_CARD_TYPES.find((item) => item.value === value)?.label ?? value;
}

export function defaultGiftCardInstructions(value: GiftCardType) {
  const label = giftCardLabel(value);
  return `Purchase a new ${label} for the donation amount. Enter the complete gift card code below and upload a clear image of the card or purchase receipt. Do not submit a card that has already been redeemed.`;
}

export function cryptoAssetLabel(value: CryptoAsset) {
  return CRYPTO_ASSETS.find((item) => item.value === value)?.label ?? value;
}

export function defaultCryptoInstructions(asset: CryptoAsset, network: string) {
  return `Send the exact donation amount in ${cryptoAssetLabel(asset)} to the wallet address shown, using only the ${network} network. Ensure the coin and network match before sending, as transfers made through the wrong network may be permanently lost. Cover any network fees, then upload a clear screenshot or payment receipt for verification. Your donation will remain pending until an administrator confirms the payment.`;
}

export function defaultNetworkFor(asset: Exclude<CryptoAsset, "USDT">) {
  return asset === "BTC" ? "Bitcoin" : asset === "ETH" ? "ERC20" : "Solana";
}

export function paymentOptionLabel(
  method: PaymentMethod,
  value: GiftCardType | CryptoAsset,
  network?: string,
) {
  if (method === "gift_card") return giftCardLabel(value as GiftCardType);
  const asset = value as CryptoAsset;
  return asset === "USDT" ? `${cryptoAssetLabel(asset)} — ${network}` : cryptoAssetLabel(asset);
}

export function describePaymentOption(option: PaymentOptionLike): PaymentOptionDescriptor | null {
  if (option.method === "gift_card") {
    const type = normalized(option.config.gift_card_type || option.label);
    if (type.includes("apple")) return { method: "gift_card", giftCardType: "apple" };
    if (type.includes("razer")) return { method: "gift_card", giftCardType: "razer" };
    if (type.includes("xbox")) return { method: "gift_card", giftCardType: "xbox" };
    return null;
  }

  const token = normalized(option.config.token || option.label);
  const asset: CryptoAsset | null = token.includes("usdt") || token.includes("tether")
    ? "USDT"
    : token === "btc" || token.includes("bitcoin")
      ? "BTC"
      : token === "eth" || token.includes("ethereum")
        ? "ETH"
        : token === "sol" || token.includes("solana")
          ? "SOL"
          : null;
  if (!asset) return null;

  if (asset !== "USDT") return { method: "cryptocurrency", asset, network: defaultNetworkFor(asset) };

  const network = normalized(option.config.network);
  if (network.includes("trc20") || network.includes("tron")) return { method: "cryptocurrency", asset, network: "TRC20" };
  if (network.includes("bep20") || network.includes("bsc") || network.includes("binance")) return { method: "cryptocurrency", asset, network: "BEP20" };
  if (network.includes("erc20") || network.includes("ethereum")) return { method: "cryptocurrency", asset, network: "ERC20" };
  return null;
}
