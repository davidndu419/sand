import { describe, expect, it } from "vitest";
import {
  CRYPTO_ASSETS,
  defaultCryptoInstructions,
  defaultGiftCardInstructions,
  describePaymentOption,
  GIFT_CARD_TYPES,
  USDT_NETWORKS,
} from "@/lib/payment-options";

function option(method: "gift_card" | "cryptocurrency", label: string, config: Record<string, unknown>) {
  return { id: crypto.randomUUID(), method, label, instructions: "Payment instructions", config };
}

describe("payment option presets", () => {
  it("limits gift cards and cryptocurrencies to the supported defaults", () => {
    expect(GIFT_CARD_TYPES.map((item) => item.value)).toEqual(["apple", "razer", "xbox"]);
    expect(CRYPTO_ASSETS.map((item) => item.value)).toEqual(["BTC", "USDT", "ETH", "SOL"]);
    expect(USDT_NETWORKS).toEqual(["TRC20", "BEP20", "ERC20"]);
  });

  it("recognises canonical and legacy gift card configurations", () => {
    expect(describePaymentOption(option("gift_card", "Apple Gift Card", { gift_card_type: "apple" }))).toEqual({ method: "gift_card", giftCardType: "apple" });
    expect(describePaymentOption(option("gift_card", "Razer card", { gift_card_type: "Razer Gold Gift Card" }))).toEqual({ method: "gift_card", giftCardType: "razer" });
    expect(describePaymentOption(option("gift_card", "Steam", { gift_card_type: "steam" }))).toBeNull();
  });

  it("creates card-specific default public instructions", () => {
    expect(defaultGiftCardInstructions("apple")).toContain("new Apple Gift Card");
    expect(defaultGiftCardInstructions("razer")).toContain("new Razer Gold Gift Card");
    expect(defaultGiftCardInstructions("xbox")).toContain("new Xbox Gift Card");
  });

  it("normalises USDT networks and rejects unsupported networks", () => {
    expect(describePaymentOption(option("cryptocurrency", "USDT on Tron", { token: "USDT", network: "Tron TRC20" }))).toEqual({ method: "cryptocurrency", asset: "USDT", network: "TRC20" });
    expect(describePaymentOption(option("cryptocurrency", "USDT on Ethereum", { token: "USDT", network: "Ethereum" }))).toEqual({ method: "cryptocurrency", asset: "USDT", network: "ERC20" });
    expect(describePaymentOption(option("cryptocurrency", "USDT on Polygon", { token: "USDT", network: "Polygon" }))).toBeNull();
  });

  it("creates coin and network-specific default public instructions", () => {
    expect(defaultCryptoInstructions("BTC", "Bitcoin")).toContain("Bitcoin (BTC)");
    expect(defaultCryptoInstructions("USDT", "TRC20")).toContain("TRC20 network");
    expect(defaultCryptoInstructions("ETH", "ERC20")).toContain("Ethereum (ETH)");
    expect(defaultCryptoInstructions("SOL", "Solana")).toContain("Solana (SOL)");
  });
});
