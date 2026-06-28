/**
 * Rental reference enrichment — the basis for rental YIELD, the single most
 * important metric for an investor.
 *
 * Source: Paris "encadrement des loyers" (opendata.paris.fr), which publishes
 * the legal reference rent (€/m²/month) and the majoré ceiling (≈ ref × 1.2,
 * the realistically achievable rent) per quartier, room-count and era. We
 * point-match the property's quartier with an ODSQL `intersects(geo_shape,…)`
 * query; on failure we fall back to a static per-arrondissement reference.
 */

import { ENDPOINTS, fetchJson, type PipelineConfig } from "../shared/config.ts";
import { round } from "../shared/geo.ts";
import { getInseeProfile } from "./insee.ts";

export interface RentContext {
  lat: number;
  lng: number;
  district: string;
  rooms: number;
}

export interface RentResult {
  /** Reference rent €/m²/month. */
  ref_m2: number;
  /** Legal ceiling (majoré) €/m²/month — achievable market rent. */
  max_m2: number;
  /** Lower bound (minoré) €/m²/month. */
  min_m2: number;
  /** Quartier label. */
  quartier: string;
}

interface OdsRentResponse {
  results?: Array<{
    nom_quartier?: string;
    ref?: number;
    min?: number;
    max?: number;
  }>;
}

export async function enrichRent(
  ctx: RentContext,
  config: PipelineConfig,
): Promise<RentResult> {
  const piece = Math.min(Math.max(ctx.rooms, 1), 4);
  const where =
    `intersects(geo_shape, geom'POINT(${ctx.lng} ${ctx.lat})')` +
    ` AND annee='2024' AND piece=${piece} AND epoque='Avant 1946' AND meuble_txt='non meublé'`;
  const url =
    `${ENDPOINTS.encadrementLoyers}?where=${encodeURIComponent(where)}` +
    `&select=nom_quartier,ref,min,max&limit=1`;

  const data = await fetchJson<OdsRentResponse>(url, config);
  const hit = data?.results?.[0];
  if (hit && Number.isFinite(hit.ref) && Number.isFinite(hit.max)) {
    return {
      ref_m2: round(hit.ref!, 1),
      max_m2: round(hit.max!, 1),
      min_m2: round(hit.min ?? hit.ref! * 0.85, 1),
      quartier: hit.nom_quartier ?? getInseeProfile(ctx.district).name,
    };
  }

  // Deterministic fallback from the static per-arrondissement reference.
  const ref = getInseeProfile(ctx.district).loyerRefM2;
  return {
    ref_m2: round(ref, 1),
    max_m2: round(ref * 1.2, 1),
    min_m2: round(ref * 0.85, 1),
    quartier: getInseeProfile(ctx.district).name,
  };
}
