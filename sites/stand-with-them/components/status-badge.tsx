export function StatusBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const tone = normalized.includes("confirm") || normalized === "delivered" ? "success" : normalized.includes("declin") || normalized.includes("unable") || normalized === "cancelled" ? "danger" : "pending";
  return <span className={`status-badge status-${tone}`}>{value.replaceAll("_", " ")}</span>;
}
