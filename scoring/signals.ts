/**
 * Factual signals and human-readable explanations. Every bullet restates a
 * real data point (DVF, ADEME, Géorisques, IDFM, rent control) or a score
 * derived from it — no simulated market behaviour.
 */

import { round } from "../shared/geo.ts";
import { marketChangePct, type PriceIndex } from "../scraper/index.ts";
import type { PriceHistoryPoint, Property, Resale } from "../shared/types.ts";
import type { ScoreOutput } from "./score.ts";

const fr = (n: number) => n.toLocaleString("fr-FR");
const DAY_MS = 86_400_000;

/** Previous DVF sale of the same lot, if any, vs. the market over the same span. */
export function resaleSignal(history: PriceHistoryPoint[], index: PriceIndex): Resale | null {
  if (history.length < 2) return null;
  const prev = history[history.length - 2]!;
  const last = history[history.length - 1]!;
  return {
    previous_date: prev.date,
    previous_price: prev.price,
    change_pct: round(((last.price - prev.price) / prev.price) * 100, 1),
    years: round((Date.parse(last.date) - Date.parse(prev.date)) / (365.25 * DAY_MS), 1),
    market_change_pct: marketChangePct(index, prev.date, last.date),
  };
}

export function buildExplanations(p: Property, out: ScoreOutput, districtLabel: string, year: string): string[] {
  const lines: string[] = [];
  const gap = out.investment.dvf_gap_pct;
  const basis = p.dvf.reference_basis;
  if (gap !== null && out.dvfReference && basis) {
    const what = basis.size_min !== null ? `${basis.comps} similar-size sales ≤ ${basis.radius_m} m` : `${basis.comps} sales ≤ ${basis.radius_m} m`;
    const eur = out.investment.estimate_gap_eur;
    const money = eur !== null && Math.abs(eur) >= 1000 ? ` — ${fr(Math.abs(eur))} € ${eur > 0 ? "under" : "over"} the estimate` : "";
    if (gap >= 1) lines.push(`${gap}% below the local reference (${fr(out.dvfReference)} €/m², ${what})${money}`);
    else if (gap <= -1) lines.push(`${Math.abs(gap)}% above the local reference (${fr(out.dvfReference)} €/m², ${what})${money}`);
    else lines.push(`In line with the local reference (${fr(out.dvfReference)} €/m², ${what})`);
  } else {
    lines.push("Too few DVF sales nearby to compute a local reference");
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
    const sign = (n: number) => (n >= 0 ? "+" : "");
    const market = r.market_change_pct === null ? "" : `; Paris market ${sign(r.market_change_pct)}${r.market_change_pct}%`;
    lines.push(
      `Resold: bought ${fr(r.previous_price)} € in ${r.previous_date.slice(0, 7)} (${sign(r.change_pct)}${r.change_pct}% over ${r.years} y${market})`,
    );
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
