import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/config";
import { roleCan } from "@/lib/domain";
import { createAuthClient, createServiceClient } from "@/lib/supabase";
import type { AdminProfile } from "@/lib/types";

export type AdminPermission = Parameters<typeof roleCan>[1];

export async function getCurrentAdmin(): Promise<AdminProfile | null> {
  if (!isSupabaseConfigured()) return null;
  const auth = await createAuthClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return null;
  const { data: assurance } = await auth.auth.mfa.getAuthenticatorAssuranceLevel();
  const mustUseMfa = process.env.REQUIRE_ADMIN_MFA === "true";
  if (
    (assurance?.nextLevel === "aal2" || mustUseMfa) &&
    assurance?.currentLevel !== "aal2"
  ) return null;
  const service = createServiceClient();
  const { data, error } = await service
    .from("admin_profiles")
    .select("id, role, display_name, active")
    .eq("id", user.id)
    .eq("active", true)
    .maybeSingle();
  if (error || !data) return null;
  return data as AdminProfile;
}

export async function requireAdmin(permission?: AdminPermission) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  if (permission && !roleCan(admin.role, permission)) redirect("/admin?forbidden=1");
  return admin;
}

export async function authorizeAdmin(permission?: AdminPermission) {
  const admin = await getCurrentAdmin();
  if (!admin) return { ok: false as const, status: 401, message: "Authentication required." };
  if (permission && !roleCan(admin.role, permission)) {
    return { ok: false as const, status: 403, message: "You do not have permission for this action." };
  }
  return { ok: true as const, admin };
}
