import { NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/auth";
import { isSameOrigin, safeError } from "@/lib/security";
import { createServiceClient } from "@/lib/supabase";
import { publicContactSchema } from "@/lib/validation";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authorizeAdmin("manage_settings");
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  try {
    const parsed = publicContactSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the contact details." }, { status: 400 });
    }
    const { error } = await createServiceClient().rpc("update_public_contact", {
      p_admin_id: auth.admin.id,
      p_email: parsed.data.email || null,
      p_phone: parsed.data.phone || null,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: safeError(error, "The public contact details could not be saved.") }, { status: 500 });
  }
}
