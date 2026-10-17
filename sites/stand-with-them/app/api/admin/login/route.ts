import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/config";
import { isSameOrigin, safeError } from "@/lib/security";
import { createAuthClient, createServiceClient } from "@/lib/supabase";
import { adminLoginSchema } from "@/lib/validation";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Administrator access is not configured." }, { status: 503 });
  try {
    const parsed = adminLoginSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
    const auth = await createAuthClient();
    const { data, error } = await auth.auth.signInWithPassword(parsed.data);
    if (error || !data.user) return NextResponse.json({ error: "Invalid administrator credentials." }, { status: 401 });
    const { data: profile } = await createServiceClient()
      .from("admin_profiles")
      .select("active")
      .eq("id", data.user.id)
      .maybeSingle();
    if (!profile?.active) {
      await auth.auth.signOut();
      return NextResponse.json({ error: "This account is not authorised for administration." }, { status: 403 });
    }
    const { data: assurance } = await auth.auth.mfa.getAuthenticatorAssuranceLevel();
    const mustUseMfa = process.env.REQUIRE_ADMIN_MFA === "true";
    if ((assurance?.nextLevel === "aal2" || mustUseMfa) && assurance?.currentLevel !== "aal2") {
      const { data: factors } = await auth.auth.mfa.listFactors();
      const factor = factors?.totp.find((item) => item.status === "verified");
      if (!factor) {
        await auth.auth.signOut();
        return NextResponse.json({ error: "Multi-factor authentication is required, but this account has no verified TOTP factor." }, { status: 403 });
      }
      return NextResponse.json({ ok: false, mfaRequired: true, factorId: factor.id });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: safeError(error, "Sign-in could not be completed.") }, { status: 500 });
  }
}
