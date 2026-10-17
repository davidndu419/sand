"use client";

import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatMoney, normalizeSoldierTag } from "@/lib/domain";
import type { PublicCategory } from "@/lib/types";

export function DonationForm({
  kind,
  categories,
  initialCategory,
}: {
  kind: "soldier" | "general";
  categories: PublicCategory[];
  initialCategory?: string;
}) {
  const router = useRouter();
  const usableCategories = categories.filter((category) =>
    kind === "general" ? true : category.slug !== "general-support",
  );
  const [categorySlug, setCategorySlug] = useState(
    usableCategories.some((category) => category.slug === initialCategory)
      ? initialCategory!
      : usableCategories[0]?.slug ?? "",
  );
  const category = useMemo(
    () => usableCategories.find((item) => item.slug === categorySlug),
    [usableCategories, categorySlug],
  );
  const [tag, setTag] = useState("");
  const [tagValid, setTagValid] = useState(kind === "general");
  const [checkingTag, setCheckingTag] = useState(false);
  const [amountMinor, setAmountMinor] = useState(category?.suggested_amounts_minor[0] ?? 2500);
  const [customAmount, setCustomAmount] = useState("");
  const [donorName, setDonorName] = useState("");
  const [donorEmail, setDonorEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function changeCategory(value: string) {
    setCategorySlug(value);
    const next = usableCategories.find((item) => item.slug === value);
    setAmountMinor(next?.suggested_amounts_minor[0] ?? 2500);
    setCustomAmount("");
    if (kind === "soldier") setTagValid(false);
  }

  async function validateTag() {
    setError("");
    setCheckingTag(true);
    setTagValid(false);
    try {
      const response = await fetch("/api/soldiers/validate-tag", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tag: normalizeSoldierTag(tag), categorySlug }),
      });
      const result = await response.json() as { valid?: boolean; error?: string };
      if (!response.ok || !result.valid) throw new Error(result.error || "That tag is not available for this category.");
      setTag(normalizeSoldierTag(tag));
      setTagValid(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The tag could not be validated.");
    } finally {
      setCheckingTag(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const finalAmount = customAmount ? Math.round(Number(customAmount) * 100) : amountMinor;
    if (kind === "soldier" && !tagValid) {
      setError("Validate the soldier tag for the selected category before continuing.");
      return;
    }
    if (!Number.isInteger(finalAmount) || finalAmount < 100) {
      setError("Enter an amount of at least $1.00.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/donations/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          soldierTag: kind === "soldier" ? tag : undefined,
          categorySlug,
          amountMinor: finalAmount,
          currency: "USD",
          donorName,
          donorEmail,
        }),
      });
      const result = await response.json() as { error?: string; donationId?: string; accessCode?: string };
      if (!response.ok) throw new Error(result.error || "The donation could not be started.");
      if (!result.donationId || !result.accessCode) throw new Error("The donation response was incomplete.");
      router.push(`/donate/payment/${result.donationId}?access=${encodeURIComponent(result.accessCode)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The donation could not be started.");
      setSubmitting(false);
    }
  }

  return (
    <form className="form-card" onSubmit={submit}>
      <h2>{kind === "soldier" ? "Support a specific soldier" : "General soldier support"}</h2>
      <p>{kind === "soldier" ? "Use the administrator-issued tag shared by the intended soldier. No private identity is revealed." : "General contributions remain separate and may be allocated only through documented, authorised decisions."}</p>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="form-grid">
        {kind === "soldier" && (
          <div className="field field-full">
            <label htmlFor="soldier-tag">Soldier tag</label>
            <div className="copy-row">
              <input id="soldier-tag" value={tag} onChange={(event) => { setTag(event.target.value); setTagValid(false); }} placeholder="SLD-XXXXXXXX" autoCapitalize="characters" autoComplete="off" required />
              <button className="button button-outline" type="button" onClick={validateTag} disabled={checkingTag || !tag.trim()}>
                {checkingTag ? <Loader2 className="animate-spin" size={17} /> : tagValid ? <CheckCircle2 size={17} /> : <ShieldCheck size={17} />}
                {tagValid ? "Validated" : "Validate"}
              </button>
            </div>
            <small>Tags are created only by authorised administrators. Validation reveals no private soldier information.</small>
          </div>
        )}
        <div className="field field-full">
          <label htmlFor="category">Support category</label>
          <select id="category" value={categorySlug} onChange={(event) => changeCategory(event.target.value)} required>
            {usableCategories.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
          </select>
          <small>{category?.description}</small>
        </div>
        <fieldset className="field field-full">
          <legend className="field-label">Choose an amount (USD)</legend>
          <div className="amount-grid">
            {category?.suggested_amounts_minor.map((amount) => (
              <div className="amount-option" key={amount}>
                <input id={`amount-${amount}`} name="amount" type="radio" checked={!customAmount && amountMinor === amount} onChange={() => { setAmountMinor(amount); setCustomAmount(""); }} />
                <label htmlFor={`amount-${amount}`}>{formatMoney(amount)}</label>
              </div>
            ))}
          </div>
        </fieldset>
        <div className="field field-full">
          <label htmlFor="custom-amount">Or enter a custom amount (USD)</label>
          <input id="custom-amount" type="number" min="1" max="1000000" step="0.01" value={customAmount} onChange={(event) => setCustomAmount(event.target.value)} placeholder="0.00" />
        </div>
        <div className="field"><label htmlFor="donor-name">Name (optional)</label><input id="donor-name" value={donorName} onChange={(event) => setDonorName(event.target.value)} maxLength={100} autoComplete="name" /></div>
        <div className="field"><label htmlFor="donor-email">Email (optional)</label><input id="donor-email" type="email" value={donorEmail} onChange={(event) => setDonorEmail(event.target.value)} maxLength={254} autoComplete="email" /></div>
      </div>
      <div className="form-info">No payment is treated as confirmed at submission. An authorised administrator must review it first.</div>
      <div className="form-actions"><button className="button button-navy" type="submit" disabled={submitting}>{submitting ? <Loader2 className="animate-spin" size={17} /> : <>Continue to payment <ArrowRight size={17} /></>}</button></div>
    </form>
  );
}
