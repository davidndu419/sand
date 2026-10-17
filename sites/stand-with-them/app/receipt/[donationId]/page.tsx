import { ReceiptView } from "@/components/receipt-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Donation Receipt" };

export default async function ReceiptPage({ params, searchParams }: { params: Promise<{ donationId: string }>; searchParams: Promise<{ code?: string; access?: string }> }) {
  const [{ donationId }, query] = await Promise.all([params, searchParams]);
  return <main id="main-content"><section className="page-hero compact"><div className="shell page-hero-grid"><div><p className="eyebrow"><span /> RECORDED SUBMISSION</p><h1>Your donation receipt.</h1></div><p>Keep both codes securely. The verification code checks receipt authenticity; the private tracking code shows the recorded donation timeline.</p></div></section><section className="content-section"><div className="shell">{query.code ? <ReceiptView donationId={donationId} code={query.code} accessCode={query.access || ""} /> : <div className="form-card form-shell"><div className="form-error">A receipt verification code is required.</div></div>}</div></section></main>;
}
