/**
 * Scoring module (Step 6 of the pipeline).
 *
 * Combines the numeric signal extraction with the weighted opportunity model
 * and produces the final `Score` + `Signals` objects for a property.
 */

import type { Property, Score, Signals } from "../shared/types.ts";
import { extractSignals } from "./signals.ts";
import { buildExplanations, computeScore } from "./score.ts";

export { WEIGHTS } from "./score.ts";
export { LONG_MARKET_DAYS } from "./signals.ts";

export interface ScoringResult {
  score: Score;
  signals: Signals;
}

/**
 * Score a property using its current pricing, history and enrichment. The
 * property must already have `pricing`, `timeline`, `price_history`, `dvf`
 * and `transport_score` populated.
 */
export function scoreProperty(property: Property): ScoringResult {
  const raw = extractSignals(
    property.price_history,
    property.pricing.initial_price,
    property.pricing.current_price,
    property.timeline.days_on_market,
  );

  const out = computeScore({
    price_per_m2: property.pricing.price_per_m2,
    surface_m2: property.characteristics.surface_m2,
    district: property.address.district,
    daysOnMarket: property.timeline.days_on_market,
    dvf: property.dvf,
    transport_score: property.transport_score,
    walk_score: property.neighborhood?.walk_score ?? 50,
    signals: raw,
  });

  const signals: Signals = {
    price_drops: raw.price_drops,
    total_drop_percent: raw.total_drop_percent,
    long_time_on_market: raw.long_time_on_market,
    explanations: buildExplanations(out, raw, property.timeline.days_on_market, property.neighborhood),
  };

  return { score: out.score, signals };
}
