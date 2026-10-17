"use client";

import QRCode from "qrcode";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Copy, Loader2, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatMoney } from "@/lib/domain";
import {
  CRYPTO_ASSETS,
  cryptoAssetLabel,
  describePaymentOption,
  GIFT_CARD_TYPES,
  giftCardLabel,
  USDT_NETWORKS,
  type CryptoAsset,
  type PaymentOptionDescriptor,
} from "@/lib/payment-options";
import type { PaymentMethod } from "@/lib/types";

type PaymentOption = { id: string; method: "gift_card" | "cryptocurrency"; label: string; instructions: string; config: Record<string, unknown> };
type Context = { id: string; soldierTag: string | null; categoryName: string; amountMinor: number; currency: string; paymentSubmitted: boolean; paymentOptions: PaymentOption[] };

export function PaymentForm({ donationId, accessCode }: { donationId: string; accessCode: string }) {
  const router = useRouter();
  const [context, setContext] = useState<Context | null>(null);
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [optionId, setOptionId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [qr, setQr] = useState("");
  const configuredOptions = useMemo(() => (context?.paymentOptions ?? []).flatMap((item) => {
    const descriptor = describePaymentOption(item);
    return descriptor ? [{ item, descriptor }] : [];
  }), [context]);
  const giftCardOptions = useMemo(() => configuredOptions.filter((entry) => entry.descriptor.method === "gift_card"), [configuredOptions]);
  const cryptoOptions = useMemo(() => configuredOptions.filter((entry) => entry.descriptor.method === "cryptocurrency"), [configuredOptions]);
  const option = useMemo(() => context?.paymentOptions.find((item) => item.id === optionId), [context, optionId]);
  const descriptor = useMemo(() => option ? describePaymentOption(option) : null, [option]);
  const wallet = typeof option?.config.wallet_address === "string" ? option.config.wallet_address : "";

  useEffect(() => {
    fetch(`/api/donations/${donationId}/context?access=${encodeURIComponent(accessCode)}`)
      .then(async (response) => {
        const result = await response.json() as Context & { error?: string };
        if (!response.ok) throw new Error(result.error || "Donation not found.");
        return result;
      })
      .then((result: Context) => {
        setContext(result);
        const firstOption = result.paymentOptions.find((item) => describePaymentOption(item));
        setOptionId(firstOption?.id ?? "");
        setMethod(firstOption?.method ?? "");
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Donation not found."))
      .finally(() => setLoading(false));
  }, [donationId, accessCode]);

  useEffect(() => {
    if (!wallet) return;
    let active = true;
    QRCode.toDataURL(wallet, { width: 190, margin: 1, color: { dark: "#061a2e", light: "#ffffff" } })
      .then((value) => { if (active) setQr(value); })
      .catch(() => { if (active) setQr(""); });
    return () => { active = false; };
  }, [wallet]);

  function chooseMethod(nextMethod: PaymentMethod) {
    const firstOption = nextMethod === "gift_card" ? giftCardOptions[0]?.item : cryptoOptions[0]?.item;
    setMethod(nextMethod);
    setOptionId(firstOption?.id ?? "");
  }

  function chooseCryptoAsset(asset: CryptoAsset) {
    const firstOption = cryptoOptions.find((entry) => (
      entry.descriptor.method === "cryptocurrency" && entry.descriptor.asset === asset
    ));
    if (firstOption) setOptionId(firstOption.item.id);
  }

  function descriptorAsset(value: PaymentOptionDescriptor | null) {
    return value?.method === "cryptocurrency" ? value.asset : "";
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!option) return setError("Select a configured payment method.");
    setSubmitting(true);
    try {
      const form = new FormData(event.currentTarget);
      form.set("accessCode", accessCode);
      form.set("method", option.method);
      form.set("paymentOptionId", option.id);
      const response = await fetch(`/api/donations/${donationId}/payment`, { method: "POST", body: form });
      const result = await response.json() as { error?: string; verificationCode?: string };
      if (!response.ok) throw new Error(result.error || "The payment could not be recorded.");
      if (!result.verificationCode) throw new Error("The receipt response was incomplete.");
      router.push(`/receipt/${donationId}?code=${encodeURIComponent(result.verificationCode)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The payment could not be recorded.");
      setSubmitting(false);
    }
  }

  if (loading) return <div className="form-card"><p><Loader2 className="animate-spin" size={18} /> Loading secure payment instructions…</p></div>;
  if (error && !context) return <div className="form-card"><div className="form-error">{error}</div></div>;
  if (!context) return null;
  if (context.paymentSubmitted) return <div className="form-card"><h2>Payment already submitted</h2><p>This donation already has a recorded payment submission. Use the receipt verification code issued at submission to track its status.</p></div>;

  const availableCryptoAssets = CRYPTO_ASSETS.filter((asset) => cryptoOptions.some((entry) => (
    entry.descriptor.method === "cryptocurrency" && entry.descriptor.asset === asset.value
  )));
  const selectedCryptoAsset = descriptorAsset(descriptor);
  const availableUsdtOptions = USDT_NETWORKS.flatMap((network) => {
    const entry = cryptoOptions.find((candidate) => (
      candidate.descriptor.method === "cryptocurrency"
      && candidate.descriptor.asset === "USDT"
      && candidate.descriptor.network === network
    ));
    return entry ? [entry] : [];
  });

  return (
    <form className="form-card" onSubmit={submit}>
      <div className="summary-box"><dl><div><dt>Beneficiary</dt><dd>{context.soldierTag || "General support"}</dd></div><div><dt>Support category</dt><dd>{context.categoryName}</dd></div><div><dt>Amount</dt><dd>{formatMoney(context.amountMinor, context.currency)}</dd></div></dl></div>
      <h2>Submit payment details</h2>
      <p>Select an administrator-configured payment method. Your receipt will remain pending until manual review.</p>
      {error && <div className="form-error" role="alert">{error}</div>}
      {configuredOptions.length === 0 ? (
        <div className="form-info">No supported payment methods are currently active. Please return later or contact support; no payment has been recorded.</div>
      ) : (
        <>
          <fieldset className="field field-full"><legend className="field-label">Payment method</legend><div className="method-grid">
            {giftCardOptions.length > 0 && <div className="method-option"><input id="method-gift-card" type="radio" name="payment-method" checked={method === "gift_card"} onChange={() => chooseMethod("gift_card")} /><label htmlFor="method-gift-card"><strong>Gift card</strong><span>Apple, Razer Gold, or Xbox</span></label></div>}
            {cryptoOptions.length > 0 && <div className="method-option"><input id="method-cryptocurrency" type="radio" name="payment-method" checked={method === "cryptocurrency"} onChange={() => chooseMethod("cryptocurrency")} /><label htmlFor="method-cryptocurrency"><strong>Cryptocurrency</strong><span>BTC, USDT, ETH, or SOL</span></label></div>}
          </div></fieldset>
          {method === "gift_card" && <div className="field field-full"><label htmlFor="gift-card-option">Gift card type</label><select id="gift-card-option" value={optionId} onChange={(event) => setOptionId(event.target.value)}>{GIFT_CARD_TYPES.map((card) => { const entry = giftCardOptions.find((candidate) => candidate.descriptor.method === "gift_card" && candidate.descriptor.giftCardType === card.value); return <option key={card.value} value={entry?.item.id ?? card.value} disabled={!entry}>{card.label}{entry ? "" : " — unavailable"}</option>; })}</select></div>}
          {method === "cryptocurrency" && <div className="form-grid">
            <div className="field"><label htmlFor="crypto-option">Coin</label><select id="crypto-option" value={selectedCryptoAsset} onChange={(event) => chooseCryptoAsset(event.target.value as CryptoAsset)}>{CRYPTO_ASSETS.map((asset) => { const available = availableCryptoAssets.some((candidate) => candidate.value === asset.value); return <option key={asset.value} value={asset.value} disabled={!available}>{asset.label}{available ? "" : " — unavailable"}</option>; })}</select></div>
            {selectedCryptoAsset === "USDT" && <div className="field"><label htmlFor="usdt-network-option">USDT blockchain</label><select id="usdt-network-option" value={optionId} onChange={(event) => setOptionId(event.target.value)}>{USDT_NETWORKS.map((network) => { const entry = availableUsdtOptions.find((candidate) => candidate.descriptor.method === "cryptocurrency" && candidate.descriptor.network === network); return <option key={network} value={entry?.item.id ?? network} disabled={!entry}>{network}{entry ? "" : " — unavailable"}</option>; })}</select></div>}
          </div>}
          {option && descriptor && <div className="result-card pending"><h3>{descriptor.method === "gift_card" ? giftCardLabel(descriptor.giftCardType) : cryptoAssetLabel(descriptor.asset)}</h3><p>{option.instructions}</p>
            {option.method === "cryptocurrency" && <div className="form-grid">
              <div className="field"><label>Network</label><div className="code-box">{String(option.config.network || "Configured network")}</div></div>
              <div className="field"><label>Token</label><div className="code-box">{String(option.config.token || "Configured token")}</div></div>
              <div className="field field-full"><label>Wallet address</label><div className="copy-row"><div className="code-box" style={{ flex: 1 }}>{String(option.config.wallet_address || "")}</div><button type="button" className="icon-button" aria-label="Copy wallet address" onClick={() => navigator.clipboard.writeText(String(option.config.wallet_address || ""))}><Copy size={17} /></button></div></div>
              {wallet && qr && <div className="field field-full"><Image unoptimized src={qr} alt="QR code for the configured cryptocurrency wallet address" width={160} height={160} /></div>}
              <div className="field field-full"><div className="form-info">No transaction hash is required. Upload the requested payment evidence below; an authorised administrator will independently verify the transfer.</div></div>
            </div>}
            {option.method === "gift_card" && <div className="field"><label htmlFor="giftCardCode">Gift card code</label><input id="giftCardCode" name="giftCardCode" type="password" autoComplete="off" required /><small>The code is encrypted before storage and is visible only to authorised reviewers.</small></div>}
          </div>}
          <div className="field"><label htmlFor="evidence">Payment evidence</label><input id="evidence" name="evidence" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required /><small><UploadCloud size={14} /> JPG, PNG, WebP, or PDF up to 5 MB. Stored privately.</small></div>
          <div className="form-info">An uploaded image or transaction hash is not proof of confirmed payment. Status begins as Pending Verification.</div>
          <div className="form-actions"><button type="submit" className="button button-navy" disabled={submitting}>{submitting ? <><Loader2 className="animate-spin" size={17} /> Recording…</> : "Submit payment and generate receipt"}</button></div>
        </>
      )}
    </form>
  );
}
