import { NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/auth";
import { encryptSensitiveValue } from "@/lib/domain";
import { isSameOrigin, safeError } from "@/lib/security";
import { createServiceClient } from "@/lib/supabase";
import { registerSoldierSchema } from "@/lib/validation";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authorizeAdmin("manage_soldiers");
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  try {
    const parsed = registerSoldierSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the soldier details." }, { status: 400 });
    const mobileCiphertext = parsed.data.mobileNumber
      ? await encryptSensitiveValue(parsed.data.mobileNumber)
      : null;
    const { data, error } = await createServiceClient().rpc("register_soldier", {
      p_admin_id: auth.admin.id,
      p_private_identifier: parsed.data.privateIdentifier,
      p_mobile_ciphertext: mobileCiphertext,
      p_notes: parsed.data.notes || null,
      p_category_ids: parsed.data.categoryIds,
    });
    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: safeError(error, "The soldier could not be registered.") }, { status: 500 });
  }
}
