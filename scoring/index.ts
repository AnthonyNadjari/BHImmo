/**
 * Scoring module (Step 6). Scores the whole dataset so each property can be
 * ranked against its arrondissement (price percentile) and the city
 * (gentrification). Produces the `Score`, `Signals` and `Investment` for every
 * property, plus the city median trend used by the market model.
 */

import type { Property, Signals } from "../shared/types.ts";
import { extractSignals } from "./signals.ts";
import { buildExplanations, computeScore, gentrificationByDistrict } from "./score.ts";

export { WEIGHTS } from "./score.ts";
export { LONG_MARKET_DAYS } from "./signals.ts";

export interface DatasetScoring {
  cityMedianTrend: number;
}

/** Score every property in place. Returns aggregate context for the market model. */
export function scoreDataset(properties: Property[]): DatasetScoring {
  const { map: gentMap, cityMedianTrend } = gentrificationByDistrict();

  // Sorted €/m² per arrondissement, for the price percentile.
  const ppm2ByDistrict = new Map<string, number[]>();
  for (const p of properties) {
    const list = ppm2ByDistrict.get(p.address.district) ?? [];
    list.push(p.pricing.price_per_m2);
    ppm2ByDistrict.set(p.address.district, list);
  }
  for (const list of ppm2ByDistrict.values()) list.sort((a, b) => a - b);

  for (const property of properties) {
    const raw = extractSignals(
      property.price_history,
      property.pricing.initial_price,
      property.pricing.current_price,
      property.timeline.days_on_market,
    );

    const input = {
      current_price: property.pricing.current_price,
      price_per_m2: property.pricing.price_per_m2,
      surface_m2: property.characteristics.surface_m2,
      district: property.address.district,
      daysOnMarket: property.timeline.days_on_market,
      dvf: property.dvf,
      transport_score: property.transport_score,
      walk_score: property.neighborhood?.walk_score ?? 50,
      rent_max_m2: property.rent?.max_m2 ?? 27,
      energy_class: property.dpe?.energy_class,
      signals: raw,
      districtPpm2: ppm2ByDistrict.get(property.address.district) ?? [],
      gentrification: gentMap.get(property.address.district) ?? 50,
    };

    const out = computeScore(input);
    const signals: Signals = {
      price_drops: raw.price_drops,
      total_drop_percent: raw.total_drop_percent,
      long_time_on_market: raw.long_time_on_market,
      explanations: buildExplanations(out, input, raw, property.timeline.days_on_market),
    };

    property.score = out.score;
    property.signals = signals;
    property.investment = out.investment;
  }

  return { cityMedianTrend };
}
