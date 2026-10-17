import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAdmin } from "@/lib/auth";
import { isSameOrigin, safeError } from "@/lib/security";
import { createServiceClient } from "@/lib/supabase";

const schema = z.object({
  donationId: z.string().uuid().optional().or(z.literal("")),
  transactionType: z.enum(["allocation", "expenditure", "refund", "adjustment"]),
  amountMinor: z.number().int().refine((value) => value !== 0 && Math.abs(value) <= 100_000_000),
  description: z.string().trim().min(2).max(1000),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authorizeAdmin("manage_fulfilment");
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the ledger entry." }, { status: 400 });
    const { data, error } = await createServiceClient().rpc("record_general_fund_transaction", {
      p_admin_id: auth.admin.id,
      p_donation_id: parsed.data.donationId || null,
      p_transaction_type: parsed.data.transactionType,
      p_amount_minor: parsed.data.amountMinor,
      p_description: parsed.data.description,
    });
    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: safeError(error, "The ledger entry could not be recorded.") }, { status: 500 });
  }
}
