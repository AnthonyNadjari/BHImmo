/**
 * Price-change analytics from real DVF sales.
 *
 *  - Quarterly median €/m² (Paris, arrondissement, quartier, 500 m around a
 *    property): how prices actually moved, quarter by quarter.
 *  - A Paris quarterly index used to time-adjust comparables (a sale 9 months
 *    earlier is restated at the subject's quarter) — Paris-wide because it has
 *    ~7 000 sales a quarter, so it is stable.
 *  - Repeat sales: the same lot (parcel + lot number, same surface) sold twice.
 *    Their price change controls for location and size (not for renovation
 *    work done between the two sales, which pushes it up), so the median
 *    annualised change is a same-apartment view of the trend.
 */

import { median, round } from "../shared/geo.ts";
import type { QuarterPoint, RepeatSaleStats } from "../shared/types.ts";
import type { DvfData } from "./dvf-source.ts";
import type { DvfTxn } from "./types.ts";

const YEAR_MS = 365.25 * 86_400_000;

/** "2025-11-21" → "2025-Q4". */
export const quarterOf = (date: string): string => `${date.slice(0, 4)}-Q${Math.floor((Number(date.slice(5, 7)) - 1) / 3) + 1}`;

/** Quarterly medians of `sales`, ascending; quarters with < `min` sales omitted. */
export function quarterlySeries(sales: Iterable<Pick<DvfTxn, "date" | "ppm2">>, min = 1): QuarterPoint[] {
  const byQ = new Map<string, number[]>();
  for (const s of sales) {
    const q = quarterOf(s.date);
    (byQ.get(q) ?? byQ.set(q, []).get(q)!).push(s.ppm2);
  }
  return [...byQ]
    .filter(([, v]) => v.length >= min)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([q, v]) => ({ q, median: round(median(v)), n: v.length }));
}

export interface PriceIndex {
  paris: QuarterPoint[];
  byDistrict: Map<string, QuarterPoint[]>;
  /** Paris median €/m² by quarter (for time adjustment). */
  parisByQuarter: Map<string, number>;
}

export function buildPriceIndex(dvf: DvfData): PriceIndex {
  const groups = new Map<string, DvfTxn[]>();
  for (const s of dvf.sales) (groups.get(s.district) ?? groups.set(s.district, []).get(s.district)!).push(s);
  const paris = quarterlySeries(dvf.sales);
  return {
    paris,
    byDistrict: new Map([...groups].map(([d, list]) => [d, quarterlySeries(list)])),
    parisByQuarter: new Map(paris.map((p) => [p.q, p.median])),
  };
}

/** Factor restating a €/m² from quarter `from` to quarter `to` (Paris index). */
export function timeFactor(index: PriceIndex, from: string, to: string): number {
  const a = index.parisByQuarter.get(from);
  const b = index.parisByQuarter.get(to);
  return a && b ? b / a : 1;
}

/** Market change between two dates per the Paris index, %. */
export function marketChangePct(index: PriceIndex, fromDate: string, toDate: string): number | null {
  const a = index.parisByQuarter.get(quarterOf(fromDate));
  const b = index.parisByQuarter.get(quarterOf(toDate));
  return a && b ? round(((b - a) / a) * 100, 1) : null;
}

export interface RepeatPair {
  district: string;
  first: DvfTxn;
  second: DvfTxn;
  /** Annualised price change, %. */
  annualPct: number;
}

/**
 * Consecutive sales of the same lot with a consistent surface, held at least
 * a year (shorter holds are dominated by renovation flips and deed quirks).
 */
export function repeatPairs(dvf: DvfData): RepeatPair[] {
  const out: RepeatPair[] = [];
  for (const [, sales] of dvf.byLot) {
    for (let i = 1; i < sales.length; i++) {
      const first = sales[i - 1]!;
      const second = sales[i]!;
      if (Math.abs(first.surface - second.surface) > Math.max(2, 0.05 * first.surface)) continue;
      if (first.date === second.date) continue;
      const years = (Date.parse(second.date) - Date.parse(first.date)) / YEAR_MS;
      if (years < 1) continue;
      out.push({
        district: second.district,
        first,
        second,
        annualPct: (Math.pow(second.price / first.price, 1 / years) - 1) * 100,
      });
    }
  }
  return out;
}

export function repeatStats(pairs: RepeatPair[]): RepeatSaleStats | null {
  if (pairs.length < 10) return null;
  const annual = pairs.map((p) => p.annualPct);
  return {
    pairs: pairs.length,
    median_annual_pct: round(median(annual), 1),
    share_gain_pct: round((annual.filter((a) => a > 0).length / annual.length) * 100),
  };
}
