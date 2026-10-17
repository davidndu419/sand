import { NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/auth";
import { acceptedEvidenceTypes, getEvidenceMaxBytes } from "@/lib/config";
import { randomCode } from "@/lib/domain";
import { isSameOrigin, safeError } from "@/lib/security";
import { createServiceClient } from "@/lib/supabase";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authorizeAdmin("manage_fulfilment");
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  let objectPath: string | null = null;
  try {
    const form = await request.formData();
    const donationId = String(form.get("donationId") || "");
    const evidence = form.get("evidence");
    if (!/^[0-9a-f-]{36}$/i.test(donationId) || !(evidence instanceof File) || evidence.size === 0) {
      return NextResponse.json({ error: "Donation and evidence file are required." }, { status: 400 });
    }
    if (!acceptedEvidenceTypes.has(evidence.type) || evidence.size > getEvidenceMaxBytes()) {
      return NextResponse.json({ error: "Upload a JPG, PNG, WebP, or PDF no larger than 5 MB." }, { status: 400 });
    }
    const service = createServiceClient();
    const { data: donation } = await service.from("donations").select("id").eq("id", donationId).eq("kind", "soldier").eq("payment_status", "confirmed").maybeSingle();
    if (!donation) return NextResponse.json({ error: "Evidence can only be attached to a confirmed soldier-specific donation." }, { status: 400 });
    const extension = evidence.type === "application/pdf" ? "pdf" : evidence.type.split("/")[1]?.replace("jpeg", "jpg") || "bin";
    objectPath = `${donationId}/${Date.now()}-${randomCode(12)}.${extension}`;
    const { error: uploadError } = await service.storage.from("fulfilment-evidence").upload(
      objectPath,
      new Uint8Array(await evidence.arrayBuffer()),
      { contentType: evidence.type, upsert: false },
    );
    if (uploadError) throw uploadError;
    const { error } = await service.from("fulfilment_evidence").insert({
      donation_id: donationId,
      object_path: objectPath,
      original_filename: evidence.name.slice(0, 255),
      mime_type: evidence.type,
      size_bytes: evidence.size,
      uploaded_by: auth.admin.id,
    });
    if (error) throw error;
    await service.from("audit_logs").insert({
      actor_id: auth.admin.id,
      action: "fulfilment.evidence_uploaded",
      entity_type: "donation",
      entity_id: donationId,
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (objectPath) {
      try { await createServiceClient().storage.from("fulfilment-evidence").remove([objectPath]); } catch {}
    }
    return NextResponse.json({ error: safeError(error, "The evidence could not be uploaded.") }, { status: 500 });
  }
}
