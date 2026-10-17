import { TrackDonationForm } from "@/components/track-donation-form";

export const metadata = { title: "Track a Donation" };

export default function TrackDonationPage() {
  return <main id="main-content"><section className="page-hero compact"><div className="shell page-hero-grid"><div><p className="eyebrow"><span /> RECORDED PROGRESS</p><h1>Track your donation.</h1></div><p>Use the donation reference and private tracking code issued with your receipt. The timeline includes only events that authorised personnel actually recorded.</p></div></section><section className="content-section"><div className="shell form-shell"><TrackDonationForm /></div></section></main>;
}
