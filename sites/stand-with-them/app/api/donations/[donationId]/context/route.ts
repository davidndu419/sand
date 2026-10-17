import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/config";
import { enforceRateLimit, safeError } from "@/lib/security";
import { createServiceClient } from "@/lib/supabase";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ donationId: string }> },
) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  try {
    const limited = await enforceRateLimit(request, "donation-context", 30, 300);
    if (limited) return limited;
    const { donationId } = await params;
    const accessCode = new URL(request.url).searchParams.get("access");
    if (!accessCode) return NextResponse.json({ error: "Access code required." }, { status: 400 });
    const service = createServiceClient();
    const { data, error } = await service.rpc("get_donation_payment_context", {
      p_donation_id: donationId,
      p_access_code: accessCode,
    });
    if (error || !data) return NextResponse.json({ error: "Donation not found." }, { status: 404 });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: safeError(error) }, { status: 500 });
  }
}
