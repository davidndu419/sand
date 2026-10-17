"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { formatMoney } from "@/lib/domain";
import { firstRelated } from "@/lib/relations";
import { StatusBadge } from "@/components/status-badge";
import { VerificationCodeButton } from "@/components/admin/verification-code-button";

type DonationRow = {
  id: string;
  reference: string;
  kind: string;
  soldier_tag_snapshot?: string | null;
  amount_minor: number;
  currency: string;
  payment_status: string;
  fulfilment_status: string;
  created_at: string;
  support_categories?: { name: string } | Array<{ name: string }> | null;
  payment_submissions?: Array<{ method: string }>;
  receipts?: Array<{ id: string }>;
};

export function DonationTable({ donations }: { donations: DonationRow[] }) {
  const [query, setQuery] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [fulfilmentStatus, setFulfilmentStatus] = useState("all");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return donations.filter((donation) => {
      const category = firstRelated(donation.support_categories)?.name ?? "";
      const searchable = [donation.reference, donation.soldier_tag_snapshot, category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (!needle || searchable.includes(needle))
        && (paymentStatus === "all" || donation.payment_status === paymentStatus)
        && (fulfilmentStatus === "all" || donation.fulfilment_status === fulfilmentStatus);
    });
  }, [donations, fulfilmentStatus, paymentStatus, query]);

  return <>
    <div className="admin-filters" aria-label="Donation filters">
      <label className="filter-search"><span>Search records</span><div><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Reference, tag, or category" /></div></label>
      <label><span>Payment</span><select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}><option value="all">All payment states</option><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="declined">Declined</option></select></label>
      <label><span>Fulfilment</span><select value={fulfilmentStatus} onChange={(event) => setFulfilmentStatus(event.target.value)}><option value="all">All fulfilment states</option><option value="awaiting_payment_confirmation">Awaiting payment</option><option value="awaiting_allocation">Awaiting allocation</option><option value="funds_allocated">Funds allocated</option><option value="purchase_in_progress">Purchase in progress</option><option value="awaiting_delivery">Awaiting delivery</option><option value="delivered">Delivered</option><option value="unable_to_fulfil">Unable to fulfil</option><option value="cancelled">Cancelled</option></select></label>
    </div>
    <p className="filter-count" aria-live="polite">Showing {filtered.length} of {donations.length} records</p>
    {!filtered.length ? <div className="empty-state"><h3>No matching donations</h3><p>Adjust the search or status filters.</p></div> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Reference</th><th>Verification code</th><th>Type</th><th>Beneficiary</th><th>Category</th><th>Amount</th><th>Payment</th><th>Fulfilment</th><th>Recorded</th></tr></thead><tbody>{filtered.map((donation) => <tr key={donation.id}><td><strong>{donation.reference}</strong></td><td><VerificationCodeButton receiptId={firstRelated(donation.receipts)?.id} /></td><td>{donation.kind}</td><td>{donation.soldier_tag_snapshot || "General"}</td><td>{firstRelated(donation.support_categories)?.name}</td><td>{formatMoney(Number(donation.amount_minor), donation.currency)}</td><td><StatusBadge value={donation.payment_status} /></td><td><StatusBadge value={donation.fulfilment_status} /></td><td>{new Date(donation.created_at).toLocaleString()}</td></tr>)}</tbody></table></div>}
  </>;
}
