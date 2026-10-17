"use client";

import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import { Check, Copy, Download, Loader2, Printer, SearchCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { formatMoney } from "@/lib/domain";
import type { FulfilmentStatus, PaymentStatus } from "@/lib/types";

type Receipt = {
  donation_date: string;
  soldier_tag: string | null;
  category_name: string;
  amount_minor: number;
  currency: string;
  payment_method: string;
  payment_status: PaymentStatus;
  fulfilment_status: FulfilmentStatus;
};

export function ReceiptView({ donationId, code }: { donationId: string; code: string }) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState("");
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    fetch(`/api/receipts/${donationId}?code=${encodeURIComponent(code)}`)
      .then(async (response) => {
        const body = await response.json() as Receipt & { error?: string };
        if (!response.ok) throw new Error(body.error || "Receipt not found.");
        return body;
      })
      .then(setReceipt)
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Receipt not found."));
  }, [donationId, code]);

  useEffect(() => {
    if (!code) return;
    const url = `${window.location.origin}/verify-receipt?code=${encodeURIComponent(code)}`;
    QRCode.toDataURL(url, { width: 220, margin: 1, color: { dark: "#061a2e", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(""));
  }, [code]);

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(""), 1600);
  }

  if (error) return <div className="receipt-card"><div className="receipt-body"><div className="form-error">{error}</div></div></div>;
  if (!receipt) return <div className="receipt-card"><div className="receipt-body"><Loader2 className="animate-spin" /> Loading receipt…</div></div>;

  return (
    <>
      <article className="receipt-card" id="receipt-document">
        <header className="receipt-head"><div><p>STAND WITH THEM</p><h1>Donation submission receipt</h1></div><StatusBadge value={receipt.payment_status} /></header>
        <div className="receipt-body">
          <div className="field">
            <label>Receipt verification code</label>
            <div className="copy-row"><div className="code-box" style={{ flex: 1 }}>{code}</div><button type="button" className="icon-button" onClick={() => copy(code, "verification")} aria-label="Copy verification code">{copied === "verification" ? <Check size={16} /> : <Copy size={16} />}</button></div>
            <small>This is the only public receipt identifier. Use it on Track Receipt for pending and completed transactions.</small>
          </div>
          <div className="receipt-details">
            <div><span>Date and time</span><strong>{new Date(receipt.donation_date).toLocaleString()}</strong></div>
            <div><span>Beneficiary</span><strong>{receipt.soldier_tag || "General support"}</strong></div>
            <div><span>Support category</span><strong>{receipt.category_name}</strong></div>
            <div><span>Amount</span><strong>{formatMoney(receipt.amount_minor, receipt.currency)}</strong></div>
            <div><span>Payment method</span><strong>{receipt.payment_method.replaceAll("_", " ")}</strong></div>
            <div><span>Payment status</span><strong><StatusBadge value={receipt.payment_status} /></strong></div>
            {receipt.soldier_tag && <div><span>Fulfilment status</span><strong><StatusBadge value={receipt.fulfilment_status} /></strong></div>}
          </div>
          <div className="receipt-notice"><strong>{receipt.soldier_tag
            ? "This receipt confirms a recorded submission. Payment and fulfilment remain separate statuses and change only after authorised action."
            : "This receipt confirms a recorded general-support submission. Payment status changes only after authorised review; use of the general fund is recorded separately."}</strong></div>
          {qr && <div style={{ marginTop: "1.5rem" }}><Image unoptimized src={qr} alt="QR code linking to receipt tracking" width={170} height={170} /><p style={{ color: "var(--muted)", fontSize: ".75rem" }}>Scan to track this receipt.</p></div>}
        </div>
      </article>
      <div className="receipt-actions form-actions" style={{ maxWidth: 820, marginInline: "auto" }}>
        <a className="button button-navy" href={`/api/receipts/${donationId}/pdf?code=${encodeURIComponent(code)}`}><Download size={17} /> Download PDF</a>
        <button className="button button-outline" type="button" onClick={() => window.print()}><Printer size={17} /> Print or save</button>
        <Link className="button button-outline" href={`/verify-receipt?code=${encodeURIComponent(code)}`}><SearchCheck size={17} /> Track receipt</Link>
      </div>
    </>
  );
}
