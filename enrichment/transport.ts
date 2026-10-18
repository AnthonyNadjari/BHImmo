/**
 * Transport accessibility (0–100) from the real IDFM station set: distance to
 * the nearest métro / RER / tram station and how many stations are within a
 * short walk. Null when the station set could not be loaded.
 */

import { clamp, round } from "../shared/geo.ts";
import type { Transport } from "../shared/types.ts";
import type { References } from "./reference.ts";

const WALK_RADIUS_M = 600;

export function enrichTransport(lat: number, lng: number, refs: References): Transport | null {
  if (!refs.stations) return null;
  const near = refs.stations.within(lat, lng, 2000);
  if (near.length === 0) return null;
  const nearest = near[0]!;
  const stations_600m = near.filter((s) => s.d <= WALK_RADIUS_M).length;
  // Proximity: ≤150 m is excellent, ≥1 km is poor. Density: 5+ stations saturates.
  const proximity = clamp(100 * (1 - (nearest.d - 150) / 850), 15, 100);
  const density = clamp((stations_600m / 5) * 100, 0, 100);
  return {
    score: round(clamp(0.6 * proximity + 0.4 * density, 0, 100)),
    nearest_name: nearest.p.meta ? `${nearest.p.name} · ${nearest.p.meta}` : nearest.p.name,
    nearest_m: round(nearest.d),
    stations_600m,
  };
}
