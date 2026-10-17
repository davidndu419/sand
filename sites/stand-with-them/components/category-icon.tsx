import { HeartPulse, Package, Shirt, Shield, Signal, Utensils } from "lucide-react";

export function CategoryIcon({ name, size = 26 }: { name: string; size?: number }) {
  const props = { size, strokeWidth: 1.7, "aria-hidden": true as const };
  if (name === "utensils") return <Utensils {...props} />;
  if (name === "signal") return <Signal {...props} />;
  if (name === "heart-pulse") return <HeartPulse {...props} />;
  if (name === "shirt") return <Shirt {...props} />;
  if (name === "shield") return <Shield {...props} />;
  return <Package {...props} />;
}
