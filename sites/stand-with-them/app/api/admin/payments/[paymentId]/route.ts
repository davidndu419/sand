import { NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/auth";
import { isSameOrigin, safeError } from "@/lib/security";
import { createServiceClient } from "@/lib/supabase";
import { reviewPaymentSchema } from "@/lib/validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ paymentId: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authorizeAdmin("review_payments");
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  try {
    const parsed = reviewPaymentSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the review." }, { status: 400 });
    const { paymentId } = await params;
    const { data, error } = await createServiceClient().rpc("review_payment", {
      p_admin_id: auth.admin.id,
      p_payment_id: paymentId,
      p_status: parsed.data.status,
      p_review_notes: parsed.data.reviewNotes || null,
      p_decline_reason: parsed.data.declineReason || null,
    });
    if (error) {
      if (error.message.includes("invalid_transition")) return NextResponse.json({ error: "This payment has already been reviewed." }, { status: 409 });
      throw error;
    }
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: safeError(error, "The payment decision could not be recorded.") }, { status: 500 });
  }
}
