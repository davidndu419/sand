import Link from "next/link";
import { ArrowRight, Shield, Users } from "lucide-react";
import { BackLink } from "@/components/back-link";

export const metadata = { title: "Donate" };

export default function DonatePage() {
  return <main id="main-content"><section className="page-hero"><div className="shell page-hero-grid"><div><BackLink fallbackHref="/" label="Back to Home" /><p className="eyebrow"><span /> CHOOSE HOW TO HELP</p><h1>Make your support specific.</h1></div><p>Support a verified soldier using an administrator-issued tag, or contribute to the separately managed general support fund. Every payment starts as pending and every fulfilment step is recorded independently.</p></div></section><section className="content-section"><div className="shell choice-grid"><article className="choice-card"><div className="category-icon"><Shield /></div><h2>Support a specific soldier</h2><p>Enter a private soldier tag, choose an eligible support category, submit payment evidence, and retain your receipt verification code.</p><Link className="button button-navy" href="/donate/soldier">Use a soldier tag <ArrowRight size={17} /></Link></article><article className="choice-card"><div className="category-icon"><Users /></div><h2>General soldier support</h2><p>Contribute without naming a beneficiary. General donations are accounted for separately and may be allocated only through authorised records.</p><Link className="button button-outline" href="/donate/general">Support the general fund <ArrowRight size={17} /></Link></article></div></section></main>;
}
