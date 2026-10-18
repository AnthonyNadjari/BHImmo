/** Rental-yield formatting + color bands (null = no rent-control data). */

export function yieldColor(netYield: number | null): string {
  if (netYield === null) return "#64748b";
  if (netYield >= 2.5) return "#0e9488";
  if (netYield >= 2.0) return "#2563eb";
  return "#64748b";
}

export function yieldLabel(netYield: number | null): string {
  if (netYield === null) return "No rent data";
  if (netYield >= 2.5) return "Strong";
  if (netYield >= 2.0) return "Average";
  return "Thin";
}
