/**
 * DVF market context for a property: real comparable apartment sales within
 * 100 m / 500 m and ±12 months of its own sale date (the sale itself
 * excluded). Too few comparables → the average is null, never estimated.
 */

import { mean, round } from "../shared/geo.ts";
import { comparables, type DvfData, type DvfTxn } from "../scraper/index.ts";
import type { DvfStats } from "../shared/types.ts";

const WINDOW_DAYS = 365;
const MIN_100M = 3;
const MIN_500M = 5;

function shiftDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * 86_400_000).toISOString().slice(0, 10);
}

export function enrichDvf(dvf: DvfData, txn: DvfTxn): DvfStats {
  const to = shiftDays(txn.date, WINDOW_DAYS);
  const within500 = comparables(dvf, txn, 500, WINDOW_DAYS);
  const within100 = within500.filter((c) => c.distance_m <= 100);
  const avg = (list: typeof within500, min: number) =>
    list.length >= min ? round(mean(list.map((c) => c.txn.ppm2))) : null;

  return {
    avg_price_m2_100m: avg(within100, MIN_100M),
    avg_price_m2_500m: avg(within500, MIN_500M),
    count_100m: within100.length,
    count_500m: within500.length,
    window_from: shiftDays(txn.date, -WINDOW_DAYS),
    // Never claim coverage beyond the latest DVF sale.
    window_to: to < dvf.coverage.last_sale ? to : dvf.coverage.last_sale,
    comparable_sales: within500.slice(0, 8).map(({ txn: t, distance_m }) => ({
      price: t.price,
      date: t.date,
      distance_m,
      surface_m2: t.surface,
      price_per_m2: t.ppm2,
    })),
  };
}

/** Local DVF reference €/m²: 60 % within 100 m + 40 % within 500 m. */
export function dvfReference(dvf: Pick<DvfStats, "avg_price_m2_100m" | "avg_price_m2_500m">): number | null {
  const a = dvf.avg_price_m2_100m;
  const b = dvf.avg_price_m2_500m;
  if (a && b) return 0.6 * a + 0.4 * b;
  return a ?? b ?? null;
}
