import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: { default: "Stand With Them", template: "%s | Stand With Them" },
  description: "Your Support. Their Strength. Provide practical support and follow each contribution from payment review through fulfilment.",
  icons: {
    icon: "/brand/stand-with-them-logo.jpg",
    shortcut: "/brand/stand-with-them-logo.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="skip-link">Skip to content</a>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
