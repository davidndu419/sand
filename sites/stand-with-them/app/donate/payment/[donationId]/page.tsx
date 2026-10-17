import { PaymentForm } from "@/components/payment-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Submit Payment" };

export default async function PaymentPage({ params, searchParams }: { params: Promise<{ donationId: string }>; searchParams: Promise<{ access?: string }> }) {
  const [{ donationId }, query] = await Promise.all([params, searchParams]);
  return <main id="main-content"><section className="page-hero compact"><div className="shell page-hero-grid"><div><p className="eyebrow"><span /> SECURE SUBMISSION</p><h1>Payment details and evidence.</h1></div><p>Use only the configured payment instructions shown below. Submission creates a pending receipt; it does not confirm value received.</p></div></section><section className="content-section"><div className="shell form-shell">{query.access ? <PaymentForm donationId={donationId} accessCode={query.access} /> : <div className="form-card"><div className="form-error">The private donation access code is missing. Return to the donation flow and start again.</div></div>}</div></section></main>;
}
