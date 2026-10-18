/**
 * Scoring module (Step 6). Scores the whole dataset so each property can be
 * ranked against its arrondissement's real DVF sales, and produces the
 * `Score`, `Signals` and `Investment` for every property.
 */

import { getInseeProfile } from "../enrichment/insee.ts";
import type { DistrictMarket, PriceIndex } from "../scraper/index.ts";
import type { Property } from "../shared/types.ts";
import { computeScore, gentrificationByDistrict } from "./score.ts";
import { buildExplanations, resaleSignal } from "./signals.ts";

export { WEIGHTS, ACQUISITION_FEES, ANNUAL_CHARGES } from "./score.ts";

export interface ScoringContext {
  markets: Map<string, DistrictMarket>;
  cityTrend: number | null;
  latestYear: string;
  /** Sorted €/m² of every DVF sale per arrondissement (latest vintage). */
  districtPpm2: Map<string, number[]>;
  index: PriceIndex;
}

function rank(values: number[], v: number): number {
  let below = 0;
  for (const x of values) if (x < v) below++;
  return (below / Math.max(1, values.length - 1)) * 100;
}

const districtLabel = (d: string) => {
  const n = Number(d.slice(-2));
  return `${n}${n === 1 ? "er" : "e"}`;
};

/** Score every property in place. */
export function scoreDataset(properties: Property[], ctx: ScoringContext): void {
  const markets = [...ctx.markets.values()];
  const gent = gentrificationByDistrict(
    markets.map((m) => ({
      district: m.district,
      trend: m.trendPct,
      medianPpm2: m.medianLatest,
      income: getInseeProfile(m.district).income,
    })),
    ctx.cityTrend,
  );
  const medians = markets.map((m) => m.medianLatest);
  const volumes = properties.map((p) => p.dvf.count_500m);

  for (const p of properties) {
    const market = ctx.markets.get(p.address.district);
    p.signals = { resale: resaleSignal(p.price_history, ctx.index), explanations: [] };
    const out = computeScore({
      price: p.sale.price,
      price_per_m2: p.sale.price_per_m2,
      surface_m2: p.characteristics.surface_m2,
      dvf: p.dvf,
      transport_score: p.transport?.score ?? null,
      walk_score: p.neighborhood.walk_score,
      rent_max_m2: p.rent?.max_m2 ?? null,
      rent_surface_m2: p.characteristics.carrez_m2 ?? p.characteristics.surface_m2,
      energy_class: p.dpe?.energy_class ?? null,
      districtPpm2: ctx.districtPpm2.get(p.address.district) ?? [],
      demand: market ? rank(medians, market.medianLatest) : null,
      volume: rank(volumes, p.dvf.count_500m),
      gentrification: gent.get(p.address.district) ?? null,
    });
    p.score = out.score;
    p.investment = out.investment;
    p.signals.explanations = buildExplanations(p, out, districtLabel(p.address.district), ctx.latestYear);
  }
}
