import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAdmin } from "@/lib/auth";
import { isSameOrigin, safeError } from "@/lib/security";
import { createServiceClient } from "@/lib/supabase";

const schema = z.object({
  key: z.string().regex(/^[a-z0-9_.-]{2,100}$/),
  value: z.unknown(),
  public: z.boolean(),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authorizeAdmin("manage_settings");
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid setting." }, { status: 400 });
    const { error } = await createServiceClient().rpc("update_app_setting", {
      p_admin_id: auth.admin.id,
      p_key: parsed.data.key,
      p_value: parsed.data.value,
      p_public: parsed.data.public,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: safeError(error, "The setting could not be saved.") }, { status: 500 });
  }
}
