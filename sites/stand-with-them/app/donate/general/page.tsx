import { DonationForm } from "@/components/donation-form";
import { getPublicCategories } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "General Support" };

export default async function GeneralDonationPage() {
  return <main id="main-content"><section className="page-hero compact"><div className="shell page-hero-grid"><div><p className="eyebrow"><span /> GENERAL SUPPORT FUND</p><h1>Support where it is approved.</h1></div><p>General contributions remain distinct from soldier-specific donations. Allocation, expenditure, and any balance are recorded in the general-fund ledger.</p></div></section><section className="content-section"><div className="shell form-shell"><DonationForm kind="general" categories={await getPublicCategories()} initialCategory="general-support" /></div></section></main>;
}
