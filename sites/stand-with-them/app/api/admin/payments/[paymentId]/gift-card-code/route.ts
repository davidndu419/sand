import { NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/auth";
import { decryptSensitiveValue } from "@/lib/domain";
import { isSameOrigin, safeError } from "@/lib/security";
import { createServiceClient } from "@/lib/supabase";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request, { params }: { params: Promise<{ paymentId: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authorizeAdmin("review_payments");
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  try {
    const { paymentId } = await params;
    if (!uuidPattern.test(paymentId)) return NextResponse.json({ error: "Invalid payment identifier." }, { status: 400 });
    const service = createServiceClient();
    const { data, error } = await service
      .from("payment_submissions")
      .select("method,gift_card_code_ciphertext")
      .eq("id", paymentId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Payment submission not found." }, { status: 404 });
    if (data.method !== "gift_card") return NextResponse.json({ error: "This payment is not a gift-card submission." }, { status: 400 });
    if (!data.gift_card_code_ciphertext) return NextResponse.json({ error: "No gift card code was stored for this submission." }, { status: 404 });

    const code = await decryptSensitiveValue(data.gift_card_code_ciphertext);
    const { error: auditError } = await service.from("audit_logs").insert({
      actor_id: auth.admin.id,
      action: "gift_card_code.revealed",
      entity_type: "payment_submission",
      entity_id: paymentId,
      metadata: {},
    });
    if (auditError) throw auditError;
    return NextResponse.json({ code }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: safeError(error, "The gift card code could not be revealed.") }, { status: 500 });
  }
}
