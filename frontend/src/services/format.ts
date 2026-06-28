/** Display formatting helpers + score/badge visual mapping. */

import type { Badge } from "../types";

const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const num = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

export const formatEuro = (n: number): string => eur.format(n);
export const formatNumber = (n: number): string => num.format(n);
export const formatPerM2 = (n: number): string => `${num.format(n)} €/m²`;

export function formatPercent(n: number, withSign = true): string {
  const sign = withSign && n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function districtLabel(district: string): string {
  const n = Number(district.slice(-2));
  return `${n}${n === 1 ? "er" : "e"}`;
}

/** Color ramp for an opportunity score (0–100). */
export function scoreColor(score: number): string {
  if (score >= 68) return "#1a8a4a"; // green
  if (score >= 50) return "#b8860b"; // amber
  if (score >= 45) return "#c2741c"; // orange
  return "#b03a3a"; // red
}

export interface BadgeMeta {
  emoji: string;
  label: string;
  className: string;
}

export const BADGES: Record<Badge, BadgeMeta> = {
  opportunity: { emoji: "🔥", label: "Opportunity", className: "badge-opportunity" },
  watch: { emoji: "⚠️", label: "Watch", className: "badge-watch" },
  overvalued: { emoji: "❌", label: "Overvalued", className: "badge-overvalued" },
};

export const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  sold: "Sold",
  removed: "Removed",
};
