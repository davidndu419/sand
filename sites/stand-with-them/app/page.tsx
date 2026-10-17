import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ClipboardCheck, Eye, HandHeart, LockKeyhole, PackageCheck, ShieldCheck } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { formatMoney } from "@/lib/domain";
import { getPublicCategories, getPublicMetrics } from "@/lib/data";

export const dynamic = "force-dynamic";

const steps = [
  ["01", "Choose a beneficiary", "Use a private soldier tag or select the general support fund."],
  ["02", "Select support", "Choose an eligible category and contribution amount."],
  ["03", "Submit payment", "Send gift-card or cryptocurrency details through the secure form."],
  ["04", "Payment verified", "An authorised reviewer confirms or declines the submission."],
  ["05", "Support arranged", "Confirmed funds are allocated and purchases are documented."],
  ["06", "Fulfilment recorded", "Authorised personnel confirm the real delivery or service."],
];

export default async function Home() {
  const [categories, metrics] = await Promise.all([getPublicCategories(), getPublicMetrics()]);
  return (
    <main id="main-content">
      <section className="hero">
        <div className="shell hero-grid">
          <div className="hero-copy">
            <p className="eyebrow"><span />ACCOUNTABLE SUPPORT, FROM DONOR TO DELIVERY</p>
            <h1>Stand With Those Who Stand on the Frontline.</h1>
            <p className="hero-lead">Help provide food, data bundles, healthcare, and essential supplies to soldiers at the frontline. Choose the support you want to provide and follow your contribution from payment verification through to fulfilment.</p>
            <div className="button-row">
              <Link href="/donate/soldier" className="button button-gold">Support a soldier <ArrowRight size={18} /></Link>
              <Link href="#how-it-works" className="button button-ghost">How it works</Link>
            </div>
            <div className="hero-assurances">
              <span><ShieldCheck size={17} /> Admin-issued tags only</span>
              <span><ClipboardCheck size={17} /> Manual payment review</span>
              <span><Eye size={17} /> Track recorded progress</span>
            </div>
          </div>
          <figure className="hero-visual">
            <Image src="/brand/humanitarian-aid.jpg" fill sizes="(max-width: 900px) 100vw, 46vw" priority alt="Service members loading pallets of humanitarian aid onto an aircraft" />
            <div className="hero-visual-shade" />
            <figcaption><span> photograph</span> Humanitarian supplies prepared for delivery.</figcaption>
          </figure>
        </div>
      </section>

      <section className="trust-bar" aria-label="Accountability commitments">
        <div className="shell trust-grid">
          <div><LockKeyhole /><p><strong>Privacy by design</strong><span>Beneficiary details stay private.</span></p></div>
          <div><CheckCircle2 /><p><strong>Verified before counted</strong><span>Submitted is never presented as confirmed.</span></p></div>
          <div><PackageCheck /><p><strong>Fulfilment is separate</strong><span>Delivery requires an authorised record.</span></p></div>
        </div>
      </section>

      <section className="section mission-intro">
        <div className="shell split-heading">
          <div><p className="eyebrow dark"><span /> WHY THIS PLATFORM EXISTS</p><h2>Practical support, handled with dignity.</h2></div>
          <div className="prose-lead"><p>Stand With Them connects a donor’s intention to a controlled operational record. A donor may support one verified soldier without learning private identity or location details, while authorised staff handle allocation and fulfilment.</p><Link href="/mission" className="text-link">Read our mission <ArrowRight size={16} /></Link></div>
        </div>
      </section>

      <section className="section categories-section">
        <div className="shell">
          <div className="section-heading"><p className="eyebrow dark"><span /> CHOOSE YOUR SUPPORT</p><h2>Support that meets a real need.</h2><p>Each category remains attached to the donation throughout review, allocation, purchase, and fulfilment.</p></div>
          <div className="category-grid">
            {categories.slice(0, 5).map((category, index) => (
              <article key={category.slug} className={`category-card category-${index + 1}`}>
                <div className="category-icon"><CategoryIcon name={category.icon} /></div>
                <p className="card-number">0{index + 1}</p>
                <h3>{category.name}</h3>
                <p>{category.description}</p>
                <Link href={`/donate/soldier?category=${category.slug}`} aria-label={`Donate for ${category.name}`}>Support this need <ArrowRight size={16} /></Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section process-section" id="how-it-works">
        <div className="shell">
          <div className="process-heading"><p className="eyebrow light"><span /> ONE TRACEABLE PROCESS</p><h2>From intention to documented fulfilment.</h2><p>A receipt proves the submission exists. Only an authorised review changes payment status; only a separate fulfilment record confirms delivery.</p></div>
          <ol className="process-grid">
            {steps.map(([number, title, text]) => <li key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}
          </ol>
        </div>
      </section>

      <section className="section transparency-section">
        <div className="shell transparency-grid">
          <div className="transparency-copy">
            <p className="eyebrow dark"><span /> TRANSPARENCY WITHOUT EXPOSURE</p>
            <h2>Clear records. Protected people.</h2>
            <p>Public pages show only the fields needed to verify a receipt or follow a donation. Donor contacts, soldier identity, mobile numbers, payment evidence, redemption credentials, and internal notes remain restricted.</p>
            <Link href="/verify-receipt" className="button button-navy">Verify a receipt <ArrowRight size={18} /></Link>
          </div>
          <div className="transparency-panel">
            {metrics ? (
              <><p className="panel-label">Verified platform records</p><div className="metric-grid"><div><strong>{metrics.confirmed}</strong><span>Confirmed donations</span></div><div><strong>{metrics.fulfilled}</strong><span>Completed fulfilments</span></div><div><strong>{formatMoney(metrics.confirmedValueMinor, metrics.currency)}</strong><span>Confirmed value</span></div></div><p className="metric-note">Only database-backed, confirmed records are included.</p></>
            ) : (
              <><p className="panel-label">How accountability works</p><ul className="assurance-list"><li><span>01</span><p><strong>Submission recorded</strong>A pending receipt is generated without claiming payment success.</p></li><li><span>02</span><p><strong>Reviewer decision</strong>An authorised administrator records confirmation or decline.</p></li><li><span>03</span><p><strong>Fulfilment evidence</strong>Allocation, purchase, and delivery remain separately documented.</p></li></ul><p className="metric-note">Public impact figures appear only after verified records exist.</p></>
            )}
          </div>
        </div>
      </section>

      <section className="section context-section">
        <div className="shell context-grid">
          <div className="context-mark"><HandHeart size={42} /></div>
          <div><p className="eyebrow dark"><span /> HUMANITARIAN CONTEXT</p><h2>Human dignity remains the standard.</h2></div>
          <div><p>International humanitarian law developed to limit suffering in armed conflict. The Geneva Conventions protect wounded and sick service members, prisoners, civilians, medical workers, and aid workers. Stand With Them is an independent support platform; it does not claim affiliation with the ICRC, United Nations, or any government.</p><a className="text-link" href="https://www.icrc.org/en/geneva-conventions-and-law" target="_blank" rel="noreferrer">Read the ICRC overview <ArrowRight size={16} /></a></div>
        </div>
      </section>

      <section className="final-cta">
        <div className="shell final-cta-inner"><div><p className="eyebrow light"><span /> A PRACTICAL ACT OF SUPPORT</p><h2>Your Support Can Make a Difference.</h2></div><Link href="/donate" className="button button-gold">Donate now <ArrowRight size={18} /></Link></div>
      </section>
    </main>
  );
}
