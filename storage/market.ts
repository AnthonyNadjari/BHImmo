/**
 * Market model: per-arrondissement aggregates (Step 7 output → market.json).
 *
 * Prices, YoY trend, volume and volatility come from ALL clean DVF apartment
 * sales of the arrondissement (latest vs previous vintage), not just from the
 * properties shown. Population and income come from INSEE, area and centroid
 * from the Ville de Paris, road-noise exposure from its open data.
 */

import { mean, median, round } from "../shared/geo.ts";
import { ARRONDISSEMENTS } from "../shared/paris.ts";
import { getInseeProfile } from "../enrichment/insee.ts";
import type { References } from "../enrichment/reference.ts";
import type { DistrictMarket } from "../scraper/index.ts";
import type { DvfCoverage, MarketArrondissement, MarketFile, Property, SourceStatus } from "../shared/types.ts";

export interface MarketContext {
  generatedAt: string;
  dvf: DvfCoverage;
  markets: Map<string, DistrictMarket>;
  cityMedian: number;
  cityTrend: number | null;
  latestYear: string;
  refs: References;
  sources: SourceStatus[];
}

const nonNull = (xs: Array<number | null>): number[] => xs.filter((x): x is number => x !== null);

export function buildMarket(properties: Property[], ctx: MarketContext): MarketFile {
  const byDistrict = new Map<string, Property[]>();
  for (const p of properties) {
    (byDistrict.get(p.address.district) ?? byDistrict.set(p.address.district, []).get(p.address.district)!).push(p);
  }

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
    });
  }

  return {
    generated_at: ctx.generatedAt,
    dvf: ctx.dvf,
    latest_year: ctx.latestYear,
    city_median_price_m2: ctx.cityMedian,
    city_trend_1y: ctx.cityTrend,
    sources: ctx.sources,
    arrondissements,
  };
}
