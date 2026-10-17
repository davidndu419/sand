import { NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/auth";
import { decryptSensitiveValue, encryptSensitiveValue } from "@/lib/domain";
import { isSameOrigin, safeError } from "@/lib/security";
import { createServiceClient } from "@/lib/supabase";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const codePattern = /^(?:[A-HJ-NP-Z2-9]{20}|[A-F0-9]{32})$/;

export async function GET(_request: Request, { params }: { params: Promise<{ receiptId: string }> }) {
  const auth = await authorizeAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  try {
    const { receiptId } = await params;
    if (!uuidPattern.test(receiptId)) return NextResponse.json({ error: "Invalid receipt identifier." }, { status: 400 });
    const { data, error } = await createServiceClient()
      .from("receipts")
      .select("verification_code_ciphertext")
      .eq("id", receiptId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Receipt not found." }, { status: 404 });
    if (!data.verification_code_ciphertext) {
      return NextResponse.json({ error: "Enter this legacy receipt's existing code once to enable secure admin reveal.", legacy: true }, { status: 409 });
    }
    const code = await decryptSensitiveValue(data.verification_code_ciphertext);
    return NextResponse.json({ code }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: safeError(error, "The verification code could not be revealed.") }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ receiptId: string }> }) {
  const auth = await authorizeAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const { receiptId } = await params;
    if (!uuidPattern.test(receiptId)) return NextResponse.json({ error: "Invalid receipt identifier." }, { status: 400 });
    const body = await request.json() as { code?: unknown };
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    if (!codePattern.test(code)) return NextResponse.json({ error: "Enter the receipt's existing verification code." }, { status: 400 });

    const service = createServiceClient();
    const { data: receipt, error: receiptError } = await service
      .from("receipts")
      .select("verification_code_ciphertext")
      .eq("id", receiptId)
      .maybeSingle();
    if (receiptError) throw receiptError;
    if (!receipt) return NextResponse.json({ error: "Receipt not found." }, { status: 404 });
    if (receipt.verification_code_ciphertext) {
      const existingCode = await decryptSensitiveValue(receipt.verification_code_ciphertext);
      return NextResponse.json({ code: existingCode }, { headers: { "cache-control": "private, no-store" } });
    }

    const ciphertext = await encryptSensitiveValue(code);
    const { error: linkError } = await service.rpc("link_receipt_verification_code", {
      p_admin_id: auth.admin.id,
      p_receipt_id: receiptId,
      p_verification_code: code,
      p_verification_code_ciphertext: ciphertext,
    });
    if (linkError?.message.includes("invalid_code")) return NextResponse.json({ error: "That code does not match this receipt." }, { status: 400 });
    if (linkError?.message.includes("already_linked")) return NextResponse.json({ error: "The receipt code was updated by another administrator. Reveal it again." }, { status: 409 });
    if (linkError) throw linkError;
    return NextResponse.json({ code }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: safeError(error, "The verification code could not be saved.") }, { status: 500 });
  }
}
