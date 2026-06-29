/**
 * Transport accessibility score (0–100).
 *
 * Primary signal is fully offline & deterministic: distance to the nearest
 * curated métro/RER station and the number of stations within a short walk.
 * In `live` mode we additionally query Overpass (OpenStreetMap) for the real
 * count of nearby rail stops and blend it in; any failure silently keeps the
 * static result.
 */

import { type PipelineConfig } from "../shared/config.ts";
import { clamp, haversineMeters, round } from "../shared/geo.ts";
import { STATIONS } from "../shared/paris.ts";
import { hasReferences, refStations } from "./reference.ts";

export interface TransportContext {
  lat: number;
  lng: number;
}

const WALK_RADIUS_M = 600;

export async function enrichTransport(
  ctx: TransportContext,
  _config: PipelineConfig,
): Promise<number> {
  // Use the real, comprehensive IDFM station set when loaded (live/hybrid);
  // fall back to the curated static set offline. Both are real coordinates, so
  // no per-property API call is needed.
  const set = hasReferences() && refStations().length ? refStations() : STATIONS;
  const distances = set.map((s) => haversineMeters(ctx.lat, ctx.lng, s.lat, s.lng));
  const nearest = Math.min(...distances);
  const nearbyCount = distances.filter((d) => d <= WALK_RADIUS_M).length;
  return round(combine(nearest, nearbyCount));
}

function combine(nearestM: number, nearbyCount: number): number {
  // Proximity component: <=150 m is excellent, >=1000 m is poor.
  const proximity = clamp(100 * (1 - (nearestM - 150) / 850), 15, 100);
  // Density component: 5+ stations within walking distance saturates.
  const density = clamp((nearbyCount / 5) * 100, 0, 100);
  return clamp(0.6 * proximity + 0.4 * density, 0, 100);
}
