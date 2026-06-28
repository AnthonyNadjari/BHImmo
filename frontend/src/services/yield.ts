/** Rental-yield formatting + color bands. */

export function yieldColor(netYield: number): string {
  if (netYield >= 2.5) return "#0e9488";
  if (netYield >= 2.0) return "#2563eb";
  return "#64748b";
}

export function yieldLabel(netYield: number): string {
  if (netYield >= 2.5) return "Strong";
  if (netYield >= 2.0) return "Average";
  return "Thin";
}
