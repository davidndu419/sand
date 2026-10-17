import { SettingsManager } from "@/components/admin/settings-manager";
import { requireAdmin } from "@/lib/auth";
import { getPaymentOptions, getPublicSetting } from "@/lib/data";
import { createServiceClient } from "@/lib/supabase";

export const metadata = { title: "Payment, Contact & Content Settings" };

export default async function SettingsPage() {
  await requireAdmin("manage_settings");
  const [options, contactEmail, contactPhone, categoryResult] = await Promise.all([getPaymentOptions(), getPublicSetting<string | null>("contact.email", null), getPublicSetting<string | null>("contact.phone", null), createServiceClient().from("support_categories").select("id,name,active").order("sort_order")]);
  return <><header className="admin-page-head"><div><h1>Payment, contact &amp; content settings</h1><p>Manage public contact channels, payment instructions, and support availability through audited records.</p></div></header><SettingsManager options={options} categories={categoryResult.data ?? []} contactEmail={contactEmail} contactPhone={contactPhone} /></>;
}
