/**
 * Market model: per-arrondissement aggregates (Step 7 output → market.json).
 *
 * For each arrondissement with active listings we compute the average and
 * median €/m², the DVF reference, a 1-year trend and a volatility proxy
 * (coefficient of variation of listing €/m²). The trend blends the structural
 * arrondissement reference with the price-drop pressure observed in current
 * listings, so it reacts to the live data while staying deterministic.
 */

import {
  clamp,
  coefficientOfVariation,
  mean,
  median,
  round,
} from "../shared/geo.ts";
import { ARRONDISSEMENTS, CITY_AVG_PRICE_M2 } from "../shared/paris.ts";
import { getInseeProfile } from "../enrichment/insee.ts";
import type {
  MarketArrondissement,
  MarketFile,
  Property,
} from "../shared/types.ts";

export function buildMarket(
  properties: Property[],
  generatedAt: string,
  cityMedianTrend: number,
): MarketFile {
  const active = properties.filter((p) => p.status === "active");
  const byDistrict = new Map<string, Property[]>();
  for (const p of active) {
    const list = byDistrict.get(p.address.district) ?? [];
    list.push(p);
    byDistrict.set(p.address.district, list);
  }

  const arrondissements: MarketArrondissement[] = [];
  for (const arr of ARRONDISSEMENTS) {
    const list = byDistrict.get(arr.district) ?? [];
    if (list.length === 0) continue;

    const ppm2 = list.map((p) => p.pricing.price_per_m2);
    const dvfRefs = list
      .map((p) => p.dvf.avg_price_m2_500m)
      .filter((v) => v > 0);
    const drops = list.map((p) => Math.max(0, p.signals.total_drop_percent));

    // Softer market (more drops) drags the structural trend further negative.
    const dropPressure = clamp(mean(drops) * 0.15, 0, 2.5);
    const trend = round(arr.baseTrend1y - dropPressure, 1);

    arrondissements.push({
      district: arr.district,
      name: arr.name,
      lat: arr.lat,
      lng: arr.lng,
      listing_count: list.length,
      density: getInseeProfile(arr.district).density,
      avg_price_m2: round(mean(ppm2)),
      median_price_m2: round(median(ppm2)),
      dvf_avg_price_m2: round(dvfRefs.length ? mean(dvfRefs) : arr.refPriceM2),
      trend_1y_percent: trend,
      volatility: round(coefficientOfVariation(ppm2), 3),
      avg_opportunity_score: round(
        mean(list.map((p) => p.score.opportunity_score)),
      ),
      median_income: getInseeProfile(arr.district).income,
      avg_walk_score: round(
        mean(list.map((p) => p.neighborhood?.walk_score ?? 0)),
      ),
      median_yield: round(median(list.map((p) => p.investment?.gross_yield ?? 0)), 2),
      safety_index: getInseeProfile(arr.district).safety,
    });
  }

  arrondissements.sort((a, b) => a.district.localeCompare(b.district));

  return {
    generated_at: generatedAt,
    city_avg_price_m2: CITY_AVG_PRICE_M2,
    city_median_trend: cityMedianTrend,
    arrondissements,
  };
}
