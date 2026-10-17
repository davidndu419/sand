"use client";

import { useState } from "react";
import { Loader2, SearchCheck } from "lucide-react";
import { formatMoney } from "@/lib/domain";
import { StatusBadge } from "@/components/status-badge";

type ReceiptResult = { receipt_number: string; donation_reference: string; donation_date: string; soldier_tag: string | null; category_name: string; amount_minor: number; currency: string; payment_method: string; payment_status: "pending" | "confirmed" | "declined" };

export function VerifyReceiptForm({ initialCode = "" }: { initialCode?: string }) {
  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReceiptResult | null | undefined>();
  const [error, setError] = useState("");

  async function verify(event?: React.FormEvent) {
    event?.preventDefault();
    setLoading(true); setError(""); setResult(undefined);
    try {
      const response = await fetch(`/api/receipts/verify?code=${encodeURIComponent(code.trim())}`);
      const body = await response.json() as { error?: string; valid?: boolean; receipt?: ReceiptResult };
      if (!response.ok) throw new Error(body.error || "Verification is temporarily unavailable.");
      setResult(body.valid && body.receipt ? body.receipt : null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Verification failed."); }
    finally { setLoading(false); }
  }

  const tone = result?.payment_status === "confirmed" ? "success" : result?.payment_status === "declined" ? "danger" : "pending";
  const message = result?.payment_status === "confirmed" ? "Your receipt is valid. Our administration has confirmed the associated payment." : result?.payment_status === "declined" ? "Your receipt is valid, but the associated payment submission was declined after administrative review. Please contact our support team if you need assistance." : "Your receipt is valid and recorded in our system. Your payment is awaiting administrative verification.";
  return <><form className="form-card" onSubmit={verify}><div className="field"><label htmlFor="receipt-code">Receipt verification code</label><input id="receipt-code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="32-character verification code" autoComplete="off" required /></div>{error && <div className="form-error">{error}</div>}<div className="form-actions"><button className="button button-navy" disabled={loading}>{loading ? <><Loader2 className="animate-spin" size={17} /> Verifying…</> : <><SearchCheck size={17} /> Verify receipt</>}</button></div></form>
  {result === null && <div className="result-card danger"><h3>Invalid Receipt</h3><p>We could not verify this receipt code. Please check the code and try again.</p></div>}
  {result && <div className={`result-card ${tone}`}><div className="copy-row" style={{ justifyContent: "space-between" }}><h3>{result.payment_status === "confirmed" ? "Confirmed" : result.payment_status === "declined" ? "Declined" : "Pending Verification"}</h3><StatusBadge value={result.payment_status} /></div><p>{message}</p><dl><div><dt>Receipt number</dt><dd>{result.receipt_number}</dd></div><div><dt>Donation reference</dt><dd>{result.donation_reference}</dd></div><div><dt>Date recorded</dt><dd>{new Date(result.donation_date).toLocaleString()}</dd></div><div><dt>Beneficiary</dt><dd>{result.soldier_tag || "General support"}</dd></div><div><dt>Category</dt><dd>{result.category_name}</dd></div><div><dt>Amount</dt><dd>{formatMoney(result.amount_minor, result.currency)}</dd></div><div><dt>Method</dt><dd>{result.payment_method.replaceAll("_", " ")}</dd></div><div><dt>Authenticity</dt><dd>Recorded receipt</dd></div></dl></div>}</>;
}
