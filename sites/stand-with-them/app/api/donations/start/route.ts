import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/config";
import { normalizeSoldierTag } from "@/lib/domain";
import { enforceRateLimit, isSameOrigin, safeError } from "@/lib/security";
import { createServiceClient } from "@/lib/supabase";
import { startDonationSchema } from "@/lib/validation";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Donation submissions are temporarily unavailable." }, { status: 503 });
  }
  try {
    const limited = await enforceRateLimit(request, "donation-start", 8, 600);
    if (limited) return limited;
    const parsed = startDonationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the donation details." }, { status: 400 });
    }
    const input = parsed.data;
    const service = createServiceClient();
    const { data: category } = await service
      .from("support_categories")
      .select("minimum_amount_minor")
      .eq("slug", input.categorySlug)
      .eq("active", true)
      .maybeSingle();
    const minimumAmountMinor = Number(category?.minimum_amount_minor ?? 100);
    if (input.amountMinor < minimumAmountMinor) {
      return NextResponse.json({ error: `The minimum donation for this category is $${(minimumAmountMinor / 100).toFixed(2)}.` }, { status: 400 });
    }
    const rpcArguments = {
      p_kind: input.kind,
      p_soldier_tag: input.soldierTag ? normalizeSoldierTag(input.soldierTag) : null,
      p_category_slug: input.categorySlug,
      p_amount_minor: input.amountMinor,
      p_currency: input.currency,
      p_donor_name: input.donorName || null,
      p_donor_email: input.donorEmail || null,
    };
    let result = await service.rpc("create_donation_draft", rpcArguments);
    for (
      let attempt = 1;
      attempt < 5 &&
        result.error?.code === "23514" &&
        result.error.message.includes("donations_reference_check");
      attempt += 1
    ) {
      result = await service.rpc("create_donation_draft", rpcArguments);
    }
    const { data, error } = result;
    if (error) {
      if (error.message.includes("tag_unavailable")) {
        return NextResponse.json({ error: "That soldier tag is inactive, ineligible, or unavailable." }, { status: 400 });
      }
      if (error.message.includes("amount_below_category_minimum")) {
        return NextResponse.json({ error: "The amount is below the minimum donation for this category." }, { status: 400 });
      }
      throw error;
    }
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: safeError(error) }, { status: 500 });
  }
}
