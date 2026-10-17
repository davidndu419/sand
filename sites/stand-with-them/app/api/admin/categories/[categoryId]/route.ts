import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAdmin } from "@/lib/auth";
import { isSameOrigin, safeError } from "@/lib/security";
import { createServiceClient } from "@/lib/supabase";

const schema = z.object({
  active: z.boolean().optional(),
  minimumAmountMinor: z.number().int().min(100).max(100_000_000).optional(),
  suggestedAmountsMinor: z.array(z.number().int().min(100).max(100_000_000))
    .length(3)
    .refine((amounts) => new Set(amounts).size === 3, "Enter three different donation amounts.")
    .optional(),
}).refine((value) => value.active !== undefined || value.minimumAmountMinor !== undefined || value.suggestedAmountsMinor !== undefined, {
  message: "Provide a category setting to update.",
});

export async function PATCH(request: Request, { params }: { params: Promise<{ categoryId: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authorizeAdmin("manage_settings");
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid category setting." }, { status: 400 });
    const { categoryId } = await params;
    const service = createServiceClient();
    const changes: { active?: boolean; minimum_amount_minor?: number; suggested_amounts_minor?: number[] } = {};
    if (parsed.data.active !== undefined) changes.active = parsed.data.active;
    if (parsed.data.minimumAmountMinor !== undefined) changes.minimum_amount_minor = parsed.data.minimumAmountMinor;
    const suggestedAmountsMinor = parsed.data.suggestedAmountsMinor
      ? [...parsed.data.suggestedAmountsMinor].sort((left, right) => left - right)
      : undefined;
    if (suggestedAmountsMinor) {
      changes.suggested_amounts_minor = suggestedAmountsMinor;
      changes.minimum_amount_minor = suggestedAmountsMinor[0];
    }
    const { error } = await service.from("support_categories").update(changes).eq("id", categoryId);
    if (error) throw error;
    await service.from("audit_logs").insert({ actor_id: auth.admin.id, action: "support_category.settings_changed", entity_type: "support_category", entity_id: categoryId, metadata: { ...parsed.data, suggestedAmountsMinor } });
    return NextResponse.json({ ok: true, suggestedAmountsMinor, minimumAmountMinor: changes.minimum_amount_minor });
  } catch (error) {
    return NextResponse.json({ error: safeError(error, "The category could not be changed.") }, { status: 500 });
  }
}
