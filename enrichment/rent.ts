/**
 * Rental reference — the basis for rental YIELD.
 *
 * Source: Paris "encadrement des loyers" (opendata.paris.fr), the legal
 * reference rent per quartier × room count × construction era (non meublé).
 * The property's quartier is found by point-in-polygon on the official zones;
 * the era comes from the building's DPE (construction year or period). When no
 * DPE reports it, we use "Avant 1946" and flag it as an assumption.
 */

import { round } from "../shared/geo.ts";
import type { Rent } from "../shared/types.ts";
import { findQuartier, type References } from "./reference.ts";

type Epoque = "Avant 1946" | "1946-1970" | "1971-1990" | "Apres 1990";

function epoqueFromYear(y: number): Epoque {
  if (y < 1946) return "Avant 1946";
  if (y <= 1970) return "1946-1970";
  if (y <= 1990) return "1971-1990";
  return "Apres 1990";
}

/** ADEME construction periods → rent-control era (by majority overlap). */
function epoqueFromPeriod(period: string): Epoque | null {
  const p = period.toLowerCase();
  if (p.startsWith("avant")) return "Avant 1946";
  const start = Number(/(\d{4})/.exec(p)?.[1]);
  if (!Number.isFinite(start)) return null;
  if (start < 1970) return "1946-1970";
  if (start < 1989) return "1971-1990";
  return "Apres 1990";
}

export function enrichRent(
  lat: number,
  lng: number,
  rooms: number,
  surface: number,
  /** Construction facts and where they come from (building DPE or advert). */
  built: { year_built: number | null; period: string | null; source: "dpe" | "advert" } | null,
  refs: References,
): Rent | null {
  if (!refs.rent) return null;
  const zone = findQuartier(refs, lat, lng);
  if (!zone) return null;

  let epoque: Epoque | null = null;
  if (built?.year_built) epoque = epoqueFromYear(built.year_built);
  else if (built?.period) epoque = epoqueFromPeriod(built.period);
  const epoque_source = epoque && built ? built.source : "assumed";
  epoque ??= "Avant 1946";

  const piece = Math.min(Math.max(rooms, 1), 4);
  const r = zone.rents.get(`${piece}|${epoque}`);
  if (!r || !Number.isFinite(r.ref) || !Number.isFinite(r.max)) return null;
  return {
    ref_m2: round(r.ref, 1),
    max_m2: round(r.max, 1),
    min_m2: round(r.min, 1),
    monthly_est: round(r.max * surface),
    quartier: zone.quartier,
    year: refs.rent.year,
    epoque,
    epoque_source,
  };
}
