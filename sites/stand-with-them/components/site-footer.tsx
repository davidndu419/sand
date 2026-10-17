import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getPublicSetting } from "@/lib/data";

export async function SiteFooter() {
  const [emailSetting, phoneSetting] = await Promise.all([
    getPublicSetting<string | null>("contact.email", null),
    getPublicSetting<string | null>("contact.phone", null),
  ]);
  const email = typeof emailSetting === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailSetting) ? emailSetting : null;
  const phone = typeof phoneSetting === "string" && /^[+()0-9.\-\s]{6,40}$/.test(phoneSetting) ? phoneSetting : null;
  const phoneHref = phone ? phone.replace(/[^+\d]/g, "").replace(/(?!^)\+/g, "") : "";
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div>
          <p className="footer-kicker">Stand With Them</p>
          <h2>Your Support.<br />Their Strength.</h2>
          <p className="footer-copy">A controlled giving platform for practical support, accountable payment review, and documented fulfilment.</p>
        </div>
        <div className="footer-links">
          <div><p>Explore</p><Link href="/">Home</Link><Link href="/mission">Our mission</Link><Link href="/donate">Support / Donate</Link></div>
          <div><p>Trust</p><Link href="/verify-receipt">Track Receipt</Link><Link href="/privacy">Privacy policy</Link><Link href="/donation-terms">Donation terms</Link></div>
          <div><p>Support</p><Link href="/contact">Contact</Link>{email && <a href={`mailto:${email}`}>{email}</a>}{phone && <a href={`tel:${phoneHref}`}>{phone}</a>}<a href="https://www.icrc.org/en/article/war-and-international-humanitarian-law" target="_blank" rel="noreferrer">Humanitarian law <ArrowUpRight size={13} /></a></div>
        </div>
      </div>
      <div className="shell footer-base"><p>© {new Date().getFullYear()} Stand With Them. All rights reserved.</p></div>
    </footer>
  );
}
