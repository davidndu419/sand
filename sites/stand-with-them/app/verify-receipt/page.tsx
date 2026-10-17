import { VerifyReceiptForm } from "@/components/verify-receipt-form";

export const metadata = { title: "Verify a Donation Receipt" };

export default async function VerifyReceiptPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const query = await searchParams;
  return <main id="main-content"><section className="page-hero compact"><div className="shell page-hero-grid"><div><p className="eyebrow"><span /> PUBLIC VERIFICATION</p><h1>Verify a Donation Receipt</h1></div><p>Enter your receipt verification code to check whether your donation has been recorded and whether its payment has been confirmed.</p></div></section><section className="content-section"><div className="shell form-shell"><VerifyReceiptForm initialCode={query.code || ""} /><p className="disclosure">A valid receipt confirms a recorded submission. It does not imply payment confirmation unless the current result explicitly says Confirmed.</p></div></section></main>;
}
