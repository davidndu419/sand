import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin, safeError } from "@/lib/security";
import { createAuthClient } from "@/lib/supabase";

const schema = z.object({
  factorId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Enter the six-digit authentication code." }, { status: 400 });
    const auth = await createAuthClient();
    const { error } = await auth.auth.mfa.challengeAndVerify({
      factorId: parsed.data.factorId,
      code: parsed.data.code,
    });
    if (error) return NextResponse.json({ error: "The authentication code was not accepted." }, { status: 401 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: safeError(error, "Multi-factor verification failed.") }, { status: 500 });
  }
}
