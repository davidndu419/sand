import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAdmin } from "@/lib/auth";
import { CRYPTO_ASSETS, defaultNetworkFor, describePaymentOption, GIFT_CARD_TYPES, USDT_NETWORKS } from "@/lib/payment-options";
import { isSameOrigin, safeError } from "@/lib/security";
import { createServiceClient } from "@/lib/supabase";

const giftCardTypes = GIFT_CARD_TYPES.map((item) => item.value) as string[];
const cryptoAssets = CRYPTO_ASSETS.map((item) => item.value) as string[];

const schema = z.object({
  method: z.enum(["gift_card", "cryptocurrency"]),
  label: z.string().trim().min(2).max(100),
  instructions: z.string().trim().min(5).max(2000),
  config: z.record(z.string(), z.unknown()),
  active: z.boolean().default(true),
}).superRefine((value, context) => {
  if (value.method === "gift_card") {
    if (typeof value.config.gift_card_type !== "string" || !giftCardTypes.includes(value.config.gift_card_type)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["config", "gift_card_type"], message: "Choose Apple, Razer Gold, or Xbox gift card." });
    }
    return;
  }

  const token = value.config.token;
  const network = value.config.network;
  const wallet = value.config.wallet_address;
  if (typeof token !== "string" || !cryptoAssets.includes(token)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["config", "token"], message: "Choose BTC, USDT, ETH, or SOL." });
  } else if (token === "USDT" && (typeof network !== "string" || !(USDT_NETWORKS as readonly string[]).includes(network))) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["config", "network"], message: "Choose TRC20, BEP20, or ERC20 for USDT." });
  } else if (token !== "USDT" && (typeof network !== "string" || network !== defaultNetworkFor(token as "BTC" | "ETH" | "SOL"))) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["config", "network"], message: "The blockchain network does not match the selected coin." });
  }
  if (typeof wallet !== "string" || wallet.trim().length < 4 || wallet.length > 500) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["config", "wallet_address"], message: "A valid wallet address is required." });
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
    const desiredDescriptor = describePaymentOption({ id: "new", ...parsed.data });
    const { data: existingOptions, error: existingError } = await service
      .from("payment_options")
      .select("id,method,label,instructions,config")
      .eq("method", parsed.data.method);
    if (existingError) throw existingError;
    const duplicate = (existingOptions ?? []).some((option) => {
      const descriptor = describePaymentOption({
        ...option,
        method: option.method as "gift_card" | "cryptocurrency",
        config: (option.config ?? {}) as Record<string, unknown>,
      });
      return JSON.stringify(descriptor) === JSON.stringify(desiredDescriptor);
    });
    if (duplicate) {
      return NextResponse.json({ error: "That payment option already exists. Reactivate the existing option if it is inactive." }, { status: 409 });
    }
    const { data, error } = await service.from("payment_options").insert({
      ...parsed.data,
      created_by: auth.admin.id,
    }).select("id,method,label,instructions,active,config").single();
    if (error) throw error;
    await service.from("audit_logs").insert({ actor_id: auth.admin.id, action: "payment_option.created", entity_type: "payment_option", entity_id: data.id });
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: safeError(error, "The payment option could not be saved.") }, { status: 500 });
  }
}
