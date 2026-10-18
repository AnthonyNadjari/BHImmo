/**
 * Factual signals and human-readable explanations. Every bullet restates a
 * real data point (DVF, ADEME, Géorisques, IDFM, rent control) or a score
 * derived from it — no simulated market behaviour.
 */

import { round } from "../shared/geo.ts";
import type { PriceHistoryPoint, Property, Resale } from "../shared/types.ts";
import type { ScoreOutput } from "./score.ts";

const fr = (n: number) => n.toLocaleString("fr-FR");
const DAY_MS = 86_400_000;

/** Previous DVF sale of the same lot, if any. */
export function resaleSignal(history: PriceHistoryPoint[]): Resale | null {
  if (history.length < 2) return null;
  const prev = history[history.length - 2]!;
  const last = history[history.length - 1]!;
  return {
    previous_date: prev.date,
    previous_price: prev.price,
    change_pct: round(((last.price - prev.price) / prev.price) * 100, 1),
    years: round((Date.parse(last.date) - Date.parse(prev.date)) / (365.25 * DAY_MS), 1),
  };
}

export function buildExplanations(p: Property, out: ScoreOutput, districtLabel: string, year: string): string[] {
  const lines: string[] = [];
  const gap = out.investment.dvf_gap_pct;
  if (gap !== null && out.dvfReference) {
    const n = p.dvf.count_500m;
    if (gap >= 1) lines.push(`${gap}% below the local DVF average (${fr(out.dvfReference)} €/m², ${n} sales ≤ 500 m)`);
    else if (gap <= -1) lines.push(`${Math.abs(gap)}% above the local DVF average (${fr(out.dvfReference)} €/m², ${n} sales ≤ 500 m)`);
    else lines.push(`In line with the local DVF average (${fr(out.dvfReference)} €/m²)`);
  } else {
    lines.push("Too few DVF sales nearby to compute a local average");
  }
  const pct = out.investment.ppm2_percentile;
  if (pct <= 35) lines.push(`Cheaper per m² than ${Math.round(100 - pct)}% of ${districtLabel} sales in ${year}`);
  else if (pct >= 80) lines.push(`Pricier per m² than ${Math.round(pct)}% of ${districtLabel} sales in ${year}`);

  if (out.investment.net_yield !== null && p.rent) {
    lines.push(
      `${out.investment.net_yield.toFixed(1)}% net yield at the legal rent ceiling (${p.rent.max_m2} €/m², gross ${out.investment.gross_yield!.toFixed(1)}%)`,
    );
  }

  const r = p.signals.resale;
  if (r) {
    const sign = r.change_pct >= 0 ? "+" : "";
    lines.push(`Resold: bought ${fr(r.previous_price)} € in ${r.previous_date.slice(0, 7)} (${sign}${r.change_pct}% over ${r.years} y)`);
  }

  if (p.dpe) {
    const scope = p.dpe.scope === "unit" ? "this apartment" : `building median of ${p.dpe.certificates} certificates`;
    if (out.investment.value_add_flag) lines.push(`Value-add: DPE ${p.dpe.energy_class} discount exceeds the renovation cost`);
    else if (p.dpe.energy_class === "G" || p.dpe.energy_class === "F") {
      lines.push(`DPE ${p.dpe.energy_class} (${scope}) — rental restrictions apply`);
    } else lines.push(`DPE ${p.dpe.energy_class} (${scope})`);
  }

  if (p.risks.flood && p.risks.flood.value >= 0.66) lines.push(`Flood zone: ${p.risks.flood.label} (Géorisques TRI)`);
  if (p.transport && p.transport.nearest_m <= 300) {
    lines.push(`${p.transport.nearest_name} at ${p.transport.nearest_m} m`);
  }
  return lines;
}
