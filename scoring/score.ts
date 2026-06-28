/**
 * Opportunity scoring engine.
 *
 * Implements exactly the weighted model from the spec:
 *
 *   opportunity_score =
 *       dvf_gap_score        * 0.40
 *     + price_drop_score     * 0.25
 *     + time_on_market_score * 0.15
 *     + transport_score      * 0.10
 *     + market_liquidity_score * 0.10
 *
 * Every component is normalized to 0–100, the weights sum to 1, so the result
 * is already on a 0–100 scale. Each component is a pure, explainable function
 * of observable inputs — no black boxes.
 */

import { clamp, round } from "../shared/geo.ts";
import { ARRONDISSEMENT_BY_CODE } from "../shared/paris.ts";
import type { DvfStats, Score } from "../shared/types.ts";
import { LONG_MARKET_DAYS, type RawSignals } from "./signals.ts";

export const WEIGHTS = {
  dvfGap: 0.4,
  priceDrop: 0.25,
  timeOnMarket: 0.15,
  transport: 0.1,
  liquidity: 0.1,
} as const;

export interface ScoreInput {
  price_per_m2: number;
  surface_m2: number;
  district: string;
  daysOnMarket: number;
  dvf: DvfStats;
  transport_score: number;
  /** Walkability score 0–100 (feeds the liquidity sub-score). */
  walk_score: number;
  signals: RawSignals;
}

export interface ScoreOutput {
  score: Score;
  /** Blended DVF reference €/m² used for the gap (for explanations). */
  dvfReference: number;
  /** Signed gap vs DVF in % (positive = below market). */
  dvfGapPercent: number;
  components: {
    dvfGapScore: number;
    priceDropScore: number;
    timeOnMarketScore: number;
    transportScore: number;
    liquidityScore: number;
  };
}

/** Blend the 100 m and 500 m DVF averages, favouring the tighter radius. */
function dvfReference(dvf: DvfStats): number {
  const a = dvf.avg_price_m2_100m;
  const b = dvf.avg_price_m2_500m;
  if (a > 0 && b > 0) return 0.6 * a + 0.4 * b;
  return a > 0 ? a : b;
}

/** How far below the local DVF average the listing is, mapped to 0–100. */
function dvfGapScore(ppm2: number, ref: number): { score: number; gapPct: number } {
  if (ref <= 0) return { score: 50, gapPct: 0 };
  const gap = (ref - ppm2) / ref; // +0.1 means 10% below market
  const score = clamp(50 + gap * 250, 0, 100);
  return { score: round(score), gapPct: round(gap * 100, 1) };
}

/** Cheapness vs the arrondissement-wide reference price (displayed sub-score). */
function priceScore(ppm2: number, district: string): number {
  const ref = ARRONDISSEMENT_BY_CODE.get(district)?.refPriceM2 ?? 10500;
  if (ref <= 0) return 50;
  const gap = (ref - ppm2) / ref;
  return round(clamp(50 + gap * 220, 0, 100));
}

/** Drop intensity: bigger and more frequent drops signal a motivated seller. */
function priceDropScore(signals: RawSignals): number {
  const fromDepth = signals.total_drop_percent * 5; // 20% drop → 100
  const fromCount = signals.price_drops * 6;
  return round(clamp(fromDepth + fromCount, 0, 100));
}

/** Longer on market → more negotiation leverage. */
function timeOnMarketScore(days: number): number {
  return round(clamp((days / 200) * 100, 0, 100));
}

/** Resale liquidity: transport + walkability + compact surface + demand. */
function liquidityScore(
  transport: number,
  walk: number,
  surface: number,
  district: string,
): number {
  const surfaceLiquidity =
    surface <= 35 ? 100 : surface <= 70 ? 80 : surface <= 110 ? 55 : 35;
  const ref = ARRONDISSEMENT_BY_CODE.get(district)?.refPriceM2 ?? 10500;
  const demand = ref > 0 ? clamp(((ref - 8000) / (15500 - 8000)) * 100, 0, 100) : 50;
  return round(
    clamp(
      0.3 * transport + 0.18 * walk + 0.27 * surfaceLiquidity + 0.25 * demand,
      0,
      100,
    ),
  );
}

export function computeScore(input: ScoreInput): ScoreOutput {
  const ref = dvfReference(input.dvf);
  const { score: gapScore, gapPct } = dvfGapScore(input.price_per_m2, ref);
  const dropScore = priceDropScore(input.signals);
  const timeScore = timeOnMarketScore(input.daysOnMarket);
  const transport = clamp(input.transport_score, 0, 100);
  const walk = clamp(input.walk_score, 0, 100);
  const liquidity = liquidityScore(transport, walk, input.surface_m2, input.district);

  const opportunity =
    gapScore * WEIGHTS.dvfGap +
    dropScore * WEIGHTS.priceDrop +
    timeScore * WEIGHTS.timeOnMarket +
    transport * WEIGHTS.transport +
    liquidity * WEIGHTS.liquidity;

  const score: Score = {
    opportunity_score: round(clamp(opportunity, 0, 100)),
    price_score: priceScore(input.price_per_m2, input.district),
    market_gap_score: gapScore,
    liquidity_score: liquidity,
  };

  return {
    score,
    dvfReference: round(ref),
    dvfGapPercent: gapPct,
    components: {
      dvfGapScore: gapScore,
      priceDropScore: dropScore,
      timeOnMarketScore: timeScore,
      transportScore: round(transport),
      liquidityScore: liquidity,
    },
  };
}

export interface NeighborhoodContext {
  walk_score: number;
  schools_500m: number;
  income: number;
}

/** Build the explainable bullet list shown in the UI. */
export function buildExplanations(
  out: ScoreOutput,
  signals: RawSignals,
  daysOnMarket: number,
  hood?: NeighborhoodContext,
): string[] {
  const lines: string[] = [];

  if (out.dvfGapPercent >= 1) {
    lines.push(`${out.dvfGapPercent}% below DVF average (${out.dvfReference.toLocaleString("fr-FR")} €/m²)`);
  } else if (out.dvfGapPercent <= -1) {
    lines.push(`${Math.abs(out.dvfGapPercent)}% above DVF average (${out.dvfReference.toLocaleString("fr-FR")} €/m²)`);
  } else {
    lines.push("In line with DVF average");
  }

  if (signals.price_drops > 0) {
    lines.push(
      `${signals.price_drops} price drop${signals.price_drops > 1 ? "s" : ""} detected (−${Math.max(0, signals.total_drop_percent)}% total)`,
    );
  }

  if (signals.long_time_on_market) {
    lines.push(`${daysOnMarket}+ days on market`);
  } else {
    lines.push(`${daysOnMarket} days on market`);
  }

  if (out.components.transportScore >= 75) {
    lines.push("Excellent public-transport access");
  } else if (out.components.transportScore <= 40) {
    lines.push("Limited public-transport access");
  }

  if (out.components.liquidityScore >= 75) {
    lines.push("High resale liquidity");
  }

  if (hood) {
    if (hood.walk_score >= 75) {
      lines.push("Highly walkable area (shops, services nearby)");
    }
    if (hood.schools_500m >= 6) {
      lines.push(`${hood.schools_500m} schools within 500 m`);
    }
    if (hood.income >= 40000) {
      lines.push(`Affluent area (median income ${Math.round(hood.income / 1000)}k€/yr)`);
    }
  }

  return lines;
}

export { LONG_MARKET_DAYS };
