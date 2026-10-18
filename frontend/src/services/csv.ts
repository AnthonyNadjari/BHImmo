/** Minimal CSV export with browser download. */

import type { IndexEntry } from "../types";
import { districtLabel } from "./format";

const COLUMNS: Array<{ header: string; value: (e: IndexEntry) => string | number | null }> = [
  { header: "id", value: (e) => e.id },
  { header: "address", value: (e) => e.address },
  { header: "arrondissement", value: (e) => districtLabel(e.district) },
  { header: "sale_date", value: (e) => e.sale_date },
  { header: "surface_m2", value: (e) => e.surface_m2 },
  { header: "rooms", value: (e) => e.rooms },
  { header: "quartier", value: (e) => e.quartier },
  { header: "price_eur", value: (e) => e.price },
  { header: "price_per_m2", value: (e) => e.price_per_m2 },
  { header: "estimate_eur", value: (e) => e.estimate },
  { header: "dvf_gap_pct", value: (e) => e.dvf_gap_pct },
  { header: "ppm2_percentile", value: (e) => e.ppm2_percentile },
  { header: "opportunity_score", value: (e) => e.opportunity_score },
  { header: "gross_yield_pct", value: (e) => e.gross_yield },
  { header: "net_yield_pct", value: (e) => e.net_yield },
  { header: "dpe", value: (e) => e.dpe_energy },
  { header: "dpe_scope", value: (e) => e.dpe_scope },
  { header: "flood_risk", value: (e) => e.flood },
  { header: "walk_score", value: (e) => e.walk_score },
  { header: "resale_change_pct", value: (e) => e.resale_change_pct },
  { header: "badge", value: (e) => e.badge },
];

function escape(value: string | number | null): string {
  let s = value === null ? "" : String(value);
  // Neutralize spreadsheet formula injection (=, +, -, @, tab, CR prefixes)
  // in text cells; numbers (e.g. a negative DVF gap) stay numeric.
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
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
