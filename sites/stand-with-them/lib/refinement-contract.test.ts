import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("public refinement contract", () => {
  it("exposes one Track Receipt destination without advertising administration", () => {
    const navigation = `${source("components/site-header.tsx")}\n${source("components/site-footer.tsx")}`;
    expect(navigation).toContain("Track Receipt");
    expect(navigation).not.toContain("/track-donation");
    expect(navigation).not.toMatch(/\/admin(?:\/login)?/);
  });

  it("redirects the retired donation-tracking page to Track Receipt", () => {
    const legacyPage = source("app/track-donation/page.tsx");
    expect(legacyPage).toContain('redirect("/verify-receipt")');
  });

  it("does not request a cryptocurrency transaction hash from donors", () => {
    const paymentForm = source("components/payment-form.tsx");
    const paymentRoute = source("app/api/donations/[donationId]/payment/route.ts");
    expect(paymentForm).not.toContain("transactionHash");
    expect(paymentRoute).not.toContain('form.get("transactionHash")');
    expect(paymentRoute).toContain("p_transaction_hash: null");
  });

  it("retries only the legacy donation-reference constraint failure", () => {
    const donationRoute = source("app/api/donations/start/route.ts");
    expect(donationRoute).toContain('result.error?.code === "23514"');
    expect(donationRoute).toContain('result.error.message.includes("donations_reference_check")');
    expect(donationRoute).toContain("attempt < 5");
  });

  it("uses one donor-facing receipt verification code", () => {
    const publicReceipt = `${source("components/receipt-view.tsx")}\n${source("components/verify-receipt-form.tsx")}\n${source("app/api/receipts/[donationId]/pdf/route.ts")}`;
    expect(publicReceipt).toContain("Receipt verification code");
    expect(publicReceipt).not.toContain("Receipt number");
    expect(publicReceipt).not.toContain("Donation reference");
    expect(source("app/api/donations/[donationId]/payment/route.ts")).toContain("randomCode(20)");
    expect(source("app/api/donations/[donationId]/payment/route.ts")).toContain("p_verification_code_ciphertext");
  });

  it("shows fulfilment status only for soldier-specific receipts", () => {
    const receiptView = source("components/receipt-view.tsx");
    const receiptTracker = source("components/verify-receipt-form.tsx");
    const receiptPdf = source("app/api/receipts/[donationId]/pdf/route.ts");
    expect(receiptView).toContain("{receipt.soldier_tag && <div><span>Fulfilment status</span>");
    expect(receiptTracker).toContain("{result.soldier_tag && <div><span>Fulfilment status</span>");
    expect(receiptPdf).toContain('if (data.soldier_tag) rows.push(["Fulfilment status"');
  });

  it("reveals encrypted verification codes only through an authorised admin endpoint", () => {
    const route = source("app/api/admin/receipts/[receiptId]/verification-code/route.ts");
    expect(route).toContain("authorizeAdmin()");
    expect(route).toContain("decryptSensitiveValue");
    expect(route).toContain('"cache-control": "private, no-store"');
    expect(source("components/admin/verification-code-button.tsx")).toContain("Reveal code");
  });

  it("publishes editable email and phone contact channels", () => {
    const contactPage = source("app/contact/page.tsx");
    const footer = source("components/site-footer.tsx");
    const settings = source("components/admin/settings-manager.tsx");
    expect(contactPage).toContain('"contact.email"');
    expect(contactPage).toContain('"contact.phone"');
    expect(contactPage).toContain("mailto:");
    expect(contactPage).toContain("tel:");
    expect(footer).toContain('"contact.email"');
    expect(footer).toContain('"contact.phone"');
    expect(settings).toContain("/api/admin/settings/contact");
    expect(settings).toContain("Support phone number");
  });
});

describe("administrator protection contract", () => {
  it("protects the /admin route through its server layout", () => {
    expect(source("app/admin/(protected)/layout.tsx")).toContain("requireAdmin()");
  });

  it("authorises every sensitive administrator endpoint independently", () => {
    const protectedRoutes = [
      "app/api/admin/categories/[categoryId]/route.ts",
      "app/api/admin/evidence/[evidenceId]/route.ts",
      "app/api/admin/fulfilment/route.ts",
      "app/api/admin/fulfilment-evidence/route.ts",
      "app/api/admin/fulfilment-evidence/[evidenceId]/route.ts",
      "app/api/admin/general-fund/route.ts",
      "app/api/admin/payment-options/route.ts",
      "app/api/admin/payment-options/[optionId]/route.ts",
      "app/api/admin/payments/[paymentId]/route.ts",
      "app/api/admin/receipts/[receiptId]/verification-code/route.ts",
      "app/api/admin/settings/route.ts",
      "app/api/admin/settings/contact/route.ts",
      "app/api/admin/soldiers/route.ts",
      "app/api/admin/soldiers/[soldierId]/route.ts",
    ];

    for (const route of protectedRoutes) {
      expect(source(route), route).toContain("authorizeAdmin(");
    }
  });
});
