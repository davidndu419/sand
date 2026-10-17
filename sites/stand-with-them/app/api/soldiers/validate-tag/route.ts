import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/config";
import { normalizeSoldierTag } from "@/lib/domain";
import { enforceRateLimit, safeError } from "@/lib/security";
import { createServiceClient } from "@/lib/supabase";
import { soldierTagSchema } from "@/lib/validation";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Donations are temporarily unavailable." }, { status: 503 });
  }
  try {
    const limited = await enforceRateLimit(request, "soldier-tag", 12, 300);
    if (limited) return limited;
    const body = await request.json() as { tag?: string; categorySlug?: string };
    const parsed = soldierTagSchema.safeParse(body.tag);
    if (!parsed.success) {
      return NextResponse.json({ valid: false, error: "That tag is not available." }, { status: 400 });
    }
    const service = createServiceClient();
    const { data, error } = await service.rpc("validate_soldier_tag", {
      p_tag: normalizeSoldierTag(parsed.data),
      p_category_slug: typeof body.categorySlug === "string" ? body.categorySlug : null,
    });
    if (error) throw error;
    return NextResponse.json(data?.valid ? data : { valid: false, error: "That tag is not available." });
  } catch (error) {
    return NextResponse.json({ error: safeError(error) }, { status: 500 });
  }
}
