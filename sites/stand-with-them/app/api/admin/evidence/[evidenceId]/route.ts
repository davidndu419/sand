import { NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/auth";
import { safeError } from "@/lib/security";
import { createServiceClient } from "@/lib/supabase";

export async function GET(_: Request, { params }: { params: Promise<{ evidenceId: string }> }) {
  const auth = await authorizeAdmin("review_payments");
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  try {
    const { evidenceId } = await params;
    const service = createServiceClient();
    const { data: evidence, error } = await service
      .from("payment_evidence")
      .select("bucket_name, object_path")
      .eq("id", evidenceId)
      .single();
    if (error || !evidence) return NextResponse.json({ error: "Evidence not found." }, { status: 404 });
    const { data, error: signedError } = await service.storage
      .from(evidence.bucket_name)
      .createSignedUrl(evidence.object_path, 60);
    if (signedError) throw signedError;
    return NextResponse.redirect(data.signedUrl, 302);
  } catch (error) {
    return NextResponse.json({ error: safeError(error, "Evidence could not be opened.") }, { status: 500 });
  }
}
