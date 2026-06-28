/** Rental-yield formatting + color bands. */

export function yieldColor(netYield: number): string {
  if (netYield >= 2.5) return "#2dd4bf";
  if (netYield >= 2.0) return "#38bdf8";
  return "#6c7f9a";
}

export function yieldLabel(netYield: number): string {
  if (netYield >= 2.5) return "Strong";
  if (netYield >= 2.0) return "Average";
  return "Thin";
}
