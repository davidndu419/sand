import { NextResponse } from "next/server";
import {
  acceptedEvidenceTypes,
  getEvidenceMaxBytes,
  isSupabaseConfigured,
} from "@/lib/config";
import { encryptSensitiveValue, randomCode } from "@/lib/domain";
import { enforceRateLimit, isSameOrigin, safeError } from "@/lib/security";
import { createServiceClient } from "@/lib/supabase";
import { paymentSchema } from "@/lib/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ donationId: string }> },
) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Payment submission is unavailable." }, { status: 503 });
  let uploadedPath: string | null = null;
  try {
    const limited = await enforceRateLimit(request, "payment-submit", 5, 900);
    if (limited) return limited;
    const { donationId } = await params;
    const form = await request.formData();
    const parsed = paymentSchema.safeParse({
      accessCode: form.get("accessCode"),
      method: form.get("method"),
      paymentOptionId: form.get("paymentOptionId"),
      giftCardCode: form.get("giftCardCode") || undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the payment details." }, { status: 400 });
    }
    const evidence = form.get("evidence");
    if (!(evidence instanceof File) || evidence.size === 0) {
      return NextResponse.json({ error: "Payment evidence is required." }, { status: 400 });
    }
    if (!acceptedEvidenceTypes.has(evidence.type) || evidence.size > getEvidenceMaxBytes()) {
      return NextResponse.json({ error: "Upload a JPG, PNG, WebP, or PDF no larger than 5 MB." }, { status: 400 });
    }
    const safeExtension = evidence.type === "application/pdf" ? "pdf" : evidence.type.split("/")[1]?.replace("jpeg", "jpg") || "bin";
    uploadedPath = `${donationId}/${Date.now()}-${randomCode(12)}.${safeExtension}`;
    const service = createServiceClient();
    const bytes = new Uint8Array(await evidence.arrayBuffer());
    const { error: uploadError } = await service.storage
      .from("payment-evidence")
      .upload(uploadedPath, bytes, { contentType: evidence.type, upsert: false });
    if (uploadError) throw uploadError;
    const giftCiphertext = parsed.data.giftCardCode
      ? await encryptSensitiveValue(parsed.data.giftCardCode)
      : null;
    const verificationCode = randomCode(20);
    const verificationCodeCiphertext = await encryptSensitiveValue(verificationCode);
    const legacyArguments = {
      p_donation_id: donationId,
      p_access_code: parsed.data.accessCode,
      p_method: parsed.data.method,
      p_payment_option_id: parsed.data.paymentOptionId,
      p_gift_code_ciphertext: giftCiphertext,
      p_transaction_hash: null,
      p_evidence_path: uploadedPath,
      p_evidence_name: evidence.name.slice(0, 255),
      p_evidence_mime: evidence.type,
      p_evidence_size: evidence.size,
    };
    let result = await service.rpc("submit_payment", {
      ...legacyArguments,
      p_verification_code: verificationCode,
      p_verification_code_ciphertext: verificationCodeCiphertext,
    });
    if (result.error?.code === "PGRST202" && result.error.message.includes("submit_payment")) {
      result = await service.rpc("submit_payment", legacyArguments);
    }
    const { data, error } = result;
    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    if (uploadedPath) {
      try {
        await createServiceClient().storage.from("payment-evidence").remove([uploadedPath]);
      } catch {}
    }
    return NextResponse.json({ error: safeError(error, "The payment could not be recorded. No confirmation has been issued.") }, { status: 500 });
  }
}
