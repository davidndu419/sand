import { beforeAll, describe, expect, it } from "vitest";
import {
  canTransitionFulfilment,
  canTransitionPayment,
  decryptSensitiveValue,
  encryptSensitiveValue,
  generateSoldierTag,
  roleCan,
} from "@/lib/domain";
import { fulfilmentSchema, paymentSchema, reviewPaymentSchema, soldierTagSchema, startDonationSchema } from "@/lib/validation";

beforeAll(() => {
  const bytes = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
  process.env.PAYMENT_ENCRYPTION_KEY_BASE64 = Buffer.from(bytes).toString("base64");
});

describe("soldier tag security", () => {
  it("generates server-formatted tags without ambiguous characters", () => {
    const tags = new Set(Array.from({ length: 500 }, () => generateSoldierTag()));
    expect(tags.size).toBe(500);
    for (const tag of tags) expect(tag).toMatch(/^SLD-[A-HJ-NP-Z2-9]{8}$/);
  });

  it("rejects arbitrary public tag formats", () => {
    expect(soldierTagSchema.safeParse("my-soldier").success).toBe(false);
    expect(soldierTagSchema.safeParse("sld-7k4p9x2m").success).toBe(true);
  });
});

describe("state machines", () => {
  it("allows one-way payment review only", () => {
    expect(canTransitionPayment("pending", "confirmed")).toBe(true);
    expect(canTransitionPayment("pending", "declined")).toBe(true);
    expect(canTransitionPayment("confirmed", "declined")).toBe(false);
    expect(canTransitionPayment("declined", "confirmed")).toBe(false);
  });

  it("does not turn confirmed payment into completed fulfilment", () => {
    expect(canTransitionFulfilment("awaiting_payment_confirmation", "delivered")).toBe(false);
    expect(canTransitionFulfilment("awaiting_allocation", "delivered")).toBe(false);
    expect(canTransitionFulfilment("purchase_in_progress", "delivered")).toBe(true);
    expect(canTransitionFulfilment("delivered", "awaiting_delivery")).toBe(false);
  });
});

describe("roles and sensitive values", () => {
  it("applies least-privilege role checks", () => {
    expect(roleCan("payment_reviewer", "review_payments")).toBe(true);
    expect(roleCan("payment_reviewer", "manage_fulfilment")).toBe(false);
    expect(roleCan("fulfilment_manager", "manage_soldiers")).toBe(true);
    expect(roleCan("fulfilment_manager", "manage_settings")).toBe(false);
  });

  it("encrypts credentials with a random IV and decrypts them", async () => {
    const first = await encryptSensitiveValue("sensitive-code");
    const second = await encryptSensitiveValue("sensitive-code");
    expect(first).not.toBe(second);
    expect(first).not.toContain("sensitive-code");
    expect(await decryptSensitiveValue(first)).toBe("sensitive-code");
  });
});

describe("donation validation", () => {
  it("requires a soldier tag for soldier-specific donations", () => {
    expect(startDonationSchema.safeParse({ kind: "soldier", categorySlug: "food-provisions", amountMinor: 5000, currency: "USD" }).success).toBe(false);
    expect(startDonationSchema.safeParse({ kind: "general", categorySlug: "general-support", amountMinor: 5000, currency: "USD" }).success).toBe(true);
  });

  it("requires the appropriate manual-payment evidence fields", () => {
    expect(paymentSchema.safeParse({ accessCode: "A".repeat(36), method: "gift_card", paymentOptionId: crypto.randomUUID() }).success).toBe(false);
    expect(paymentSchema.safeParse({ accessCode: "A".repeat(36), method: "cryptocurrency", paymentOptionId: crypto.randomUUID(), transactionHash: "0x1234567890abcdef" }).success).toBe(true);
  });

  it("rejects non-integer, too-small, and excessive donation amounts", () => {
    const base = { kind: "general", categorySlug: "general-support", currency: "USD" } as const;
    expect(startDonationSchema.safeParse({ ...base, amountMinor: 99 }).success).toBe(false);
    expect(startDonationSchema.safeParse({ ...base, amountMinor: 100.5 }).success).toBe(false);
    expect(startDonationSchema.safeParse({ ...base, amountMinor: 100_000_001 }).success).toBe(false);
  });

  it("normalises currency codes and validates donor contact fields", () => {
    const parsed = startDonationSchema.safeParse({ kind: "general", categorySlug: "general-support", amountMinor: 5000, currency: "usd", donorEmail: "donor@example.org" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.currency).toBe("USD");
    expect(startDonationSchema.safeParse({ kind: "general", categorySlug: "general-support", amountMinor: 5000, currency: "USD", donorEmail: "not-an-email" }).success).toBe(false);
  });

  it("requires a reason before a payment can be declined", () => {
    expect(reviewPaymentSchema.safeParse({ status: "declined" }).success).toBe(false);
    expect(reviewPaymentSchema.safeParse({ status: "declined", declineReason: "Evidence did not match the submission." }).success).toBe(true);
    expect(reviewPaymentSchema.safeParse({ status: "confirmed" }).success).toBe(true);
  });

  it("rejects malformed transaction hashes and gift-card codes", () => {
    const paymentOptionId = crypto.randomUUID();
    expect(paymentSchema.safeParse({ accessCode: "A".repeat(36), method: "cryptocurrency", paymentOptionId, transactionHash: "short" }).success).toBe(false);
    expect(paymentSchema.safeParse({ accessCode: "A".repeat(36), method: "gift_card", paymentOptionId, giftCardCode: "123" }).success).toBe(false);
  });

  it("requires positive allocation amounts and bounded fulfilment notes", () => {
    const donationId = crypto.randomUUID();
    expect(fulfilmentSchema.safeParse({ donationId, action: "allocate", amountMinor: 0 }).success).toBe(false);
    expect(fulfilmentSchema.safeParse({ donationId, action: "allocate", amountMinor: 2500, note: "Approved allocation" }).success).toBe(true);
    expect(fulfilmentSchema.safeParse({ donationId, action: "status", status: "delivered", note: "x".repeat(2001) }).success).toBe(false);
  });
});
