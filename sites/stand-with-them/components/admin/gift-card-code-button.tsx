"use client";

import { Check, Copy, Eye, Loader2 } from "lucide-react";
import { useState } from "react";

export function GiftCardCodeButton({ paymentId }: { paymentId: string }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function reveal() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/payments/${paymentId}/gift-card-code`, {
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      const body = await response.json() as { code?: string; error?: string };
      if (!response.ok || !body.code) throw new Error(body.error || "The gift card code could not be revealed.");
      setCode(body.code);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The gift card code could not be revealed.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  if (code) {
    return <div className="admin-gift-card-code"><span>Gift card code</span><div><code>{code}</code><button type="button" className="icon-button" onClick={copy} aria-label="Copy gift card code">{copied ? <Check size={14} /> : <Copy size={14} />}</button></div></div>;
  }

  return <div className="admin-code-action"><button type="button" className="table-button" onClick={reveal} disabled={loading}>{loading ? <Loader2 className="animate-spin" size={13} /> : <Eye size={13} />} Reveal gift card code</button>{error && <small className="admin-code-error">{error}</small>}</div>;
}
