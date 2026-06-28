/**
 * Numeric signal extraction from a property's history.
 *
 * These are the raw, factual observations (counts and percentages). The
 * human-readable explanations are built in `score.ts`, where the DVF gap and
 * sub-scores are also available.
 */

import { round } from "../shared/geo.ts";
import type { PriceHistoryPoint } from "../shared/types.ts";

export const LONG_MARKET_DAYS = 120;

export interface RawSignals {
  price_drops: number;
  total_drop_percent: number;
  long_time_on_market: boolean;
}

/** Count distinct downward steps in the (chronological) price history. */
export function countPriceDrops(history: PriceHistoryPoint[]): number {
  let drops = 0;
  for (let i = 1; i < history.length; i++) {
    if (history[i]!.price < history[i - 1]!.price) drops++;
  }
  return drops;
}

export function extractSignals(
  history: PriceHistoryPoint[],
  initialPrice: number,
  currentPrice: number,
  daysOnMarket: number,
): RawSignals {
  const totalDrop = initialPrice > 0
    ? ((initialPrice - currentPrice) / initialPrice) * 100
    : 0;

  return {
    price_drops: countPriceDrops(history),
    total_drop_percent: round(totalDrop, 1),
    long_time_on_market: daysOnMarket >= LONG_MARKET_DAYS,
  };
}
