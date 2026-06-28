/**
 * Deal-scoring engine (professional model).
 *
 *   deal_score = 0.30·value + 0.30·yield + 0.15·negotiation
 *              + 0.15·liquidity + 0.10·gentrification
 *   deal_score *= (0.5 + 0.5·dpe_risk/100)        // DPE as a multiplier, not additive
 *   (value-add reno-arbitrage on F/G priced well below market escapes the cap)
 *
 * Yield (net rental yield) is a first-class 30% axis — the number a Paris
 * investor actually decides on. Every component is a pure, explainable function
 * of stored fields.
 */

import { clamp, round } from "../shared/geo.ts";
import { ARRONDISSEMENT_BY_CODE, ARRONDISSEMENTS } from "../shared/paris.ts";
import { getInseeProfile } from "../enrichment/insee.ts";
import type { DvfStats, Investment, Score } from "../shared/types.ts";
import { LONG_MARKET_DAYS, type RawSignals } from "./signals.ts";

export const WEIGHTS = {
  value: 0.3,
  yield: 0.3,
  negotiation: 0.15,
  liquidity: 0.15,
  gentrification: 0.1,
} as const;

const RENO_COST: Record<string, number> = { A: 0, B: 0, C: 0, D: 1000, E: 8000, F: 25000, G: 40000 };
const DPE_RISK: Record<string, number> = { A: 100, B: 95, C: 88, D: 75, E: 55, F: 30, G: 10 };

export interface ScoreInput {
  current_price: number;
  price_per_m2: number;
  surface_m2: number;
  district: string;
  daysOnMarket: number;
  dvf: DvfStats;
  transport_score: number;
  walk_score: number;
  /** Achievable rent €/m²/month (rent.max_m2). */
  rent_max_m2: number;
  energy_class?: string;
  signals: RawSignals;
  /** Sorted €/m² of peer listings in the same arrondissement. */
  districtPpm2: number[];
  /** Gentrification score for the arrondissement (0–100). */
  gentrification: number;
}

export interface ScoreOutput {
  score: Score;
  investment: Investment;
  dvfReference: number;
  dvfGapPercent: number;
  grossYield: number;
  netYield: number;
}

/* --------------------------- components ---------------------------- */

function dvfReference(dvf: DvfStats): number {
  const a = dvf.avg_price_m2_100m;
  const b = dvf.avg_price_m2_500m;
  if (a > 0 && b > 0) return 0.6 * a + 0.4 * b;
  return a > 0 ? a : b;
}

function percentile(sortedAsc: number[], value: number): number {
  if (sortedAsc.length === 0) return 50;
  let below = 0;
  for (const v of sortedAsc) if (v < value) below++;
  return (below / sortedAsc.length) * 100;
}

export function computeScore(input: ScoreInput): ScoreOutput {
  const ref = dvfReference(input.dvf);
  const dvfGapPct = ref > 0 ? ((ref - input.price_per_m2) / ref) * 100 : 0;
  const dvfGapScore = clamp(50 + (dvfGapPct / 100) * 250, 0, 100);

  const ppm2Pct = round(percentile(input.districtPpm2, input.price_per_m2));
  const percentileScore = 100 - ppm2Pct;
  const valueScore = round(Math.max(dvfGapScore, percentileScore));

  // Yield.
  const annualRent = input.rent_max_m2 * input.surface_m2 * 12;
  const grossYield = input.current_price > 0 ? (annualRent / input.current_price) * 100 : 0;
  const grossYieldScore = clamp(((grossYield - 2.5) / (4.5 - 2.5)) * 100, 0, 100);
  const acquisitionCost = input.current_price * 1.075;
  const annualCharges = input.current_price * 0.012;
  const netYield = acquisitionCost > 0 ? ((annualRent - annualCharges) / acquisitionCost) * 100 : 0;
  const netYieldScore = clamp(((netYield - 1.5) / (3.5 - 1.5)) * 100, 0, 100);
  const yieldScore = round(0.7 * netYieldScore + 0.3 * grossYieldScore);

  // Negotiation (collapses price-drop + time-on-market).
  const expectedExtra = clamp((input.daysOnMarket / 90) * 4, 0, 8);
  const negotiationMargin = round(input.signals.total_drop_percent + expectedExtra, 1);
  const negotiationScore = round(
    clamp(input.signals.total_drop_percent * 5 + input.signals.price_drops * 6 + (input.daysOnMarket / 200) * 40, 0, 100),
  );

  // Liquidity.
  const surfaceLiquidity =
    input.surface_m2 <= 35 ? 100 : input.surface_m2 <= 70 ? 80 : input.surface_m2 <= 110 ? 55 : 35;
  const arrRef = ARRONDISSEMENT_BY_CODE.get(input.district)?.refPriceM2 ?? 10500;
  const demand = clamp(((arrRef - 8000) / (15500 - 8000)) * 100, 0, 100);
  const domLiquidity = clamp(100 - (input.daysOnMarket / 180) * 100, 0, 100);
  const transport = clamp(input.transport_score, 0, 100);
  const walk = clamp(input.walk_score, 0, 100);
  const liquidityScore = round(
    clamp(0.25 * transport + 0.15 * walk + 0.22 * surfaceLiquidity + 0.22 * demand + 0.16 * domLiquidity, 0, 100),
  );

  const gentrificationScore = round(clamp(input.gentrification, 0, 100));

  // DPE.
  const cls = (input.energy_class ?? "D").toUpperCase();
  const dpeRisk = DPE_RISK[cls] ?? 60;
  const renoCost = RENO_COST[cls] ?? 0;
  const valueAdd =
    (cls === "F" || cls === "G") &&
    dvfGapPct > 15 + (input.price_per_m2 > 0 ? (renoCost / input.surface_m2) / input.price_per_m2 * 100 : 0);

  // Composite.
  const base =
    WEIGHTS.value * valueScore +
    WEIGHTS.yield * yieldScore +
    WEIGHTS.negotiation * negotiationScore +
    WEIGHTS.liquidity * liquidityScore +
    WEIGHTS.gentrification * gentrificationScore;
  const dpeMultiplier = 0.5 + 0.5 * (dpeRisk / 100);
  let deal = base * dpeMultiplier;
  if (valueAdd) deal = base; // escape hatch for reno-arbitrage
  const dealScore = round(clamp(deal, 0, 100));

  const score: Score = {
    opportunity_score: dealScore,
    value_score: valueScore,
    yield_score: yieldScore,
    negotiation_score: negotiationScore,
    liquidity_score: liquidityScore,
    gentrification_score: gentrificationScore,
  };

  const investment: Investment = {
    gross_yield: round(grossYield, 2),
    net_yield: round(netYield, 2),
    ppm2_percentile: ppm2Pct,
    negotiation_margin_pct: negotiationMargin,
    dpe_risk_score: dpeRisk,
    value_add_flag: valueAdd,
  };

  return {
    score,
    investment,
    dvfReference: round(ref),
    dvfGapPercent: round(dvfGapPct, 1),
    grossYield: round(grossYield, 2),
    netYield: round(netYield, 2),
  };
}

/* ------------------------ gentrification --------------------------- */

function pctRank(values: number[], v: number): number {
  let below = 0;
  for (const x of values) if (x < v) below++;
  return (below / values.length) * 100;
}

/**
 * Precompute a gentrification score per arrondissement from static structural
 * data (price momentum vs the city + "affluent-but-cheap" gap). Returns the
 * map plus the city-wide median trend baseline.
 */
export function gentrificationByDistrict(): { map: Map<string, number>; cityMedianTrend: number } {
  const trends = ARRONDISSEMENTS.map((a) => a.baseTrend1y).sort((x, y) => x - y);
  const cityMedianTrend = trends[Math.floor(trends.length / 2)]!;
  const incomes = ARRONDISSEMENTS.map((a) => getInseeProfile(a.district).income);
  const prices = ARRONDISSEMENTS.map((a) => a.refPriceM2);

  const map = new Map<string, number>();
  for (const a of ARRONDISSEMENTS) {
    const income = getInseeProfile(a.district).income;
    const priceMomentum = a.baseTrend1y - cityMedianTrend;
    const undervaluedGap = pctRank(incomes, income) - pctRank(prices, a.refPriceM2);
    map.set(a.district, round(clamp(50 + priceMomentum * 6 + undervaluedGap * 0.4, 0, 100)));
  }
  return { map, cityMedianTrend: round(cityMedianTrend, 1) };
}

/* ------------------------ explanations ----------------------------- */

export function buildExplanations(
  out: ScoreOutput,
  input: ScoreInput,
  signals: RawSignals,
  daysOnMarket: number,
): string[] {
  const lines: string[] = [];

  if (out.netYield > 0) {
    lines.push(`${out.netYield.toFixed(1)}% net rental yield (gross ${out.grossYield.toFixed(1)}%)`);
  }
  if (out.dvfGapPercent >= 1) {
    lines.push(`${out.dvfGapPercent}% below DVF average (${out.dvfReference.toLocaleString("fr-FR")} €/m²)`);
  } else if (out.dvfGapPercent <= -1) {
    lines.push(`${Math.abs(out.dvfGapPercent)}% above DVF average`);
  }
  if (out.investment.ppm2_percentile <= 35) {
    lines.push(`Cheaper than ${Math.round(100 - out.investment.ppm2_percentile)}% of the arrondissement`);
  }
  if (signals.price_drops > 0) {
    lines.push(`${signals.price_drops} price drop${signals.price_drops > 1 ? "s" : ""} (−${Math.max(0, signals.total_drop_percent)}%)`);
  }
  lines.push(signals.long_time_on_market ? `${daysOnMarket}+ days on market` : `${daysOnMarket} days on market`);
  if (out.investment.value_add_flag) {
    lines.push("Value-add: discount exceeds renovation cost (F/G arbitrage)");
  } else if (input.energy_class === "F" || input.energy_class === "G") {
    lines.push(`Energy class ${input.energy_class} — rental restrictions apply`);
  }
  return lines;
}

export { LONG_MARKET_DAYS };
