import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAdmin } from "@/lib/auth";
import { isSameOrigin, safeError } from "@/lib/security";
import { createServiceClient } from "@/lib/supabase";

const schema = z.object({
  active: z.boolean().optional(),
  instructions: z.string().trim().min(5).max(2000).optional(),
  walletAddress: z.string().trim().min(4).max(500).optional(),
}).refine(
  (value) => value.active !== undefined || value.instructions !== undefined || value.walletAddress !== undefined,
  { message: "Provide at least one payment option change." },
);

export async function PATCH(request: Request, { params }: { params: Promise<{ optionId: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authorizeAdmin("manage_settings");
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payment option settings." }, { status: 400 });
    const { optionId } = await params;
    const service = createServiceClient();
    const { data: current, error: currentError } = await service
      .from("payment_options")
      .select("method,config")
      .eq("id", optionId)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!current) return NextResponse.json({ error: "Payment option not found." }, { status: 404 });

    if (parsed.data.walletAddress !== undefined && current.method !== "cryptocurrency") {
      return NextResponse.json({ error: "Wallet addresses can only be set for cryptocurrency options." }, { status: 400 });
    }

    const changes: { active?: boolean; instructions?: string; config?: Record<string, unknown> } = {};
    if (parsed.data.active !== undefined) changes.active = parsed.data.active;
    if (parsed.data.instructions !== undefined) changes.instructions = parsed.data.instructions;
    if (parsed.data.walletAddress !== undefined) {
      const existingConfig = current.config && typeof current.config === "object" && !Array.isArray(current.config)
        ? current.config
        : {};
      changes.config = { ...existingConfig, wallet_address: parsed.data.walletAddress };
    }

    const { data, error } = await service
      .from("payment_options")
      .update(changes)
      .eq("id", optionId)
      .select("id,method,label,instructions,active,config")
      .single();
    if (error) throw error;
    const settingsChanged = parsed.data.instructions !== undefined || parsed.data.walletAddress !== undefined;
    await service.from("audit_logs").insert({
      actor_id: auth.admin.id,
      action: settingsChanged ? "payment_option.settings_changed" : "payment_option.status_changed",
      entity_type: "payment_option",
      entity_id: optionId,
      metadata: {
        ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
        instructions_changed: parsed.data.instructions !== undefined,
        wallet_address_changed: parsed.data.walletAddress !== undefined,
      },
    });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: safeError(error, "The payment option could not be changed.") }, { status: 500 });
  }
}
