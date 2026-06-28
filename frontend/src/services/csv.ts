/** Minimal CSV export with browser download. */

import type { IndexEntry } from "../types";
import { districtLabel } from "./format";

const COLUMNS: Array<{ header: string; value: (e: IndexEntry) => string | number }> = [
  { header: "id", value: (e) => e.id },
  { header: "address", value: (e) => e.address },
  { header: "arrondissement", value: (e) => districtLabel(e.district) },
  { header: "surface_m2", value: (e) => e.surface_m2 },
  { header: "rooms", value: (e) => e.rooms },
  { header: "price_eur", value: (e) => e.current_price },
  { header: "price_per_m2", value: (e) => e.price_per_m2 },
  { header: "opportunity_score", value: (e) => e.opportunity_score },
  { header: "walk_score", value: (e) => e.walk_score },
  { header: "price_drops", value: (e) => e.price_drops },
  { header: "total_drop_percent", value: (e) => e.total_drop_percent },
  { header: "days_on_market", value: (e) => e.days_on_market },
  { header: "status", value: (e) => e.status },
  { header: "badge", value: (e) => e.badge },
];

function escape(value: string | number): string {
  let s = String(value);
  // Neutralize spreadsheet formula injection (=, +, -, @, tab, CR prefixes).
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(entries: IndexEntry[]): string {
  const head = COLUMNS.map((c) => c.header).join(",");
  const rows = entries.map((e) => COLUMNS.map((c) => escape(c.value(e))).join(","));
  return [head, ...rows].join("\n");
}

export function downloadCsv(entries: IndexEntry[], filename = "prer-export.csv"): void {
  const blob = new Blob([toCsv(entries)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
