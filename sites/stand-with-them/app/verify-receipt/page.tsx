import { VerifyReceiptForm } from "@/components/verify-receipt-form";
import { BackLink } from "@/components/back-link";

export const metadata = { title: "Track Receipt" };

export default async function VerifyReceiptPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const query = await searchParams;
  return <main id="main-content"><section className="page-hero compact"><div className="shell page-hero-grid"><div><BackLink fallbackHref="/" label="Back to Home" /><p className="eyebrow"><span /> RECEIPT &amp; DONATION STATUS</p><h1>Track Receipt</h1></div><p>Use one receipt verification code to confirm the receipt and view the associated payment and fulfilment statuses.</p></div></section><section className="content-section"><div className="shell form-shell"><VerifyReceiptForm initialCode={query.code || ""} /><p className="disclosure">A valid receipt confirms a recorded submission. Payment confirmation and fulfilment are separate authorised stages and are shown independently.</p></div></section></main>;
}
