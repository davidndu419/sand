import { NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/auth";
import { isSameOrigin, safeError } from "@/lib/security";
import { createServiceClient } from "@/lib/supabase";

export async function PATCH(request: Request, { params }: { params: Promise<{ soldierId: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authorizeAdmin("manage_soldiers");
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  try {
    const body = await request.json() as { status?: string };
    if (body.status !== "active" && body.status !== "inactive") return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    const { soldierId } = await params;
    const { error } = await createServiceClient().rpc("set_soldier_status", {
      p_admin_id: auth.admin.id,
      p_soldier_id: soldierId,
      p_status: body.status,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: safeError(error, "The status could not be changed.") }, { status: 500 });
  }
}
