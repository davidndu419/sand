import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/config";
import { enforceRateLimit, safeError } from "@/lib/security";
import { createServiceClient } from "@/lib/supabase";

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Tracking is temporarily unavailable." }, { status: 503 });
  try {
    const limited = await enforceRateLimit(request, "donation-track", 10, 600);
    if (limited) return limited;
    const url = new URL(request.url);
    const reference = url.searchParams.get("reference")?.trim().toUpperCase();
    const accessCode = url.searchParams.get("access")?.trim().toUpperCase();
    if (!reference || !accessCode) return NextResponse.json({ found: false });
    const { data, error } = await createServiceClient().rpc("public_track_donation", {
      p_reference: reference,
      p_access_code: accessCode,
    });
    if (error) throw error;
    return NextResponse.json(data ? { found: true, donation: data } : { found: false });
  } catch (error) {
    return NextResponse.json({ error: safeError(error) }, { status: 500 });
  }
}
