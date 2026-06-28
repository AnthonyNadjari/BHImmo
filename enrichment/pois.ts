/**
 * Nearby points of interest for the property mini-map: transport stations
 * (from the curated real métro/RER set), plus parks and Vélib' stations.
 *
 * Transport markers use real station coordinates. Parks/Vélib' are placed
 * deterministically around the property (seeded by id) so the map is populated
 * even in mock mode; the live pipeline can swap in IDFM/espaces-verts geometry.
 */

import { haversineMeters, round } from "../shared/geo.ts";
import { STATIONS } from "../shared/paris.ts";
import { SeededRandom } from "../shared/prng.ts";

export interface Poi {
  type: "transport" | "park" | "velib";
  lat: number;
  lng: number;
  label: string;
}

export interface PoiContext {
  id: string;
  lat: number;
  lng: number;
}

const TRANSPORT_RADIUS_M = 750;

export function nearbyPois(ctx: PoiContext): Poi[] {
  const pois: Poi[] = [];

  // Real stations within walking distance (closest first, capped).
  const stations = STATIONS.map((s) => ({
    s,
    d: haversineMeters(ctx.lat, ctx.lng, s.lat, s.lng),
  }))
    .filter((x) => x.d <= TRANSPORT_RADIUS_M)
    .sort((a, b) => a.d - b.d)
    .slice(0, 5);
  for (const { s } of stations) {
    pois.push({ type: "transport", lat: s.lat, lng: s.lng, label: s.name });
  }

  // Deterministic parks + Vélib' around the property.
  const rng = new SeededRandom(`pois:${ctx.id}`);
  const parkCount = rng.int(1, 3);
  for (let i = 0; i < parkCount; i++) {
    pois.push({
      type: "park",
      lat: round(ctx.lat + rng.range(-0.0028, 0.0028), 6),
      lng: round(ctx.lng + rng.range(-0.0038, 0.0038), 6),
      label: rng.pick(["Square", "Jardin", "Parc"]),
    });
  }
  const velibCount = rng.int(2, 4);
  for (let i = 0; i < velibCount; i++) {
    pois.push({
      type: "velib",
      lat: round(ctx.lat + rng.range(-0.0022, 0.0022), 6),
      lng: round(ctx.lng + rng.range(-0.003, 0.003), 6),
      label: "Vélib'",
    });
  }

  return pois;
}
