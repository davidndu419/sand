import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatMoney } from "@/lib/domain";
import { getAdminOverview } from "@/lib/data";

export const metadata = { title: "Admin Overview" };

export default async function AdminOverviewPage({ searchParams }: { searchParams: Promise<{ forbidden?: string }> }) {
  const [metrics, query] = await Promise.all([getAdminOverview(), searchParams]);
  const cards = [
    ["Pending verifications", metrics.pending], ["Confirmed donations", metrics.confirmed],
    ["Declined submissions", metrics.declined], ["Confirmed donation value", formatMoney(metrics.confirmedValueMinor)],
    ["Awaiting allocation", metrics.awaiting], ["Purchases in progress", metrics.purchasing],
    ["Awaiting delivery", metrics.awaitingDelivery], ["Completed fulfilments", metrics.delivered],
  ];
  return <>{query.forbidden && <div className="form-error">Your role does not permit access to that module.</div>}<header className="admin-page-head"><div><h1>Operational overview</h1><p>Only confirmed payments contribute to confirmed value; fulfilment metrics use their own status.</p></div></header><section className="metric-cards">{cards.map(([label, value]) => <article className="metric-card" key={label}><span>{label}</span><strong>{value}</strong></article>)}</section><section className="admin-panel"><h2>Priority workflows</h2><div className="choice-grid"><article className="choice-card"><h2>Payment verification</h2><p>Review pending gift-card and cryptocurrency submissions, private evidence, and audit-safe status changes.</p><Link className="button button-navy" href="/admin/payments">Open queue <ArrowRight size={16} /></Link></article><article className="choice-card"><h2>Allocation &amp; fulfilment</h2><p>Allocate confirmed funds, record purchases or services, upload evidence, and confirm delivery separately.</p><Link className="button button-outline" href="/admin/fulfilment">Open fulfilment <ArrowRight size={16} /></Link></article></div></section></>;
}
