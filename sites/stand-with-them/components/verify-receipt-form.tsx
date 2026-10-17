"use client";

import { Loader2, SearchCheck } from "lucide-react";
import { useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { formatMoney } from "@/lib/domain";
import type { FulfilmentStatus, PaymentStatus } from "@/lib/types";

type ReceiptEvent = { description: string; at: string };

type ReceiptResult = {
  donation_date: string;
  soldier_tag: string | null;
  category_name: string;
  amount_minor: number;
  currency: string;
  payment_method: string;
  payment_status: PaymentStatus;
  fulfilment_status: FulfilmentStatus;
  events?: ReceiptEvent[];
};

export function VerifyReceiptForm({ initialCode = "" }: { initialCode?: string }) {
  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReceiptResult | null | undefined>();
  const [error, setError] = useState("");

  async function verify(event?: React.FormEvent) {
    event?.preventDefault();
    setLoading(true);
    setError("");
    setResult(undefined);
    try {
      const response = await fetch(`/api/receipts/verify?code=${encodeURIComponent(code.trim())}`);
      const body = await response.json() as { error?: string; valid?: boolean; receipt?: ReceiptResult };
      if (!response.ok) throw new Error(body.error || "Receipt tracking is temporarily unavailable.");
      setResult(body.valid && body.receipt ? body.receipt : null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Receipt tracking failed.");
    } finally {
      setLoading(false);
    }
  }

  const tone = result?.payment_status === "confirmed" ? "success" : result?.payment_status === "declined" ? "danger" : "pending";
  const message = result?.payment_status === "confirmed"
    ? "This receipt is valid and the associated payment has been confirmed by an authorised administrator."
    : result?.payment_status === "declined"
      ? "This receipt is valid, but the associated payment submission was declined after administrative review."
      : "This receipt is valid and recorded. The associated payment is awaiting administrative verification.";

  return (
    <>
      <form className="form-card" onSubmit={verify}>
        <div className="field">
          <label htmlFor="receipt-code">Receipt verification code</label>
          <input
            id="receipt-code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="20-character verification code"
            autoComplete="off"
            minLength={20}
            maxLength={32}
            pattern="(?:[A-HJ-NP-Za-hj-np-z2-9]{20}|[A-Fa-f0-9]{32})"
            required
          />
          <small>This private code is printed on the receipt issued after payment submission.</small>
        </div>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="form-actions">
          <button className="button button-navy" disabled={loading}>
            {loading ? <><Loader2 className="animate-spin" size={17} /> Tracking…</> : <><SearchCheck size={17} /> Track receipt</>}
          </button>
        </div>
      </form>

      <div aria-live="polite">
        {result === null && <div className="result-card danger"><h3>Receipt not found</h3><p>We could not match that verification code. Check the code and try again.</p></div>}
        {result && (
          <div className={`result-card ${tone}`}>
            <h3>Receipt found</h3>
            <p>{message}</p>
            <div className="verification-status-grid" aria-label="Donation statuses">
              <div><span>Payment status</span><StatusBadge value={result.payment_status} /></div>
              {result.soldier_tag && <div><span>Fulfilment status</span><StatusBadge value={result.fulfilment_status} /></div>}
            </div>
            <dl>
              <div><dt>Verification code</dt><dd>{code.trim().toUpperCase()}</dd></div>
              <div><dt>Date submitted</dt><dd>{new Date(result.donation_date).toLocaleString()}</dd></div>
              <div><dt>Support category</dt><dd>{result.category_name}</dd></div>
              <div><dt>Amount</dt><dd>{formatMoney(result.amount_minor, result.currency)}</dd></div>
              <div><dt>Beneficiary</dt><dd>{result.soldier_tag || "General support"}</dd></div>
              <div><dt>Payment method</dt><dd>{result.payment_method.replaceAll("_", " ")}</dd></div>
              <div><dt>Authenticity</dt><dd>Recorded receipt</dd></div>
            </dl>
            {result.events && result.events.length > 0 && (
              <>
                <h3 className="tracking-timeline-heading">Recorded progress</h3>
                <ol className="timeline">
                  {result.events.map((item, index) => (
                    <li key={`${item.at}-${index}`}><strong>{item.description}</strong><span>{new Date(item.at).toLocaleString()}</span></li>
                  ))}
                </ol>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
