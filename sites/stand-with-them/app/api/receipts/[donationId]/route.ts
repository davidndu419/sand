import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/config";
import { enforceRateLimit, safeError } from "@/lib/security";
import { createServiceClient } from "@/lib/supabase";

export async function GET(request: Request, { params }: { params: Promise<{ donationId: string }> }) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Receipts are temporarily unavailable." }, { status: 503 });
  try {
    const limited = await enforceRateLimit(request, "receipt-view", 20, 600);
    if (limited) return limited;
    const { donationId } = await params;
    const code = new URL(request.url).searchParams.get("code");
    if (!code) return NextResponse.json({ error: "Verification code required." }, { status: 400 });
    const { data, error } = await createServiceClient().rpc("public_get_receipt", {
      p_donation_id: donationId,
      p_verification_code: code,
    });
    if (error || !data) return NextResponse.json({ error: "Receipt not found." }, { status: 404 });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: safeError(error) }, { status: 500 });
  }
}
