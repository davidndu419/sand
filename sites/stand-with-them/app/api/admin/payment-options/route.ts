import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAdmin } from "@/lib/auth";
import { isSameOrigin, safeError } from "@/lib/security";
import { createServiceClient } from "@/lib/supabase";

const schema = z.object({
  method: z.enum(["gift_card", "cryptocurrency"]),
  label: z.string().trim().min(2).max(100),
  instructions: z.string().trim().min(5).max(2000),
  config: z.record(z.string(), z.unknown()),
  active: z.boolean().default(true),
}).superRefine((value, context) => {
  const required = value.method === "cryptocurrency"
    ? ["network", "token", "wallet_address"]
    : ["gift_card_type"];
  for (const key of required) {
    const entry = value.config[key];
    if (typeof entry !== "string" || entry.trim().length < 2 || entry.length > 500) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["config", key], message: `A valid ${key.replaceAll("_", " ")} is required.` });
    }
  }
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authorizeAdmin("manage_settings");
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the payment option." }, { status: 400 });
    const service = createServiceClient();
    const { data, error } = await service.from("payment_options").insert({
      ...parsed.data,
      created_by: auth.admin.id,
    }).select("id").single();
    if (error) throw error;
    await service.from("audit_logs").insert({ actor_id: auth.admin.id, action: "payment_option.created", entity_type: "payment_option", entity_id: data.id });
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: safeError(error, "The payment option could not be saved.") }, { status: 500 });
  }
}
