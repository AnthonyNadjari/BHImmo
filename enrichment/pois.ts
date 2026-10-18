/**
 * Nearby points of interest for the property mini-map: real IDFM stations,
 * Ville de Paris parks and Vélib' stations. Empty when the sets are missing —
 * no placeholder markers.
 */

import type { Poi } from "../shared/types.ts";
import type { References } from "./reference.ts";

export function nearbyPois(lat: number, lng: number, refs: References): Poi[] {
  const pois: Poi[] = [];
  for (const { p } of refs.stations?.within(lat, lng, 750).slice(0, 5) ?? []) {
    pois.push({ type: "transport", lat: p.lat, lng: p.lng, label: p.meta ? `${p.name} · ${p.meta}` : p.name });
  }
  for (const { p } of refs.parks?.within(lat, lng, 500).slice(0, 3) ?? []) {
    pois.push({ type: "park", lat: p.lat, lng: p.lng, label: p.name });
  }
  for (const { p } of refs.velib?.within(lat, lng, 400).slice(0, 4) ?? []) {
    pois.push({ type: "velib", lat: p.lat, lng: p.lng, label: p.name });
  }
  return pois;
}
