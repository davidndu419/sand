"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";

const links = [
  ["Mission", "/mission"],
  ["How it works", "/#how-it-works"],
  ["Verify receipt", "/verify-receipt"],
  ["Track", "/track-donation"],
  ["Contact", "/contact"],
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link href="/" className="brand-link" aria-label="Stand With Them home">
          <Image src="/brand/stand-with-them-logo.jpg" width={256} height={140} alt="Stand With Them" priority />
        </Link>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
        </nav>
        <div className="header-actions">
          <Link href="/donate" className="button button-gold button-small">Donate now</Link>
          <button type="button" className="menu-button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Toggle navigation">
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {links.map(([label, href]) => <Link key={href} href={href} onClick={() => setOpen(false)}>{label}</Link>)}
          <Link href="/admin/login" onClick={() => setOpen(false)}>Administrator sign in</Link>
        </nav>
      )}
    </header>
  );
}
