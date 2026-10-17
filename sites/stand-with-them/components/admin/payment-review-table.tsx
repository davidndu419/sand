"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ExternalLink, Loader2, Search } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { formatMoney } from "@/lib/domain";
import { firstRelated } from "@/lib/relations";

type Payment = {
  id: string;
  method: string;
  status: string;
  submitted_at: string;
  transaction_hash?: string | null;
  reviewed_at?: string | null;
  decline_reason?: string | null;
  payment_evidence?: Array<{ id: string; original_filename: string; mime_type: string; size_bytes: number }>;
  donations?: {
    id: string;
    reference: string;
    soldier_tag_snapshot?: string | null;
    amount_minor: number;
    currency: string;
    support_categories?: { name: string } | Array<{ name: string }> | null;
    receipts?: Array<{ receipt_number: string }>;
  } | Array<{
    id: string;
    reference: string;
    soldier_tag_snapshot?: string | null;
    amount_minor: number;
    currency: string;
    support_categories?: { name: string } | Array<{ name: string }> | null;
    receipts?: Array<{ receipt_number: string }>;
  }> | null;
};

export function PaymentReviewTable({ payments }: { payments: Payment[] }) {
  const router = useRouter(); const [working, setWorking] = useState(""); const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [method, setMethod] = useState("all");
  const [status, setStatus] = useState("all");
  const [date, setDate] = useState("");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return payments.filter((payment) => {
      const donation = firstRelated(payment.donations);
      const receipt = firstRelated(donation?.receipts);
      const category = firstRelated(donation?.support_categories);
      const searchable = [donation?.reference, receipt?.receipt_number, donation?.soldier_tag_snapshot, category?.name, payment.transaction_hash]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (!needle || searchable.includes(needle))
        && (method === "all" || payment.method === method)
        && (status === "all" || payment.status === status)
        && (!date || payment.submitted_at.slice(0, 10) === date);
    });
  }, [date, method, payments, query, status]);
  async function decide(id: string, status: "confirmed" | "declined") { const declineReason = status === "declined" ? window.prompt("Enter the decline reason. This is required and will not expose sensitive evidence publicly.") : ""; if (status === "declined" && !declineReason) return; if (!window.confirm(`Record this payment as ${status}? This final decision cannot be repeated.`)) return; setWorking(id); setError(""); try { const response = await fetch(`/api/admin/payments/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status, declineReason, reviewNotes: "Decision recorded from the payment review queue." }) }); const body = await response.json() as { error?: string }; if (!response.ok) throw new Error(body.error || "Decision failed."); router.refresh(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Decision failed."); } finally { setWorking(""); } }
  if (!payments.length) return <div className="empty-state"><h3>No payment submissions</h3><p>Submitted gift-card and cryptocurrency payments will appear here.</p></div>;
  return <>{error && <div className="form-error">{error}</div>}<div className="admin-filters payment-filters" aria-label="Payment filters"><label className="filter-search"><span>Search records</span><div><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Reference, receipt, tag, category, or hash" /></div></label><label><span>Method</span><select value={method} onChange={(event) => setMethod(event.target.value)}><option value="all">All methods</option><option value="gift_card">Gift card</option><option value="cryptocurrency">Cryptocurrency</option></select></label><label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="declined">Declined</option></select></label><label><span>Submitted on</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label></div><p className="filter-count" aria-live="polite">Showing {filtered.length} of {payments.length} submissions</p>{!filtered.length ? <div className="empty-state"><h3>No matching payments</h3><p>Adjust the search, method, status, or date filters.</p></div> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Reference</th><th>Receipt</th><th>Beneficiary</th><th>Amount</th><th>Method</th><th>Status</th><th>Evidence</th><th>Decision</th></tr></thead><tbody>{filtered.map((payment) => { const donation = firstRelated(payment.donations); const receipt = firstRelated(donation?.receipts); const category = firstRelated(donation?.support_categories); const evidence = payment.payment_evidence?.[0]; return <tr key={payment.id}><td><strong>{donation?.reference}</strong><br /><small>{new Date(payment.submitted_at).toLocaleString()}</small></td><td>{receipt?.receipt_number || "—"}</td><td>{donation?.soldier_tag_snapshot || "General"}<br /><small>{category?.name || ""}</small></td><td>{donation ? formatMoney(Number(donation.amount_minor), donation.currency) : "—"}</td><td>{String(payment.method).replaceAll("_", " ")}{payment.transaction_hash && <><br /><small title={payment.transaction_hash}>{payment.transaction_hash.slice(0, 14)}…</small></>}</td><td><StatusBadge value={payment.status} /></td><td>{evidence ? <a className="table-button" href={`/api/admin/evidence/${evidence.id}`} target="_blank" rel="noreferrer">Open <ExternalLink size={12} /></a> : "—"}</td><td>{payment.status === "pending" ? <div className="table-actions"><button className="table-button" onClick={() => decide(payment.id, "confirmed")} disabled={working === payment.id}>{working === payment.id ? <Loader2 className="animate-spin" size={13} /> : "Confirm"}</button><button className="table-button danger" onClick={() => decide(payment.id, "declined")} disabled={working === payment.id}>Decline</button></div> : <small>{payment.reviewed_at ? new Date(payment.reviewed_at).toLocaleString() : "Reviewed"}{payment.decline_reason ? <><br />{payment.decline_reason}</> : null}</small>}</td></tr>; })}</tbody></table></div>}</>;
}
