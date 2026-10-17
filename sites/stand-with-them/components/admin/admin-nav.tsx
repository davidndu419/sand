"use client";

import Link from "next/link";
import { ClipboardCheck, FileClock, HandCoins, LayoutDashboard, LogOut, PackageCheck, Settings, ShieldCheck, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import type { AdminProfile } from "@/lib/types";

const links = [
  ["Overview", "/admin", LayoutDashboard],
  ["Soldiers", "/admin/soldiers", Users],
  ["Donations", "/admin/donations", HandCoins],
  ["Payment review", "/admin/payments", ClipboardCheck],
  ["Fulfilment", "/admin/fulfilment", PackageCheck],
  ["General fund", "/admin/general-fund", ShieldCheck],
  ["Audit history", "/admin/audit", FileClock],
  ["Settings", "/admin/settings", Settings],
] as const;

export function AdminNav({ admin }: { admin: AdminProfile }) {
  const router = useRouter();
  async function logout() { await fetch("/api/admin/logout", { method: "POST" }); router.push("/admin/login"); router.refresh(); }
  return <aside className="admin-sidebar"><div className="admin-name"><strong>{admin.display_name}</strong><span>{admin.role.replaceAll("_", " ")}</span></div><nav className="admin-nav" aria-label="Administrator navigation">{links.map(([label, href, Icon]) => <Link key={href} href={href}><Icon size={17} />{label}</Link>)}<button className="admin-logout" type="button" onClick={logout}><LogOut size={17} />Sign out</button></nav></aside>;
}
