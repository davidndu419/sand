import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAdmin } from "@/lib/auth";
import { isSameOrigin, safeError } from "@/lib/security";
import { createServiceClient } from "@/lib/supabase";

const schema = z.object({ active: z.boolean() });

export async function PATCH(request: Request, { params }: { params: Promise<{ optionId: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authorizeAdmin("manage_settings");
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    const { optionId } = await params;
    const service = createServiceClient();
    const { error } = await service.from("payment_options").update({ active: parsed.data.active }).eq("id", optionId);
    if (error) throw error;
    await service.from("audit_logs").insert({ actor_id: auth.admin.id, action: "payment_option.status_changed", entity_type: "payment_option", entity_id: optionId, metadata: { active: parsed.data.active } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: safeError(error, "The payment option could not be changed.") }, { status: 500 });
  }
}
