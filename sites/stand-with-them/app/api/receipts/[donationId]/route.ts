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
    const service = createServiceClient();
    const { data, error } = await service.rpc("public_get_receipt", {
      p_donation_id: donationId,
      p_verification_code: code,
    });
    if (error || !data) return NextResponse.json({ error: "Receipt not found." }, { status: 404 });
    const raw = data as Record<string, unknown>;
    let fulfilmentStatus = typeof raw.fulfilment_status === "string" ? raw.fulfilment_status : null;
    if (!fulfilmentStatus) {
      const { data: donation, error: donationError } = await service.from("donations").select("fulfilment_status").eq("id", donationId).maybeSingle();
      if (donationError || !donation) throw donationError || new Error("Receipt status unavailable.");
      fulfilmentStatus = donation.fulfilment_status;
    }
    return NextResponse.json({
      donation_date: raw.donation_date,
      soldier_tag: raw.soldier_tag,
      category_name: raw.category_name,
      amount_minor: raw.amount_minor,
      currency: raw.currency,
      payment_method: raw.payment_method,
      payment_status: raw.payment_status,
      fulfilment_status: fulfilmentStatus,
    }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: safeError(error) }, { status: 500 });
  }
}
