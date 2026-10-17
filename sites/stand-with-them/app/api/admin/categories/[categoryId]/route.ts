import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAdmin } from "@/lib/auth";
import { isSameOrigin, safeError } from "@/lib/security";
import { createServiceClient } from "@/lib/supabase";

const schema = z.object({ active: z.boolean() });

export async function PATCH(request: Request, { params }: { params: Promise<{ categoryId: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authorizeAdmin("manage_settings");
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    const { categoryId } = await params;
    const service = createServiceClient();
    const { error } = await service.from("support_categories").update({ active: parsed.data.active }).eq("id", categoryId);
    if (error) throw error;
    await service.from("audit_logs").insert({ actor_id: auth.admin.id, action: "support_category.status_changed", entity_type: "support_category", entity_id: categoryId, metadata: { active: parsed.data.active } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: safeError(error, "The category could not be changed.") }, { status: 500 });
  }
}
