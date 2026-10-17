import { formatStatusLabel } from "@/lib/domain";

export function StatusBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const tone = normalized === "confirmed" || normalized === "delivered" ? "success" : normalized === "declined" || normalized === "unable_to_fulfil" || normalized === "cancelled" ? "danger" : "pending";
  return <span className={`status-badge status-${tone}`}>{formatStatusLabel(value)}</span>;
}
