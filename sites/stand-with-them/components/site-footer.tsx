import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div>
          <p className="footer-kicker">Stand With Them</p>
          <h2>Your Support.<br />Their Strength.</h2>
          <p className="footer-copy">A controlled giving platform for practical support, accountable payment review, and documented fulfilment.</p>
        </div>
        <div className="footer-links">
          <div><p>Explore</p><Link href="/mission">Our mission</Link><Link href="/donate">Donation process</Link><Link href="/track-donation">Track a donation</Link></div>
          <div><p>Trust</p><Link href="/verify-receipt">Verify receipt</Link><Link href="/privacy">Privacy policy</Link><Link href="/donation-terms">Donation terms</Link></div>
          <div><p>Support</p><Link href="/contact">Contact</Link><Link href="/admin/login">Admin portal</Link><a href="https://www.icrc.org/en/article/war-and-international-humanitarian-law" target="_blank" rel="noreferrer">Humanitarian law <ArrowUpRight size={13} /></a></div>
        </div>
      </div>
      <div className="shell footer-base">
        <p>© {new Date().getFullYear()} Stand With Them. All rights reserved.</p>
        
      </div>
    </footer>
  );
}
