import { DonationForm } from "@/components/donation-form";
import { BackLink } from "@/components/back-link";
import { getPublicCategories } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Support a Soldier" };

export default async function SoldierDonationPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const [categories, query] = await Promise.all([getPublicCategories(), searchParams]);
  return <main id="main-content"><section className="page-hero compact"><div className="shell page-hero-grid"><div><BackLink fallbackHref="/donate" label="Back to Support" confirmMessage="Leave this donation form? Any details you entered will not be saved." /><p className="eyebrow"><span /> SOLDIER-SPECIFIC SUPPORT</p><h1>Start with a verified tag.</h1></div><p>A valid tag confirms only that the beneficiary is registered, active, and eligible for the chosen category. It never reveals identity, number, unit, or location.</p></div></section><section className="content-section"><div className="shell form-shell"><DonationForm kind="soldier" categories={categories} initialCategory={query.category} /></div></section></main>;
}
