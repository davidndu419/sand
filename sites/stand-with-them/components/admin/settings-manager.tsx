"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { formatMoney } from "@/lib/domain";
import {
  CRYPTO_ASSETS,
  defaultCryptoInstructions,
  defaultGiftCardInstructions,
  defaultNetworkFor,
  describePaymentOption,
  GIFT_CARD_TYPES,
  giftCardLabel,
  paymentOptionLabel,
  USDT_NETWORKS,
  type CryptoAsset,
  type GiftCardType,
  type UsdtNetwork,
} from "@/lib/payment-options";
import type { PaymentMethod } from "@/lib/types";

type Option = {
  id: string;
  method: PaymentMethod;
  label: string;
  instructions: string;
  active: boolean;
  config: { token?: string; network?: string; wallet_address?: string; gift_card_type?: string } | null;
};

type SettingsManagerProps = {
  options: Option[];
  categories: Array<{ id: string; name: string; active: boolean; minimum_amount_minor: number; suggested_amounts_minor: number[] }>;
  contactEmail: string | null;
  contactPhone: string | null;
};

function optionConfiguration(option: Option) {
  const descriptor = describePaymentOption({ ...option, config: option.config ?? {} });
  if (!descriptor) return "Unsupported legacy option";
  if (descriptor.method === "gift_card") return giftCardLabel(descriptor.giftCardType);
  const wallet = String(option.config?.wallet_address || "");
  return `${descriptor.asset} · ${descriptor.network} · ${wallet.slice(0, 14)}${wallet.length > 14 ? "…" : ""}`;
}

function editableCategoryAmounts(category: SettingsManagerProps["categories"][number]) {
  const values = category.suggested_amounts_minor
    .filter((amount) => Number.isInteger(amount) && amount >= 100 && amount <= 100_000_000)
    .slice(0, 3);
  while (values.length < 3) {
    const previous = values.at(-1) ?? category.minimum_amount_minor;
    values.push(Math.min(100_000_000, Math.max(previous + 100, previous * 2)));
  }
  return values.map((amount) => String(amount / 100));
}

export function SettingsManager({ options, categories, contactEmail, contactPhone }: SettingsManagerProps) {
  const router = useRouter();
  const [paymentOptions, setPaymentOptions] = useState(options);
  const [method, setMethod] = useState<PaymentMethod>("cryptocurrency");
  const [giftCardType, setGiftCardType] = useState<GiftCardType>("apple");
  const [cryptoAsset, setCryptoAsset] = useState<CryptoAsset>("BTC");
  const [usdtNetwork, setUsdtNetwork] = useState<UsdtNetwork>("TRC20");
  const [instructions, setInstructions] = useState(() => defaultCryptoInstructions("BTC", defaultNetworkFor("BTC")));
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [editWalletAddress, setEditWalletAddress] = useState("");
  const [editInstructions, setEditInstructions] = useState("");
  const [categoryAmounts, setCategoryAmounts] = useState<Record<string, string[]>>(() => Object.fromEntries(
    categories.map((category) => [category.id, editableCategoryAmounts(category)]),
  ));
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
    const network = cryptoAsset === "USDT" ? usdtNetwork : defaultNetworkFor(cryptoAsset);
    const config = method === "cryptocurrency"
      ? { network, token: cryptoAsset, wallet_address: form.get("walletAddress") }
      : { gift_card_type: giftCardType };
    const label = method === "cryptocurrency"
      ? paymentOptionLabel(method, cryptoAsset, network)
      : paymentOptionLabel(method, giftCardType);
    try {
      const response = await fetch("/api/admin/payment-options", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ method, label, instructions: form.get("instructions"), config, active: true }),
      });
      const result = await response.json() as Option & { error?: string };
      if (!response.ok) throw new Error(result.error || "Option could not be saved.");
      setPaymentOptions((current) => [...current, result]);
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
      if (kind === "payment-options") {
        setPaymentOptions((current) => current.map((option) => option.id === id ? { ...option, active } : option));
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Status change failed.");
    } finally {
      setLoading(false);
    }
  }

  function beginPaymentOptionEdit(option: Option) {
    setEditingOptionId(option.id);
    setEditWalletAddress(option.config?.wallet_address || "");
    setEditInstructions(option.instructions);
    setError("");
    setSuccess("");
  }

  function cancelPaymentOptionEdit() {
    setEditingOptionId(null);
    setEditWalletAddress("");
    setEditInstructions("");
  }

  async function savePaymentOption(event: React.FormEvent<HTMLFormElement>, option: Option) {
    event.preventDefault();
    const trimmedInstructions = editInstructions.trim();
    const trimmedWalletAddress = editWalletAddress.trim();
    if (trimmedInstructions.length < 5) {
      setError("Public payment instructions must contain at least 5 characters.");
      return;
    }
    if (option.method === "cryptocurrency" && trimmedWalletAddress.length < 4) {
      setError("Enter the cryptocurrency wallet address.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/admin/payment-options/${option.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          instructions: trimmedInstructions,
          ...(option.method === "cryptocurrency" ? { walletAddress: trimmedWalletAddress } : {}),
        }),
      });
      const result = await response.json() as Option & { error?: string };
      if (!response.ok) throw new Error(result.error || "Payment option could not be updated.");
      setPaymentOptions((current) => current.map((item) => item.id === option.id ? result : item));
      cancelPaymentOptionEdit();
      setSuccess("Payment address and public instructions updated.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Payment option could not be updated.");
    } finally {
      setLoading(false);
    }
  }

  async function saveCategoryAmounts(categoryId: string) {
    setError("");
    setSuccess("");
    const values = categoryAmounts[categoryId] ?? [];
    const suggestedAmountsMinor = values.map((value) => Math.round(Number(value) * 100));
    if (suggestedAmountsMinor.length !== 3 || suggestedAmountsMinor.some((amount) => !Number.isInteger(amount) || amount < 100 || amount > 100_000_000)) {
      setError("Enter three donation amounts between $1.00 and $1,000,000.00.");
      return;
    }
    if (new Set(suggestedAmountsMinor).size !== 3) {
      setError("Enter three different donation amounts.");
      return;
    }
    suggestedAmountsMinor.sort((left, right) => left - right);
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/categories/${categoryId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ suggestedAmountsMinor }),
      });
      const result = await response.json() as { error?: string; suggestedAmountsMinor?: number[]; minimumAmountMinor?: number };
      if (!response.ok) throw new Error(result.error || "Donation amounts could not be saved.");
      const savedAmounts = result.suggestedAmountsMinor ?? suggestedAmountsMinor;
      setCategoryAmounts((current) => ({ ...current, [categoryId]: savedAmounts.map((amount) => String(amount / 100)) }));
      setSuccess(`Three donation amounts updated. The minimum is ${formatMoney(result.minimumAmountMinor ?? savedAmounts[0])}.`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Donation amounts could not be saved.");
    } finally {
      setLoading(false);
    }
  }

  const cryptoNetwork = cryptoAsset === "USDT" ? usdtNetwork : defaultNetworkFor(cryptoAsset);
  const publicLabel = method === "cryptocurrency"
    ? paymentOptionLabel(method, cryptoAsset, cryptoNetwork)
    : paymentOptionLabel(method, giftCardType);

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
          <div className="field"><label htmlFor="payment-method">Method</label><select id="payment-method" value={method} onChange={(event) => { const nextMethod = event.target.value as PaymentMethod; setMethod(nextMethod); setInstructions(nextMethod === "gift_card" ? defaultGiftCardInstructions(giftCardType) : defaultCryptoInstructions(cryptoAsset, cryptoNetwork)); }}><option value="cryptocurrency">Cryptocurrency</option><option value="gift_card">Gift card</option></select></div>
          <div className="field"><label htmlFor="payment-label">Public label</label><input id="payment-label" value={publicLabel} readOnly /></div>
          {method === "cryptocurrency" ? <>
            <div className="field"><label htmlFor="crypto-asset">Coin</label><select id="crypto-asset" value={cryptoAsset} onChange={(event) => { const nextAsset = event.target.value as CryptoAsset; const nextNetwork = nextAsset === "USDT" ? usdtNetwork : defaultNetworkFor(nextAsset); setCryptoAsset(nextAsset); setInstructions(defaultCryptoInstructions(nextAsset, nextNetwork)); }}>{CRYPTO_ASSETS.map((asset) => <option key={asset.value} value={asset.value}>{asset.label}</option>)}</select></div>
            {cryptoAsset === "USDT"
              ? <div className="field"><label htmlFor="crypto-network">USDT blockchain</label><select id="crypto-network" value={usdtNetwork} onChange={(event) => { const nextNetwork = event.target.value as UsdtNetwork; setUsdtNetwork(nextNetwork); setInstructions(defaultCryptoInstructions("USDT", nextNetwork)); }}>{USDT_NETWORKS.map((network) => <option key={network} value={network}>{network}</option>)}</select></div>
              : <div className="field"><label htmlFor="crypto-network-display">Blockchain network</label><input id="crypto-network-display" value={cryptoNetwork} readOnly /></div>}
            <div className="field field-full"><label htmlFor="wallet-address">Wallet address</label><input id="wallet-address" name="walletAddress" autoComplete="off" required /></div>
          </> : <div className="field field-full"><label htmlFor="gift-card-type">Accepted gift card type</label><select id="gift-card-type" value={giftCardType} onChange={(event) => { const nextType = event.target.value as GiftCardType; setGiftCardType(nextType); setInstructions(defaultGiftCardInstructions(nextType)); }}>{GIFT_CARD_TYPES.map((card) => <option key={card.value} value={card.value}>{card.label}</option>)}</select></div>}
          <div className="field field-full"><label htmlFor="payment-instructions">Public payment instructions</label><textarea id="payment-instructions" name="instructions" value={instructions} onChange={(event) => setInstructions(event.target.value)} required /></div>
        </div>
        <div className="form-actions"><button className="button button-navy" disabled={loading}>{loading ? <Loader2 className="animate-spin" size={17} /> : "Create payment option"}</button></div>
      </form>
    </section>

    <section className="admin-panel">
      <h2>Payment configuration</h2>
      <p>Edit an existing option to change the wallet address or the instructions donors see.</p>
      {!paymentOptions.length ? <div className="empty-state"><h3>No methods configured</h3><p>Donors cannot submit payment until a method is configured.</p></div> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Label</th><th>Method</th><th>Status</th><th>Configuration</th><th>Actions</th></tr></thead><tbody>{paymentOptions.map((option) => <Fragment key={option.id}>
        <tr><td><strong>{option.label}</strong></td><td>{option.method.replaceAll("_", " ")}</td><td><StatusBadge value={option.active ? "active" : "inactive"} /></td><td>{optionConfiguration(option)}</td><td><div className="table-actions"><button type="button" className="table-button" disabled={loading} onClick={() => beginPaymentOptionEdit(option)}>Edit</button><button type="button" className="table-button" disabled={loading} onClick={() => toggle("payment-options", option.id, !option.active)}>{option.active ? "Deactivate" : "Activate"}</button></div></td></tr>
        {editingOptionId === option.id && <tr className="payment-option-edit-row"><td colSpan={5}><form className="payment-option-edit" onSubmit={(event) => savePaymentOption(event, option)}><div className="form-grid">
          {option.method === "cryptocurrency" && <div className="field field-full"><label htmlFor={`edit-wallet-${option.id}`}>Wallet address</label><input id={`edit-wallet-${option.id}`} value={editWalletAddress} onChange={(event) => setEditWalletAddress(event.target.value)} autoComplete="off" required /></div>}
          <div className="field field-full"><label htmlFor={`edit-instructions-${option.id}`}>Public payment instructions</label><textarea id={`edit-instructions-${option.id}`} value={editInstructions} onChange={(event) => setEditInstructions(event.target.value)} required /></div>
        </div><div className="form-actions"><button type="submit" className="table-button" disabled={loading}>{loading ? <><Loader2 className="animate-spin" size={14} /> Savingâ€¦</> : "Save changes"}</button><button type="button" className="table-button" disabled={loading} onClick={cancelPaymentOptionEdit}>Cancel</button></div></form></td></tr>}
      </Fragment>)}</tbody></table></div>}
    </section>

    <section className="admin-panel">
      <h2>Support categories</h2>
      <p>Set the three amounts donors can choose for each category. The lowest amount automatically becomes the minimum.</p>
      <div className="table-wrap"><table className="data-table category-amount-table"><thead><tr><th>Category</th><th>Donation amounts (USD)</th><th>Status</th><th>Actions</th></tr></thead><tbody>{categories.map((category) => <tr key={category.id}><td><strong>{category.name}</strong></td><td><div className="category-amount-control">{[0, 1, 2].map((index) => <label key={index}><span>Amount {index + 1}</span><span className="category-amount-input"><b>$</b><input type="number" min="1" max="1000000" step="0.01" value={categoryAmounts[category.id]?.[index] ?? ""} onChange={(event) => setCategoryAmounts((current) => {
        const next = [...(current[category.id] ?? ["", "", ""])] as string[];
        next[index] = event.target.value;
        return { ...current, [category.id]: next };
      })} aria-label={`Amount ${index + 1} for ${category.name}`} /></span></label>)}<button type="button" className="table-button" disabled={loading} onClick={() => saveCategoryAmounts(category.id)}>Save amounts</button></div></td><td><StatusBadge value={category.active ? "active" : "inactive"} /></td><td><button type="button" className="table-button" disabled={loading} onClick={() => toggle("categories", category.id, !category.active)}>{category.active ? "Deactivate" : "Activate"}</button></td></tr>)}</tbody></table></div>
    </section>
  </>;
}
