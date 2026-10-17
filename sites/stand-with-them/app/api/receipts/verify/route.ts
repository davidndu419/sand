import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/config";
import { enforceRateLimit, safeError } from "@/lib/security";
import { createServiceClient } from "@/lib/supabase";

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Verification is temporarily unavailable." }, { status: 503 });
  try {
    const limited = await enforceRateLimit(request, "receipt-verify", 10, 600);
    if (limited) return limited;
    const code = new URL(request.url).searchParams.get("code")?.trim().toUpperCase();
    if (!code || !/^[A-F0-9]{32}$/.test(code)) return NextResponse.json({ valid: false });
    const { data, error } = await createServiceClient().rpc("public_verify_receipt", {
      p_verification_code: code,
    });
    if (error) throw error;
    return NextResponse.json(data ? { valid: true, receipt: data } : { valid: false });
  } catch (error) {
    return NextResponse.json({ error: safeError(error) }, { status: 500 });
  }
}
