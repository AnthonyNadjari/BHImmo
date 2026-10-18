/**
 * Neighbourhood / lifestyle metrics, counted locally from the real reference
 * sets (see `reference.ts`) plus INSEE arrondissement statistics.
 *
 * `walk_score` (0–100) averages the components that are available, each
 * saturating at a "great" target set near the 75th percentile observed across
 * Paris sales (Paris is dense: a fixed suburban scale would saturate). Missing
 * sources are left out of the average rather than imputed.
 */

import { clamp, round } from "../shared/geo.ts";
import type { Amenities, Neighborhood } from "../shared/types.ts";
import { getInseeProfile } from "./insee.ts";
import type { References } from "./reference.ts";

export function enrichNeighborhood(lat: number, lng: number, district: string, refs: References): Neighborhood {
  let amenities: Amenities | null = null;
  if (refs.amenities) {
    amenities = { food: 0, health: 0, culture: 0 };
    for (const { p } of refs.amenities.within(lat, lng, 500)) amenities[p.kind]++;
  }
  const insee = getInseeProfile(district);
  const hood: Neighborhood = {
    walk_score: null,
    schools_500m: refs.schools?.count(lat, lng, 500) ?? null,
    velib_400m: refs.velib?.count(lat, lng, 400) ?? null,
    trees_150m: refs.trees?.count(lat, lng, 150) ?? null,
    parks_500m: refs.parks?.count(lat, lng, 500) ?? null,
    amenities,
    income: insee.income,
    poverty_rate: insee.povertyRate,
  };
  hood.walk_score = computeWalkScore(hood);
  return hood;
}

/** Saturating component score: `count` relative to a "great" target. */
const part = (count: number, target: number) => clamp((count / target) * 100, 0, 100);

export function computeWalkScore(h: Neighborhood): number | null {
  const components: Array<[number | null | undefined, number, number]> = [
    // [count, target, weight]
    [h.amenities?.food, 430, 0.26],
    [h.amenities?.health, 27, 0.12],
    [h.amenities?.culture, 17, 0.12],
    [h.parks_500m, 10, 0.14],
    [h.schools_500m, 17, 0.16],
    [h.velib_400m, 9, 0.1],
    [h.trees_150m, 140, 0.1],
  ];
  let sum = 0;
  let weight = 0;
  for (const [count, target, w] of components) {
    if (count === null || count === undefined) continue;
    sum += w * part(count, target);
    weight += w;
  }
  return weight > 0 ? round(sum / weight) : null;
}
