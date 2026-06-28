/** Rental-yield formatting + color bands. */

export function yieldColor(netYield: number): string {
  if (netYield >= 2.5) return "#3ecf8e";
  if (netYield >= 2.0) return "#e0a44a";
  return "#968a73";
}

export function yieldLabel(netYield: number): string {
  if (netYield >= 2.5) return "Strong";
  if (netYield >= 2.0) return "Average";
  return "Thin";
}
