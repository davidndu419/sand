"use client";

import { Check, Copy, Eye, Loader2 } from "lucide-react";
import { useState } from "react";

export function VerificationCodeButton({ receiptId }: { receiptId?: string | null }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [legacy, setLegacy] = useState(false);
  const [legacyCode, setLegacyCode] = useState("");

  async function reveal() {
    if (!receiptId) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/receipts/${receiptId}/verification-code`, {
        headers: { accept: "application/json" },
      });
      const body = await response.json() as { code?: string; error?: string; legacy?: boolean };
      if (response.status === 409 && body.legacy) {
        setLegacy(true);
        return;
      }
      if (!response.ok || !body.code) throw new Error(body.error || "The code could not be revealed.");
      setCode(body.code);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The code could not be revealed.");
    } finally {
      setLoading(false);
    }
  }

  async function saveLegacy(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!receiptId) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/receipts/${receiptId}/verification-code`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: legacyCode }),
      });
      const body = await response.json() as { code?: string; error?: string };
      if (!response.ok || !body.code) throw new Error(body.error || "The code could not be saved.");
      setCode(body.code);
      setLegacy(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The code could not be saved.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  if (!receiptId) return <small>Not issued</small>;
  if (code) {
    return <div className="admin-verification-code"><code>{code}</code><button type="button" className="icon-button" onClick={copy} aria-label="Copy receipt verification code">{copied ? <Check size={14} /> : <Copy size={14} />}</button></div>;
  }
  if (legacy) {
    return <form className="admin-legacy-code" onSubmit={saveLegacy}><input value={legacyCode} onChange={(event) => setLegacyCode(event.target.value.toUpperCase())} placeholder="Existing code" minLength={20} maxLength={32} required /><button type="submit" className="table-button" disabled={loading}>{loading ? <Loader2 className="animate-spin" size={13} /> : "Verify & save"}</button>{error && <small className="admin-code-error">{error}</small>}</form>;
  }
  return <div className="admin-code-action"><button type="button" className="table-button" onClick={reveal} disabled={loading}>{loading ? <Loader2 className="animate-spin" size={13} /> : <Eye size={13} />} Reveal code</button>{error && <small className="admin-code-error">{error}</small>}</div>;
}
