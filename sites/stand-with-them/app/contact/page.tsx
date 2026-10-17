import { Mail, Phone } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { getPublicSetting } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Contact" };

function telephoneHref(phone: string) {
  const cleaned = phone.replace(/[^+\d]/g, "");
  return `tel:${cleaned.replace(/(?!^)\+/g, "")}`;
}

export default async function ContactPage() {
  const [emailSetting, phoneSetting] = await Promise.all([
    getPublicSetting<string | null>("contact.email", null),
    getPublicSetting<string | null>("contact.phone", null),
  ]);
  const email = typeof emailSetting === "string" && isEmail(emailSetting) ? emailSetting : null;
  const phone = typeof phoneSetting === "string" && /^[+()0-9.\-\s]{6,40}$/.test(phoneSetting) ? phoneSetting : null;

  return <main id="main-content">
    <section className="page-hero compact"><div className="shell page-hero-grid"><div><BackLink fallbackHref="/" label="Back to Home" /><p className="eyebrow"><span /> CONTACT &amp; SUPPORT</p><h1>How can we help?</h1></div><p>Contact the support team about payment review, declined submissions, or receipt questions. Include only your receipt verification code.</p></div></section>
    <section className="content-section"><div className="shell content-grid">
      <article className="content-prose">
        <h2>Contact support</h2>
        {email || phone ? <div className="contact-method-grid">
          {email && <a className="contact-method-card" href={`mailto:${email}`}><Mail size={24} /><span><small>Support email</small><strong>{email}</strong><em>Send an email</em></span></a>}
          {phone && <a className="contact-method-card" href={telephoneHref(phone)}><Phone size={24} /><span><small>Support phone</small><strong>{phone}</strong><em>Call support</em></span></a>}
        </div> : <div className="form-info">Public contact details are being updated. Please use Track Receipt for current payment and fulfilment information.</div>}
        <h2>Before contacting us</h2>
        <p>Have your receipt verification code ready. It is the only receipt identifier the support team needs to locate the public status of your transaction.</p>
        <h2>Safety guidance</h2>
        <ul><li>Do not send soldier names, numbers, locations, units, or movements.</li><li>Do not email or text gift-card codes or unredacted payment evidence.</li><li>Use the private evidence upload during the donation flow.</li><li>Keep your receipt verification code secure.</li></ul>
      </article>
      <aside><div className="sidebar-card"><h3>Self-service tracking</h3><p>Use your verification code to check both payment review and fulfilment progress at any time.</p><p><a className="text-link" href="/verify-receipt">Track Receipt</a></p></div></aside>
    </div></section>
  </main>;
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}
