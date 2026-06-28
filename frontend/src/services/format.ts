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
/** Compact income, e.g. 44 000 → "44 k€". */
export const formatIncome = (n: number): string => `${Math.round(n / 1000)} k€`;

export function formatPercent(n: number, withSign = true): string {
  const sign = withSign && n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

/** Parse a date that may be date-only ("2025-09-15") as LOCAL midnight. */
function parseDate(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? new Date(+m[1]!, +m[2]! - 1, +m[3]!) : new Date(iso);
}

export function formatDate(iso: string): string {
  if (!iso) return "—";
  return parseDate(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Short relative time, e.g. "3 h ago", "just now". */
export function timeAgo(iso: string): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} d ago`;
}

export function districtLabel(district: string): string {
  const n = Number(district.slice(-2));
  return `${n}${n === 1 ? "er" : "e"}`;
}

/** Color ramp for an opportunity score (0–100). Synced to the cold terminal palette. */
export function scoreColor(score: number): string {
  if (score >= 68) return "#2dd4bf"; // --score-high (teal)
  if (score >= 50) return "#38bdf8"; // --score-mid (azure)
  if (score >= 45) return "#818cf8"; // --score-low (indigo)
  return "#fb5a78"; // --score-bad (rose)
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
