/**
 * Deal-scoring engine — every input is real data or a documented assumption.
 *
 *   deal_score = weighted mean of the AVAILABLE components
 *                  0.35·value + 0.35·yield + 0.18·liquidity + 0.12·gentrification
 *   deal_score *= (0.5 + 0.5·dpe_health/100)       // when a DPE is known
 *   (value-add reno-arbitrage on F/G bought well below market escapes the cap)
 *
 *  - value: discount vs. the valuation reference (median €/m² of similar-size
 *    DVF sales nearby, time-adjusted) + €/m² percentile among all the
 *    arrondissement's DVF sales of the year.
 *  - yield: legal rent ceiling (encadrement des loyers) vs. sale price; costs
 *    are explicit assumptions (7.5 % notary fees, charges at 1.2 % of price).
 *  - liquidity: IDFM transport, walkability, size, arrondissement price level
 *    and local DVF sale volume.
 *  - gentrification: DVF year-over-year trend vs. the city + INSEE income vs.
 *    price rank of the arrondissement.
 *
 * A component without data is left out and the weights renormalise — nothing
 * is imputed. There is no "days on market" or "price drop" input: DVF records
 * completed sales, not listings.
 */

import { clamp, round } from "../shared/geo.ts";
import type { DvfStats, Investment, Score } from "../shared/types.ts";

export const WEIGHTS = {
  value: 0.35,
  yield: 0.35,
  liquidity: 0.18,
  gentrification: 0.12,
} as const;

/** Explicit yield assumptions (documented in the UI). */
export const ACQUISITION_FEES = 0.075;
export const ANNUAL_CHARGES = 0.012;

const RENO_COST: Record<string, number> = { A: 0, B: 0, C: 0, D: 1000, E: 8000, F: 25000, G: 40000 };
const DPE_HEALTH: Record<string, number> = { A: 100, B: 95, C: 88, D: 75, E: 55, F: 30, G: 10 };

export interface ScoreInput {
  price: number;
  price_per_m2: number;
  surface_m2: number;
  dvf: DvfStats;
  transport_score: number | null;
  walk_score: number | null;
  /** Legal rent ceiling €/m²/month, null without rent-control data. */
  rent_max_m2: number | null;
  /** Surface the rent applies to (Carrez when declared). */
  rent_surface_m2: number;
  energy_class: string | null;
  /** Sorted €/m² of the arrondissement's DVF sales (latest vintage). */
  districtPpm2: number[];
  /** Arrondissement price-level rank 0–100 (demand proxy), null if unknown. */
  demand: number | null;
  /** Local sale-volume rank 0–100 among the dataset, null if unknown. */
  volume: number | null;
  gentrification: number | null;
}

export interface ScoreOutput {
  score: Score;
  investment: Investment;
  dvfReference: number | null;
}

function percentile(sortedAsc: number[], value: number): number {
  if (sortedAsc.length === 0) return 50;
  let lo = 0;
  let hi = sortedAsc.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sortedAsc[mid]! < value) lo = mid + 1;
    else hi = mid;
  }
  return (lo / sortedAsc.length) * 100;
}

/** Weighted mean over the non-null entries. */
function weighted(parts: Array<[number | null, number]>): number | null {
  let s = 0;
  let w = 0;
  for (const [v, weight] of parts) {
    if (v === null) continue;
    s += v * weight;
    w += weight;
  }
  return w > 0 ? s / w : null;
}

export function computeScore(input: ScoreInput): ScoreOutput {
  // Value.
  const ref = input.dvf.reference_m2;
  const dvfGapPct = ref ? ((ref - input.price_per_m2) / ref) * 100 : null;
  const ppm2Pct = round(percentile(input.districtPpm2, input.price_per_m2));
  const percentileScore = 100 - ppm2Pct;
  const valueScore = round(
    dvfGapPct === null ? percentileScore : Math.max(clamp(50 + (dvfGapPct / 100) * 250, 0, 100), percentileScore),
  );

  // Yield at the legal rent ceiling.
  let grossYield: number | null = null;
  let netYield: number | null = null;
  let yieldScore: number | null = null;
  if (input.rent_max_m2 && input.price > 0) {
    const annualRent = input.rent_max_m2 * input.rent_surface_m2 * 12;
    grossYield = (annualRent / input.price) * 100;
    netYield = ((annualRent - input.price * ANNUAL_CHARGES) / (input.price * (1 + ACQUISITION_FEES))) * 100;
    const grossScore = clamp(((grossYield - 2.5) / (4.5 - 2.5)) * 100, 0, 100);
    const netScore = clamp(((netYield - 1.5) / (3.5 - 1.5)) * 100, 0, 100);
    yieldScore = round(0.7 * netScore + 0.3 * grossScore);
  }

  // Liquidity.
  const surfaceLiquidity =
    input.surface_m2 <= 35 ? 100 : input.surface_m2 <= 70 ? 80 : input.surface_m2 <= 110 ? 55 : 35;
  const liquidity = weighted([
    [input.transport_score, 0.25],
    [input.walk_score, 0.15],
    [surfaceLiquidity, 0.22],
    [input.demand, 0.22],
    [input.volume, 0.16],
  ]);
  const liquidityScore = liquidity === null ? null : round(clamp(liquidity, 0, 100));
  const gentrificationScore = input.gentrification === null ? null : round(clamp(input.gentrification, 0, 100));

  // DPE.
  const cls = input.energy_class?.toUpperCase() ?? null;
  const dpeHealth = cls ? DPE_HEALTH[cls] ?? null : null;
  const renoCost = cls ? RENO_COST[cls] ?? 0 : 0;
  const valueAdd =
    (cls === "F" || cls === "G") &&
    dvfGapPct !== null &&
    dvfGapPct > 15 + ((renoCost / input.surface_m2) / input.price_per_m2) * 100;

  const base =
    weighted([
      [valueScore, WEIGHTS.value],
      [yieldScore, WEIGHTS.yield],
      [liquidityScore, WEIGHTS.liquidity],
      [gentrificationScore, WEIGHTS.gentrification],
    ]) ?? 0;
  const deal = dpeHealth === null || valueAdd ? base : base * (0.5 + 0.5 * (dpeHealth / 100));

  return {
    score: {
      opportunity_score: round(clamp(deal, 0, 100)),
      value_score: valueScore,
      yield_score: yieldScore,
      liquidity_score: liquidityScore,
      gentrification_score: gentrificationScore,
    },
    investment: {
      gross_yield: grossYield === null ? null : round(grossYield, 2),
      net_yield: netYield === null ? null : round(netYield, 2),
      ppm2_percentile: ppm2Pct,
      dvf_gap_pct: dvfGapPct === null ? null : round(dvfGapPct, 1),
      estimate_gap_eur: input.dvf.estimate === null ? null : round(input.dvf.estimate - input.price, -3),
      dpe_risk_score: dpeHealth,
      value_add_flag: valueAdd,
    },
    dvfReference: ref === null ? null : round(ref),
  };
}

/* ------------------------ gentrification --------------------------- */

function pctRank(values: number[], v: number): number {
  let below = 0;
  for (const x of values) if (x < v) below++;
  return (below / Math.max(1, values.length - 1)) * 100;
}

/**
 * Gentrification per arrondissement: DVF price momentum vs. the city median
 * trend, plus the "affluent-but-cheap" gap (INSEE income rank − DVF price
 * rank). Null for an arrondissement with neither signal.
 */
export function gentrificationByDistrict(
  districts: Array<{ district: string; trend: number | null; medianPpm2: number; income: number | null }>,
  cityTrend: number | null,
): Map<string, number | null> {
  const incomes = districts.map((d) => d.income).filter((v): v is number => v !== null);
  const prices = districts.map((d) => d.medianPpm2);
  const out = new Map<string, number | null>();
  for (const d of districts) {
    const momentum = d.trend !== null && cityTrend !== null ? d.trend - cityTrend : null;
    const gap = d.income !== null && incomes.length > 1 ? pctRank(incomes, d.income) - pctRank(prices, d.medianPpm2) : null;
    out.set(
      d.district,
      momentum === null && gap === null ? null : round(clamp(50 + (momentum ?? 0) * 6 + (gap ?? 0) * 0.4, 0, 100)),
    );
  }
  return out;
}
