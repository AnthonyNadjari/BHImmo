/**
 * Transport accessibility score (0–100).
 *
 * Primary signal is fully offline & deterministic: distance to the nearest
 * curated métro/RER station and the number of stations within a short walk.
 * In `live` mode we additionally query Overpass (OpenStreetMap) for the real
 * count of nearby rail stops and blend it in; any failure silently keeps the
 * static result.
 */

import { ENDPOINTS, fetchJson, type PipelineConfig } from "../shared/config.ts";
import { clamp, haversineMeters, round } from "../shared/geo.ts";
import { STATIONS } from "../shared/paris.ts";

export interface TransportContext {
  lat: number;
  lng: number;
}

const WALK_RADIUS_M = 600;

export async function enrichTransport(
  ctx: TransportContext,
  config: PipelineConfig,
): Promise<number> {
  const distances = STATIONS.map((s) =>
    haversineMeters(ctx.lat, ctx.lng, s.lat, s.lng),
  );
  const nearest = Math.min(...distances);
  let nearbyCount = distances.filter((d) => d <= WALK_RADIUS_M).length;

  const overpassCount = await overpassStationCount(ctx, config);
  if (overpassCount !== null) {
    // Blend the (sparse) static count with the real OSM count.
    nearbyCount = Math.round((nearbyCount + overpassCount) / 2);
  }

  return round(combine(nearest, nearbyCount));
}

function combine(nearestM: number, nearbyCount: number): number {
  // Proximity component: <=150 m is excellent, >=1000 m is poor.
  const proximity = clamp(100 * (1 - (nearestM - 150) / 850), 15, 100);
  // Density component: 5+ stations within walking distance saturates.
  const density = clamp((nearbyCount / 5) * 100, 0, 100);
  return clamp(0.6 * proximity + 0.4 * density, 0, 100);
}

interface OverpassResponse {
  elements?: unknown[];
}

async function overpassStationCount(
  ctx: TransportContext,
  config: PipelineConfig,
): Promise<number | null> {
  if (config.mode !== "live") return null;
  const query = `[out:json][timeout:5];(node["railway"="station"](around:${WALK_RADIUS_M},${ctx.lat},${ctx.lng});node["railway"="subway_entrance"](around:${WALK_RADIUS_M},${ctx.lat},${ctx.lng}););out count;`;
  const data = await fetchJson<OverpassResponse>(ENDPOINTS.overpass, config, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });
  const count = (data?.elements?.length ?? null) as number | null;
  return count;
}
