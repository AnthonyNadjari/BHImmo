/**
 * Nearby points of interest for the property mini-map: métro/RER/tram stations,
 * Vélib' docks and parks. When the live reference datasets are loaded (IDFM /
 * opendata.paris) the markers are REAL coordinates; offline we fall back to the
 * curated station set plus deterministic Vélib'/park placeholders so the map is
 * always populated.
 */

import { haversineMeters, round } from "../shared/geo.ts";
import { STATIONS } from "../shared/paris.ts";
import { SeededRandom } from "../shared/prng.ts";
import { hasReferences, nearestStations, nearestVelib, nearestParks } from "./reference.ts";

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
  if (hasReferences()) {
    const pois: Poi[] = [];
    for (const s of nearestStations(ctx.lat, ctx.lng, TRANSPORT_RADIUS_M, 5)) {
      pois.push({ type: "transport", lat: s.lat, lng: s.lng, label: s.meta ? `${s.name} · ${s.meta}` : s.name });
    }
    for (const p of nearestParks(ctx.lat, ctx.lng, 500, 3)) {
      pois.push({ type: "park", lat: p.lat, lng: p.lng, label: p.name });
    }
    for (const v of nearestVelib(ctx.lat, ctx.lng, 400, 4)) {
      pois.push({ type: "velib", lat: v.lat, lng: v.lng, label: v.name });
    }
    if (pois.length > 0) return pois;
  }

  return syntheticPois(ctx);
}

/** Offline fallback: real curated stations + deterministic parks/Vélib'. */
function syntheticPois(ctx: PoiContext): Poi[] {
  const pois: Poi[] = [];
  const stations = STATIONS.map((s) => ({ s, d: haversineMeters(ctx.lat, ctx.lng, s.lat, s.lng) }))
    .filter((x) => x.d <= TRANSPORT_RADIUS_M)
    .sort((a, b) => a.d - b.d)
    .slice(0, 5);
  for (const { s } of stations) pois.push({ type: "transport", lat: s.lat, lng: s.lng, label: s.name });

  const rng = new SeededRandom(`pois:${ctx.id}`);
  for (let i = 0; i < rng.int(1, 3); i++) {
    pois.push({
      type: "park",
      lat: round(ctx.lat + rng.range(-0.0028, 0.0028), 6),
      lng: round(ctx.lng + rng.range(-0.0038, 0.0038), 6),
      label: rng.pick(["Square", "Jardin", "Parc"]),
    });
  }
  for (let i = 0; i < rng.int(2, 4); i++) {
    pois.push({
      type: "velib",
      lat: round(ctx.lat + rng.range(-0.0022, 0.0022), 6),
      lng: round(ctx.lng + rng.range(-0.003, 0.003), 6),
      label: "Vélib'",
    });
  }
  return pois;
}
