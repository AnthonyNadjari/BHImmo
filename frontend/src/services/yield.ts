/** Rental-yield formatting + color bands. */

export function yieldColor(netYield: number): string {
  if (netYield >= 2.5) return "#0f7a4d";
  if (netYield >= 2.0) return "#b07d12";
  return "#5b6675";
}

export function yieldLabel(netYield: number): string {
  if (netYield >= 2.5) return "Strong";
  if (netYield >= 2.0) return "Average";
  return "Thin";
}
