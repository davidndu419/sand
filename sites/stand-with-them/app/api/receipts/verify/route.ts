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
    if (!code || !/^(?:[A-HJ-NP-Z2-9]{20}|[A-F0-9]{32})$/.test(code)) {
      return NextResponse.json({ valid: false }, { headers: { "cache-control": "private, no-store" } });
    }
    const service = createServiceClient();
    const { data, error } = await service.rpc("public_verify_receipt", {
      p_verification_code: code,
    });
    if (error) throw error;
    if (!data) {
      return NextResponse.json({ valid: false }, { headers: { "cache-control": "private, no-store" } });
    }

    const raw = data as Record<string, unknown>;
    const legacyDonationId = typeof raw.donation_id === "string" ? raw.donation_id : null;
    let fulfilmentStatus = typeof raw.fulfilment_status === "string" ? raw.fulfilment_status : null;
    let events = Array.isArray(raw.events)
      ? raw.events.flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const event = item as Record<string, unknown>;
          return typeof event.description === "string" && typeof event.at === "string"
            ? [{ description: event.description, at: event.at }]
            : [];
        })
      : null;

    if (legacyDonationId && (!fulfilmentStatus || !events)) {
      const [donationResult, eventsResult] = await Promise.all([
        service.from("donations").select("fulfilment_status").eq("id", legacyDonationId).maybeSingle(),
        service.from("fulfilment_events").select("public_description,event_at").eq("donation_id", legacyDonationId).order("event_at", { ascending: true }),
      ]);
      if (donationResult.error || eventsResult.error || !donationResult.data) throw donationResult.error || eventsResult.error || new Error("Receipt status unavailable.");
      fulfilmentStatus = donationResult.data.fulfilment_status;
      events = (eventsResult.data ?? []).map((item) => ({ description: item.public_description, at: item.event_at }));
    }

    if (!fulfilmentStatus) throw new Error("Receipt status unavailable.");
    const receipt = {
      donation_date: raw.donation_date,
      soldier_tag: raw.soldier_tag,
      category_name: raw.category_name,
      amount_minor: raw.amount_minor,
      currency: raw.currency,
      payment_method: raw.payment_method,
      payment_status: raw.payment_status,
      fulfilment_status: fulfilmentStatus,
      events: events ?? [],
    };
    return NextResponse.json({ valid: true, receipt }, {
      headers: { "cache-control": "private, no-store" },
    });
  } catch (error) {
    return NextResponse.json({ error: safeError(error) }, { status: 500 });
  }
}
