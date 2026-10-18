/**
 * Market model (Step 7 output → market.json + quartiers.geojson).
 *
 * Prices, trends, volume, volatility and the quarterly index come from ALL
 * clean DVF apartment sales, not just from the properties shown. Repeat sales
 * of the same lot give a quality-adjusted trend. Quartier statistics assign
 * every sale of the last two years to one of Paris's 80 quartiers
 * administratifs (official polygons). Population and income come from INSEE,
 * area and centroid from the Ville de Paris, road noise from its open data.
 */

import { mean, median, round } from "../shared/geo.ts";
import { ARRONDISSEMENTS } from "../shared/paris.ts";
import { getInseeProfile } from "../enrichment/insee.ts";
import { findQuartier, type References } from "../enrichment/reference.ts";
import { quarterOf, repeatStats, type DistrictMarket, type DvfData, type PriceIndex } from "../scraper/index.ts";
import type { RepeatPair } from "../scraper/price-index.ts";
import type {
  DvfCoverage,
  MarketArrondissement,
  MarketFile,
  MarketQuartier,
  Property,
  SourceStatus,
} from "../shared/types.ts";

export interface MarketContext {
  generatedAt: string;
  dvf: DvfCoverage;
  dvfData: DvfData;
  markets: Map<string, DistrictMarket>;
  cityMedian: number;
  cityTrend: number | null;
  latestYear: string;
  index: PriceIndex;
  repeats: RepeatPair[];
  refs: References;
  sources: SourceStatus[];
}

const nonNull = (xs: Array<number | null>): number[] => xs.filter((x): x is number => x !== null);

/** Median €/m² of the last 4 quarters vs the 4 before, per quartier. */
function quartierStats(ctx: MarketContext): MarketQuartier[] {
  const zones = ctx.refs.rent?.zones ?? [];
  if (zones.length === 0) return [];
  const quarters = ctx.index.paris.map((p) => p.q);
  const last4 = new Set(quarters.slice(-4));
  const prev4 = new Set(quarters.slice(-8, -4));
  const acc = new Map<string, { last: number[]; prev: number[]; lat: number; lng: number; n: number }>();
  for (const s of ctx.dvfData.sales) {
    const q = quarterOf(s.date);
    const bucket = last4.has(q) ? "last" : prev4.has(q) ? "prev" : null;
    if (!bucket) continue;
    const z = findQuartier(ctx.refs, s.lat, s.lng);
    if (!z) continue;
    const a = acc.get(z.id) ?? acc.set(z.id, { last: [], prev: [], lat: 0, lng: 0, n: 0 }).get(z.id)!;
    a[bucket].push(s.ppm2);
    a.lat += s.lat;
    a.lng += s.lng;
    a.n++;
  }
  return zones
    .map((z): MarketQuartier => {
      const a = acc.get(z.id);
      const m = a && a.last.length >= 10 ? median(a.last) : null;
      const p = a && a.prev.length >= 10 ? median(a.prev) : null;
      return {
        id: z.id,
        name: z.quartier,
        district: z.district,
        lat: a ? round(a.lat / a.n, 5) : round((z.bbox[1] + z.bbox[3]) / 2, 5),
        lng: a ? round(a.lng / a.n, 5) : round((z.bbox[0] + z.bbox[2]) / 2, 5),
        median_price_m2: m === null ? null : round(m),
        prev_median_price_m2: p === null ? null : round(p),
        trend_pct: m !== null && p ? round(((m - p) / p) * 100, 1) : null,
        sales_12m: a?.last.length ?? 0,
        rent_ref_m2: z.rents.get("2|Avant 1946")?.ref ?? null,
      };
    })
    .sort((a, b) => Number(a.id) - Number(b.id));
}

export function buildMarket(properties: Property[], ctx: MarketContext): MarketFile {
  const byDistrict = new Map<string, Property[]>();
  for (const p of properties) {
    (byDistrict.get(p.address.district) ?? byDistrict.set(p.address.district, []).get(p.address.district)!).push(p);
  }
  const repeatsByDistrict = new Map<string, RepeatPair[]>();
  for (const r of ctx.repeats) (repeatsByDistrict.get(r.district) ?? repeatsByDistrict.set(r.district, []).get(r.district)!).push(r);

  const centrePop = ARRONDISSEMENTS.slice(0, 4).reduce((s, a) => s + (getInseeProfile(a.district).population ?? NaN), 0);

  const arrondissements: MarketArrondissement[] = [];
  for (const arr of ARRONDISSEMENTS) {
    const list = byDistrict.get(arr.district) ?? [];
    const m = ctx.markets.get(arr.district);
    if (list.length === 0 || !m) continue;

    const insee = getInseeProfile(arr.district);
    const ref = ctx.refs.arrondissements?.get(arr.district);
    const exposed = ctx.refs.noise?.exposed.get(arr.district);
    const n = Number(arr.district.slice(-2));
    const noisePop = n <= 4 ? centrePop : insee.population ?? NaN;
    const walks = nonNull(list.map((p) => p.neighborhood.walk_score));
    const yields = nonNull(list.map((p) => p.investment.gross_yield));

    arrondissements.push({
      district: arr.district,
      name: arr.name,
      lat: ref?.lat ?? m.lat,
      lng: ref?.lng ?? m.lng,
      listing_count: list.length,
      sales_latest_year: m.salesLatest,
      population: insee.population,
      area_km2: ref ? round(ref.area_km2, 2) : null,
      density: ref && insee.population ? round(insee.population / ref.area_km2) : null,
      avg_price_m2: round(mean(list.map((p) => p.sale.price_per_m2))),
      median_price_m2: m.medianLatest,
      prev_median_price_m2: m.medianPrev,
      trend_1y_percent: m.trendPct,
      volatility: m.volatility,
      avg_opportunity_score: round(mean(list.map((p) => p.score.opportunity_score))),
      median_income: insee.income,
      poverty_rate: insee.povertyRate,
      avg_walk_score: walks.length ? round(mean(walks)) : null,
      median_yield: yields.length ? round(median(yields), 2) : null,
      noise_exposed_pct: exposed && Number.isFinite(noisePop) && noisePop > 0 ? round((exposed / noisePop) * 100, 1) : null,
      index: ctx.index.byDistrict.get(arr.district) ?? [],
      repeat_sales: repeatStats(repeatsByDistrict.get(arr.district) ?? []),
    });
  }

  return {
    generated_at: ctx.generatedAt,
    dvf: ctx.dvf,
    latest_year: ctx.latestYear,
    city_median_price_m2: ctx.cityMedian,
    city_trend_1y: ctx.cityTrend,
    paris_index: ctx.index.paris,
    paris_repeat_sales: repeatStats(ctx.repeats),
    sources: ctx.sources,
    arrondissements,
    quartiers: quartierStats(ctx),
  };
}

/** Official quartier polygons (coordinates rounded to ~1 m) for the price map. */
export function quartierGeoJson(refs: References): { type: "FeatureCollection"; features: unknown[] } | null {
  const zones = refs.rent?.zones ?? [];
  if (zones.length === 0) return null;
  const r5 = (c: unknown): unknown =>
    Array.isArray(c) && typeof c[0] === "number" ? (c as number[]).map((v) => round(v, 5)) : (c as unknown[]).map(r5);
  return {
    type: "FeatureCollection",
    features: [...zones]
      .sort((a, b) => Number(a.id) - Number(b.id))
      .map((z) => ({
        type: "Feature",
        properties: { id: z.id, name: z.quartier, district: z.district },
        geometry: { type: z.geometry.type, coordinates: r5(z.geometry.coordinates) },
      })),
  };
}
