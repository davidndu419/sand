const requiredServerKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "PAYMENT_ENCRYPTION_KEY_BASE64",
] as const;

export function isSupabaseConfigured() {
  const values = requiredServerKeys.map((key) => process.env[key]?.trim() ?? "");
  if (values.some((value) => !value || /your[_-]|placeholder|example/i.test(value))) return false;
  try {
    const url = new URL(values[0]);
    return (url.protocol === "http:" || url.protocol === "https:")
      && values[1].length >= 20
      && values[2].length >= 20
      && /^[A-Za-z0-9+/]+={0,2}$/.test(values[3]);
  } catch {
    return false;
  }
}

export function getSupabaseUrl() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) throw new Error("Supabase is not configured.");
  return value;
}

export function getSupabaseAnonKey() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!value) throw new Error("Supabase is not configured.");
  return value;
}

export function getSupabaseServiceRoleKey() {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error("Supabase service access is not configured.");
  return value;
}

export function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "http://localhost:5173"
  );
}

export function getEvidenceMaxBytes() {
  const parsed = Number(process.env.EVIDENCE_MAX_BYTES ?? 5_242_880);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5_242_880;
}

export const acceptedEvidenceTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);
