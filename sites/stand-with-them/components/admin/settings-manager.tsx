"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { StatusBadge } from "@/components/status-badge";

type Option = {
  id: string;
  method: string;
  label: string;
  active: boolean;
  config?: { token?: string; network?: string; wallet_address?: string; gift_card_type?: string } | null;
};

type SettingsManagerProps = {
  options: Option[];
  categories: Array<{ id: string; name: string; active: boolean }>;
  contactEmail: string | null;
  contactPhone: string | null;
};

export function SettingsManager({ options, categories, contactEmail, contactPhone }: SettingsManagerProps) {
  const router = useRouter();
  const [method, setMethod] = useState("cryptocurrency");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function addOption(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setLoading(true);
    setError("");
    setSuccess("");
    const form = new FormData(formElement);
    const config = method === "cryptocurrency"
      ? { network: form.get("network"), token: form.get("token"), wallet_address: form.get("walletAddress") }
      : { gift_card_type: form.get("giftCardType") };
    try {
      const response = await fetch("/api/admin/payment-options", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ method, label: form.get("label"), instructions: form.get("instructions"), config, active: true }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Option could not be saved.");
      setSuccess("Payment option created and audited.");
      formElement.reset();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Option could not be saved.");
    } finally {
      setLoading(false);
    }
  }

  async function saveContact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/settings/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), phone: form.get("phone") }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Contact details could not be saved.");
      setSuccess("Public support email and phone settings saved and audited.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Contact details could not be saved.");
    } finally {
      setLoading(false);
    }
  }

  async function toggle(kind: "payment-options" | "categories", id: string, active: boolean) {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/admin/${kind}/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Status change failed.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Status change failed.");
    } finally {
      setLoading(false);
    }
  }

  return <>
    {error && <div className="form-error">{error}</div>}
    {success && <div className="form-success">{success}</div>}

    <section className="admin-panel">
      <h2>Public contact details</h2>
      <p>These details appear on the landing-page footer and the Contact page. Keep at least one monitored support channel published.</p>
      <form onSubmit={saveContact}>
        <div className="form-grid">
          <div className="field"><label htmlFor="contact-email">Support email</label><input id="contact-email" name="email" type="email" defaultValue={contactEmail || ""} placeholder="support@example.com" autoComplete="email" /></div>
          <div className="field"><label htmlFor="contact-phone">Support phone number</label><input id="contact-phone" name="phone" type="tel" defaultValue={contactPhone || ""} placeholder="+234 800 000 0000" autoComplete="tel" /></div>
        </div>
        <div className="form-actions"><button className="button button-navy" disabled={loading}>{loading ? <><Loader2 className="animate-spin" size={17} /> Saving…</> : "Save public contact"}</button></div>
      </form>
    </section>

    <section className="admin-panel">
      <h2>Add payment option</h2>
      <form onSubmit={addOption}>
        <div className="form-grid">
          <div className="field"><label>Method</label><select value={method} onChange={(event) => setMethod(event.target.value)}><option value="cryptocurrency">Cryptocurrency</option><option value="gift_card">Gift card</option></select></div>
          <div className="field"><label>Public label</label><input name="label" placeholder={method === "cryptocurrency" ? "USDT on Ethereum" : "Apple Gift Card"} required /></div>
          {method === "cryptocurrency" ? <>
            <div className="field"><label>Blockchain network</label><input name="network" required /></div>
            <div className="field"><label>Token</label><input name="token" required /></div>
            <div className="field field-full"><label>Wallet address</label><input name="walletAddress" autoComplete="off" required /></div>
          </> : <div className="field field-full"><label>Accepted gift card type</label><input name="giftCardType" required /></div>}
          <div className="field field-full"><label>Public payment instructions</label><textarea name="instructions" required /></div>
        </div>
        <div className="form-actions"><button className="button button-navy" disabled={loading}>{loading ? <Loader2 className="animate-spin" size={17} /> : "Create payment option"}</button></div>
      </form>
    </section>

    <section className="admin-panel">
      <h2>Payment configuration</h2>
      {!options.length ? <div className="empty-state"><h3>No methods configured</h3><p>Donors cannot submit payment until a method is configured.</p></div> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Label</th><th>Method</th><th>Status</th><th>Configuration</th><th>Action</th></tr></thead><tbody>{options.map((option) => <tr key={option.id}><td><strong>{option.label}</strong></td><td>{option.method.replaceAll("_", " ")}</td><td><StatusBadge value={option.active ? "active" : "inactive"} /></td><td>{option.method === "cryptocurrency" ? `${option.config?.token || ""} · ${option.config?.network || ""} · ${String(option.config?.wallet_address || "").slice(0, 14)}…` : option.config?.gift_card_type}</td><td><button className="table-button" disabled={loading} onClick={() => toggle("payment-options", option.id, !option.active)}>{option.active ? "Deactivate" : "Activate"}</button></td></tr>)}</tbody></table></div>}
    </section>

    <section className="admin-panel">
      <h2>Support categories</h2>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Category</th><th>Status</th><th>Action</th></tr></thead><tbody>{categories.map((category) => <tr key={category.id}><td><strong>{category.name}</strong></td><td><StatusBadge value={category.active ? "active" : "inactive"} /></td><td><button className="table-button" disabled={loading} onClick={() => toggle("categories", category.id, !category.active)}>{category.active ? "Deactivate" : "Activate"}</button></td></tr>)}</tbody></table></div>
    </section>
  </>;
}
