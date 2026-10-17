import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/security";
import { createAuthClient } from "@/lib/supabase";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const auth = await createAuthClient();
  await auth.auth.signOut();
  return NextResponse.json({ ok: true });
}
