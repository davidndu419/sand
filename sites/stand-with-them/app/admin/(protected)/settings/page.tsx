import { SettingsManager } from "@/components/admin/settings-manager";
import { requireAdmin } from "@/lib/auth";
import { getPaymentOptions, getPublicSetting } from "@/lib/data";
import { createServiceClient } from "@/lib/supabase";

export const metadata = { title: "Payment & Content Settings" };

export default async function SettingsPage() {
  await requireAdmin("manage_settings");
  const [options, contact, categoryResult] = await Promise.all([getPaymentOptions(), getPublicSetting<string | null>("contact.email", null), createServiceClient().from("support_categories").select("id,name,active").order("sort_order")]);
  return <><header className="admin-page-head"><div><h1>Payment &amp; content settings</h1><p>Wallets and accepted gift-card types come only from these audited records, never hardcoded frontend values.</p></div></header><SettingsManager options={options} categories={categoryResult.data ?? []} contactEmail={contact} /></>;
}
