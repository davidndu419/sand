import { PaymentReviewTable } from "@/components/admin/payment-review-table";
import { requireAdmin } from "@/lib/auth";
import { getAdminPayments } from "@/lib/data";

export const metadata = { title: "Payment Verification" };

export default async function PaymentsPage() {
  await requireAdmin("review_payments");
  const payments = await getAdminPayments();
  return <><header className="admin-page-head"><div><h1>Receipt &amp; payment verification</h1><p>Review evidence and make a single final decision. A confirmation advances only to Awaiting Allocation.</p></div></header><section className="admin-panel"><PaymentReviewTable payments={payments} /></section></>;
}
