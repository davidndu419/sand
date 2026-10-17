import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase";
import { DonationTable } from "@/components/admin/donation-table";

export const metadata = { title: "Donation Management" };

export default async function DonationsPage() {
  await requireAdmin();
  const { data: donations, error } = await createServiceClient().from("donations").select("id,reference,kind,soldier_tag_snapshot,amount_minor,currency,payment_status,fulfilment_status,created_at,support_categories(name),payment_submissions!inner(method),receipts!inner(id)").order("created_at", { ascending: false }).limit(300);
  if (error) throw error;
  return <><header className="admin-page-head"><div><h1>Donation management</h1><p>Searchable operational records keep beneficiary intention, payment, and fulfilment status together without merging their meanings.</p></div></header><section className="admin-panel">{!donations?.length ? <div className="empty-state"><h3>No donations recorded</h3><p>Completed public submissions will appear here.</p></div> : <DonationTable donations={donations} />}</section></>;
}
