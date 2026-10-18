/**
 * DVF valuation context for a property — what similar real sales imply.
 *
 * Paris €/m² depends on size (studios and large flats trade higher than
 * mid-size ones), so the valuation reference is the MEDIAN €/m² of
 * similar-size apartment sales (0.6×–1.6× the surface) sold within ±12 months,
 * each restated at this sale's quarter with the Paris quarterly index. The
 * search starts at 300 m and widens to 500 m / 800 m until 8 such sales are
 * found; failing that, all sizes within 500 m are used (and reported). Too few
 * sales → null, never an estimate.
 *
 * Also exposes the plain medians within 100 m / 500 m and the quarterly price
 * series within 500 m (how prices around this address moved since 2021).
 */

import { median, round } from "../shared/geo.ts";
import type { DvfData, DvfTxn } from "../scraper/index.ts";
import { quarterlySeries, quarterOf, timeFactor, type PriceIndex } from "../scraper/price-index.ts";
import type { ComparableSale, DvfStats } from "../shared/types.ts";

const WINDOW_DAYS = 365;
const DAY_MS = 86_400_000;
const MIN_REFERENCE = 8;
const SIZE_MIN = 0.6;
const SIZE_MAX = 1.6;
/** [radius m, similar size only] tried in order. */
const STEPS: Array<[number, boolean]> = [
  [300, true],
  [500, true],
  [800, true],
  [500, false],
];

function shiftDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * DAY_MS).toISOString().slice(0, 10);
}

export function enrichDvf(dvf: DvfData, txn: DvfTxn, index: PriceIndex): DvfStats {
  const t = Date.parse(txn.date);
  const subjectQ = quarterOf(txn.date);
  const lo = SIZE_MIN * txn.surface;
  const hi = SIZE_MAX * txn.surface;

  const all = dvf.index.within(txn.lat, txn.lng, 800);
  const inWindow = all
    .filter(({ p }) => p.id !== txn.id && Math.abs(Date.parse(p.date) - t) <= WINDOW_DAYS * DAY_MS)
    .map(({ p, d }) => ({
      txn: p,
      distance_m: round(d),
      adjusted: p.ppm2 * timeFactor(index, quarterOf(p.date), subjectQ),
      similar: p.surface >= lo && p.surface <= hi,
    }));

  let reference_m2: number | null = null;
  let reference_basis: DvfStats["reference_basis"] = null;
  for (const [radius, similarOnly] of STEPS) {
    const pool = inWindow.filter((c) => c.distance_m <= radius && (!similarOnly || c.similar));
    if (pool.length >= MIN_REFERENCE) {
      reference_m2 = round(median(pool.map((c) => c.adjusted)));
      reference_basis = {
        radius_m: radius,
        comps: pool.length,
        size_min: similarOnly ? round(lo) : null,
        size_max: similarOnly ? round(hi) : null,
      };
      break;
    }
  }

  const within500 = inWindow.filter((c) => c.distance_m <= 500);
  const within100 = within500.filter((c) => c.distance_m <= 100);
  const med = (list: typeof inWindow, min: number) => (list.length >= min ? round(median(list.map((c) => c.txn.ppm2))) : null);

  // Similar-size sales first (the ones the reference relies on), nearest first.
  const shown = [...within500].sort((a, b) => Number(b.similar) - Number(a.similar) || a.distance_m - b.distance_m).slice(0, 10);
  const comparable_sales: ComparableSale[] = shown.map((c) => ({
    price: c.txn.price,
    date: c.txn.date,
    distance_m: c.distance_m,
    surface_m2: c.txn.surface,
    price_per_m2: c.txn.ppm2,
    adjusted_m2: round(c.adjusted),
    similar: c.similar,
  }));

  const to = shiftDays(txn.date, WINDOW_DAYS);
  return {
    reference_m2,
    reference_basis,
    estimate: reference_m2 === null ? null : round(reference_m2 * txn.surface, -3),
    median_m2_100m: med(within100, 3),
    median_m2_500m: med(within500, 5),
    count_100m: within100.length,
    count_500m: within500.length,
    window_from: shiftDays(txn.date, -WINDOW_DAYS),
    // Never claim coverage beyond the latest DVF sale.
    window_to: to < dvf.coverage.last_sale ? to : dvf.coverage.last_sale,
    comparable_sales,
    local_index: quarterlySeries(
      all.filter(({ d }) => d <= 500).map(({ p }) => p),
      3,
    ),
  };
}
