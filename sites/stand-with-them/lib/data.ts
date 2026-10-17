import { isSupabaseConfigured } from "@/lib/config";
import { createServiceClient } from "@/lib/supabase";
import type { PublicCategory } from "@/lib/types";

export const fallbackCategories: PublicCategory[] = [
  { id: "food-provisions", slug: "food-provisions", name: "Food & provisions", description: "Staple food, drinking water, and approved field provisions arranged for an eligible beneficiary.", icon: "utensils", suggested_amounts_minor: [2500, 5000, 10000] },
  { id: "data-bundles", slug: "data-bundles", name: "Data bundles", description: "Mobile data support fulfilled privately to the registered number linked to an eligible soldier tag.", icon: "signal", suggested_amounts_minor: [1000, 2500, 5000] },
  { id: "healthcare", slug: "healthcare", name: "Healthcare", description: "Approved medicines, first-aid materials, and other documented health-related necessities.", icon: "heart-pulse", suggested_amounts_minor: [5000, 10000, 25000] },
  { id: "clothing-essentials", slug: "clothing-essentials", name: "Clothing & essentials", description: "Approved clothing, hygiene items, and practical essentials selected for the intended beneficiary.", icon: "shirt", suggested_amounts_minor: [5000, 10000, 20000] },
  { id: "other-approved", slug: "other-approved", name: "Other approved necessities", description: "A controlled category for necessities reviewed and approved by authorised fulfilment personnel.", icon: "package", suggested_amounts_minor: [2500, 5000, 10000] },
  { id: "general-support", slug: "general-support", name: "General soldier support", description: "Flexible support held separately and allocated only through documented, authorised general-fund decisions.", icon: "shield", suggested_amounts_minor: [2500, 5000, 10000, 25000] },
];

export async function getPublicCategories() {
  if (!isSupabaseConfigured()) return fallbackCategories;
  const { data } = await createServiceClient()
    .from("support_categories")
    .select("id,slug,name,description,icon,suggested_amounts_minor")
    .eq("active", true)
    .order("sort_order");
  return (data?.length ? data : fallbackCategories) as PublicCategory[];
}

export async function getPublicMetrics() {
  if (!isSupabaseConfigured()) return null;
  const service = createServiceClient();
  const [{ count: confirmed }, { count: fulfilled }, { data: values }] = await Promise.all([
    service.from("donations").select("id", { count: "exact", head: true }).eq("payment_status", "confirmed"),
    service.from("donations").select("id", { count: "exact", head: true }).eq("fulfilment_status", "delivered"),
    service.from("donations").select("amount_minor,currency").eq("payment_status", "confirmed").eq("currency", "USD"),
  ]);
  if (!confirmed) return null;
  return {
    confirmed,
    fulfilled: fulfilled ?? 0,
    confirmedValueMinor: (values ?? []).reduce((total, row) => total + Number(row.amount_minor), 0),
    currency: "USD",
  };
}

export async function getPublicSetting<T>(key: string, fallback: T): Promise<T> {
  if (!isSupabaseConfigured()) return fallback;
  const { data } = await createServiceClient().from("app_settings").select("value").eq("key", key).eq("public", true).maybeSingle();
  return (data?.value as T | undefined) ?? fallback;
}

export async function getAdminOverview() {
  const service = createServiceClient();
  const [pending, confirmed, declined, awaiting, purchasing, awaitingDelivery, delivered, values] = await Promise.all([
    service.from("donations").select("id", { count: "exact", head: true }).eq("payment_status", "pending"),
    service.from("donations").select("id", { count: "exact", head: true }).eq("payment_status", "confirmed"),
    service.from("donations").select("id", { count: "exact", head: true }).eq("payment_status", "declined"),
    service.from("donations").select("id", { count: "exact", head: true }).eq("fulfilment_status", "awaiting_allocation"),
    service.from("donations").select("id", { count: "exact", head: true }).eq("fulfilment_status", "purchase_in_progress"),
    service.from("donations").select("id", { count: "exact", head: true }).eq("fulfilment_status", "awaiting_delivery"),
    service.from("donations").select("id", { count: "exact", head: true }).eq("fulfilment_status", "delivered"),
    service.from("donations").select("amount_minor").eq("payment_status", "confirmed").eq("currency", "USD"),
  ]);
  return {
    pending: pending.count ?? 0,
    confirmed: confirmed.count ?? 0,
    declined: declined.count ?? 0,
    awaiting: awaiting.count ?? 0,
    purchasing: purchasing.count ?? 0,
    awaitingDelivery: awaitingDelivery.count ?? 0,
    delivered: delivered.count ?? 0,
    confirmedValueMinor: (values.data ?? []).reduce((sum, row) => sum + Number(row.amount_minor), 0),
  };
}

export async function getAdminSoldiers() {
  const { data, error } = await createServiceClient()
    .from("soldiers")
    .select("id,tag,private_identifier,status,created_at,internal_notes,soldier_category_eligibility(category_id,support_categories(name))")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function getAdminPayments() {
  const { data, error } = await createServiceClient()
    .from("payment_submissions")
    .select("id,method,status,submitted_at,transaction_hash,reviewed_at,decline_reason,payment_evidence(id,original_filename,mime_type,size_bytes),donations(id,reference,soldier_tag_snapshot,amount_minor,currency,support_categories(name),receipts(id))")
    .order("submitted_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function getFulfilmentQueue() {
  const { data, error } = await createServiceClient()
    .from("donations")
    .select("id,reference,soldier_tag_snapshot,amount_minor,currency,payment_status,fulfilment_status,created_at,support_categories(name),fund_allocations(id,amount_minor,allocated_at),purchases(id,items,actual_cost_minor,purchased_at),fulfilment_evidence(id,original_filename,mime_type,size_bytes)")
    .eq("payment_status", "confirmed")
    .eq("kind", "soldier")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function getPaymentOptions() {
  const { data, error } = await createServiceClient().from("payment_options").select("*").order("sort_order");
  if (error) throw error;
  return data ?? [];
}
