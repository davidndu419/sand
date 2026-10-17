import { NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/auth";
import { isSameOrigin, safeError } from "@/lib/security";
import { createServiceClient } from "@/lib/supabase";
import { fulfilmentSchema } from "@/lib/validation";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authorizeAdmin("manage_fulfilment");
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  try {
    const parsed = fulfilmentSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the fulfilment record." }, { status: 400 });
    const input = parsed.data;
    const service = createServiceClient();
    let result;
    if (input.action === "allocate") {
      if (!input.amountMinor) return NextResponse.json({ error: "Allocation amount is required." }, { status: 400 });
      result = await service.rpc("record_fund_allocation", {
        p_admin_id: auth.admin.id,
        p_donation_id: input.donationId,
        p_amount_minor: input.amountMinor,
        p_notes: input.note || null,
      });
    } else if (input.action === "purchase") {
      if (!input.items?.length || input.actualCostMinor === undefined) return NextResponse.json({ error: "Items and actual cost are required." }, { status: 400 });
      result = await service.rpc("record_purchase", {
        p_admin_id: auth.admin.id,
        p_donation_id: input.donationId,
        p_items: input.items,
        p_actual_cost_minor: input.actualCostMinor,
        p_provider_reference: input.providerReference || null,
        p_notes: input.note || null,
      });
    } else {
      if (!input.status || !input.note) return NextResponse.json({ error: "Status and confirmation note are required." }, { status: 400 });
      result = await service.rpc("set_fulfilment_status", {
        p_admin_id: auth.admin.id,
        p_donation_id: input.donationId,
        p_status: input.status,
        p_note: input.note,
      });
    }
    if (result.error) throw result.error;
    return NextResponse.json({ ok: true, result: result.data });
  } catch (error) {
    return NextResponse.json({ error: safeError(error, "The fulfilment update could not be recorded.") }, { status: 500 });
  }
}
