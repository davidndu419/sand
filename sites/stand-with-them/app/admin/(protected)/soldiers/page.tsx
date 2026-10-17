import { SoldierManager } from "@/components/admin/soldier-manager";
import { requireAdmin } from "@/lib/auth";
import { getAdminSoldiers } from "@/lib/data";
import { createServiceClient } from "@/lib/supabase";

export const metadata = { title: "Soldier Management" };

export default async function SoldiersPage() {
  await requireAdmin("manage_soldiers");
  const [soldiers, categoriesResult] = await Promise.all([
    getAdminSoldiers(),
    createServiceClient().from("support_categories").select("id,name").eq("active", true).order("sort_order"),
  ]);
  return <><header className="admin-page-head"><div><h1>Soldier management</h1><p>Register the minimum necessary information, generate non-reassignable tags, and control eligibility.</p></div></header><SoldierManager soldiers={soldiers} categories={categoriesResult.data ?? []} /></>;
}
