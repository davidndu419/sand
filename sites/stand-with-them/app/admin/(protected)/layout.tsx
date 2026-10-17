import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return <div className="admin-shell"><div className="admin-layout"><AdminNav admin={admin} /><main id="main-content" className="admin-main">{children}</main></div></div>;
}
