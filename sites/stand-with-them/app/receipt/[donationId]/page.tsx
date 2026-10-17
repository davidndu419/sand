import { BackLink } from "@/components/back-link";
import { ReceiptView } from "@/components/receipt-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Donation Receipt" };

export default async function ReceiptPage({ params, searchParams }: { params: Promise<{ donationId: string }>; searchParams: Promise<{ code?: string }> }) {
  const [{ donationId }, query] = await Promise.all([params, searchParams]);
  return <main id="main-content"><section className="page-hero compact"><div className="shell page-hero-grid"><div><BackLink fallbackHref="/donate" label="Back to Support" /><p className="eyebrow"><span /> RECORDED SUBMISSION</p><h1>Your donation receipt.</h1></div><p>Keep the receipt verification code securely. It is the single code used to track the current status of this submission.</p></div></section><section className="content-section"><div className="shell">{query.code ? <ReceiptView donationId={donationId} code={query.code} /> : <div className="form-card form-shell"><div className="form-error">A receipt verification code is required.</div></div>}</div></section></main>;
}
