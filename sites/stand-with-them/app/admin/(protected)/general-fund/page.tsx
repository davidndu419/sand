import { requireAdmin } from "@/lib/auth";
import { formatMoney } from "@/lib/domain";
import { createServiceClient } from "@/lib/supabase";
import { firstRelated } from "@/lib/relations";
import { GeneralFundForm } from "@/components/admin/general-fund-form";

export const metadata = { title: "General Fund" };

export default async function GeneralFundPage() {
  await requireAdmin("manage_fulfilment");
  const service = createServiceClient();
  const [{ data: donations }, { data: transactions }] = await Promise.all([
    service.from("donations").select("id,reference,amount_minor,currency,payment_status,fulfilment_status,created_at,support_categories(name),payment_submissions!inner(id),receipts!inner(id)").eq("kind", "general").order("created_at", { ascending: false }),
    service.from("general_fund_transactions").select("id,transaction_type,amount_minor,description,recorded_at").order("recorded_at", { ascending: false }),
  ]);
  const contributions = (transactions ?? []).filter((item) => item.transaction_type === "contribution").reduce((sum, item) => sum + Number(item.amount_minor), 0);
  const movements = (transactions ?? []).filter((item) => item.transaction_type !== "contribution").reduce((sum, item) => sum + Number(item.amount_minor), 0);
  const confirmedGeneral = (donations ?? []).filter((item) => item.payment_status === "confirmed").map((item) => ({ id: String(item.id), reference: String(item.reference) }));
  return <><header className="admin-page-head"><div><h1>General fund</h1><p>General contributions and their authorised allocations remain distinct from soldier-specific records.</p></div></header><section className="metric-cards"><article className="metric-card"><span>Confirmed contributions</span><strong>{formatMoney(contributions)}</strong></article><article className="metric-card"><span>Recorded fund movements</span><strong>{formatMoney(movements)}</strong></article><article className="metric-card"><span>Calculated balance</span><strong>{formatMoney(contributions + movements)}</strong></article></section><GeneralFundForm donations={confirmedGeneral} /><section className="admin-panel"><h2>General donations</h2>{!donations?.length ? <div className="empty-state"><h3>No general-fund donations</h3></div> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Reference</th><th>Category</th><th>Amount</th><th>Payment</th><th>Fulfilment</th></tr></thead><tbody>{donations.map((item) => <tr key={item.id}><td><strong>{item.reference}</strong></td><td>{firstRelated(item.support_categories)?.name}</td><td>{formatMoney(Number(item.amount_minor), item.currency)}</td><td>{item.payment_status}</td><td>{item.fulfilment_status}</td></tr>)}</tbody></table></div>}</section><section className="admin-panel"><h2>General-fund ledger</h2>{!transactions?.length ? <div className="empty-state"><h3>No ledger movements</h3><p>Allocations and expenditures must be recorded explicitly; confirmed contributions are not silently treated as spent.</p></div> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Type</th><th>Amount</th><th>Description</th><th>Recorded</th></tr></thead><tbody>{transactions.map((item) => <tr key={item.id}><td>{item.transaction_type}</td><td>{formatMoney(Number(item.amount_minor))}</td><td>{item.description}</td><td>{new Date(item.recorded_at).toLocaleString()}</td></tr>)}</tbody></table></div>}</section></>;
}
