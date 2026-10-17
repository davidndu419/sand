import type { AdminRole, FulfilmentStatus, PaymentStatus } from "@/lib/types";

const TAG_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function randomCode(length = 20, alphabet = TAG_ALPHABET) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

export function generateSoldierTag() {
  return `SLD-${randomCode(8)}`;
}

export function normalizeSoldierTag(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function formatMoney(amountMinor: number, currency = "USD") {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amountMinor / 100);
}

const statusLabels: Record<string, string> = {
  draft: "Payment Not Submitted",
  pending: "Pending Verification",
  confirmed: "Confirmed",
  declined: "Declined",
  awaiting_payment_confirmation: "Awaiting Payment Confirmation",
  awaiting_allocation: "Awaiting Allocation",
  funds_allocated: "Funds Allocated",
  purchase_in_progress: "Purchase in Progress",
  awaiting_delivery: "Awaiting Delivery",
  delivered: "Delivered",
  unable_to_fulfil: "Unable to Fulfil",
  cancelled: "Cancelled",
};

export function formatStatusLabel(value: string) {
  return statusLabels[value.toLowerCase()] ?? value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export const paymentTransitions: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ["confirmed", "declined"],
  confirmed: [],
  declined: [],
};

export const fulfilmentTransitions: Record<
  FulfilmentStatus,
  FulfilmentStatus[]
> = {
  awaiting_payment_confirmation: ["awaiting_allocation", "cancelled"],
  awaiting_allocation: ["funds_allocated", "unable_to_fulfil", "cancelled"],
  funds_allocated: [
    "purchase_in_progress",
    "awaiting_delivery",
    "unable_to_fulfil",
    "cancelled",
  ],
  purchase_in_progress: [
    "awaiting_delivery",
    "delivered",
    "unable_to_fulfil",
    "cancelled",
  ],
  awaiting_delivery: ["delivered", "unable_to_fulfil", "cancelled"],
  delivered: [],
  unable_to_fulfil: [],
  cancelled: [],
};

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus) {
  return paymentTransitions[from].includes(to);
}

export function canTransitionFulfilment(
  from: FulfilmentStatus,
  to: FulfilmentStatus,
) {
  return fulfilmentTransitions[from].includes(to);
}

export function roleCan(
  role: AdminRole,
  permission: "manage_soldiers" | "review_payments" | "manage_fulfilment" | "manage_settings",
) {
  if (role === "super_administrator") return true;
  if (permission === "review_payments") return role === "payment_reviewer";
  if (permission === "manage_fulfilment" || permission === "manage_soldiers") {
    return role === "fulfilment_manager";
  }
  return false;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function importEncryptionKey() {
  const encoded = process.env.PAYMENT_ENCRYPTION_KEY_BASE64;
  if (!encoded) throw new Error("Payment encryption is not configured.");
  const key = base64ToBytes(encoded);
  if (key.byteLength !== 32) {
    throw new Error("PAYMENT_ENCRYPTION_KEY_BASE64 must encode exactly 32 bytes.");
  }
  return crypto.subtle.importKey("raw", key, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptSensitiveValue(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await importEncryptionKey();
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(value),
  );
  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(ciphertext))}`;
}

export async function decryptSensitiveValue(value: string) {
  const [ivEncoded, ciphertextEncoded] = value.split(".");
  if (!ivEncoded || !ciphertextEncoded) throw new Error("Invalid encrypted value.");
  const key = await importEncryptionKey();
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(ivEncoded) },
    key,
    base64ToBytes(ciphertextEncoded),
  );
  return new TextDecoder().decode(plaintext);
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
