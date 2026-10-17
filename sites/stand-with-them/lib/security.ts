import { createServiceClient } from "@/lib/supabase";
import { sha256 } from "@/lib/domain";

export function getClientAddress(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    request.headers.get("cf-connecting-ip") ||
    forwarded ||
    "unknown"
  );
}

export async function enforceRateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowSeconds: number,
) {
  const addressHash = await sha256(getClientAddress(request));
  const service = createServiceClient();
  const { data, error } = await service.rpc("consume_public_rate_limit", {
    p_scope: scope,
    p_key_hash: addressHash,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw new Error("Rate limiting is temporarily unavailable.");
  if (!data) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please wait and try again." }),
      { status: 429, headers: { "content-type": "application/json", "retry-after": String(windowSeconds) } },
    );
  }
  return null;
}

export function safeError(error: unknown, fallback = "The request could not be completed.") {
  if (process.env.NODE_ENV !== "production") {
    console.error(error);
  }
  return fallback;
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}
