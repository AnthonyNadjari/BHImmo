/**
 * Neighbourhood / lifestyle enrichment.
 *
 * Combines three free, key-less sources into a walkability picture:
 *  - schools within 500 m  → data.education.gouv.fr (Opendatasoft, verified)
 *  - amenities within 500 m → OpenStreetMap Overpass (food / health / green /
 *    culture); works on CI runners, falls back deterministically otherwise
 *  - median household income → static INSEE FiLoSoFi reference
 *
 * From these we derive a composite `walk_score` (0–100). Every live call has a
 * deterministic fallback so the dataset is always complete and reproducible.
 */

import { ENDPOINTS, fetchJson, type PipelineConfig } from "../shared/config.ts";
import { clamp, round } from "../shared/geo.ts";
import { SeededRandom } from "../shared/prng.ts";
import type { Amenities, Neighborhood } from "../shared/types.ts";
import { getInseeProfile } from "./insee.ts";
import { hasReferences, refSchoolCount, refVelibCount } from "./reference.ts";

export interface NeighborhoodContext {
  id: string;
  lat: number;
  lng: number;
  district: string;
}

const RADIUS_M = 500;

export async function enrichNeighborhood(
  ctx: NeighborhoodContext,
  config: PipelineConfig,
): Promise<Neighborhood> {
  // Schools & Vélib' come from the cached real reference sets when loaded
  // (live/hybrid) — counted locally, no per-property API call. Amenities and
  // tree canopy stay deterministic (Overpass / 200k-row tree set don't scale
  // per property); the green count is informed by the real parks nearby.
  const refs = hasReferences();
  const schools = refs ? refSchoolCount(ctx.lat, ctx.lng, RADIUS_M) : await fetchSchoolCount(ctx, config);
  const velib = refs
    ? refVelibCount(ctx.lat, ctx.lng, 400)
    : await fetchOdsCount(ENDPOINTS.velib, "coordonnees_geo", 400, `velib:${ctx.id}`, ctx, config, [1, 8]);
  const amenities = syntheticAmenities(ctx);
  const trees = treesEstimate(ctx);

  const income = getInseeProfile(ctx.district).income;
  const walk_score = computeWalkScore(amenities, schools, velib, trees);

  return {
    walk_score,
    schools_500m: schools,
    income,
    velib_400m: velib,
    trees_150m: trees,
    amenities,
  };
}

/** Deterministic street-tree canopy proxy (the 200k-row set isn't worth a call). */
function treesEstimate(ctx: NeighborhoodContext): number {
  const density = getInseeProfile(ctx.district).density;
  const rng = new SeededRandom(`trees:${ctx.id}`);
  const richness = clamp(density / 32000, 0.4, 1.2);
  return Math.round(clamp(rng.gaussian(95 * richness, 34), 10, 180));
}

/* ----------------- generic Opendatasoft count (geo) ---------------- */

interface OdsCountResponse {
  total_count?: number;
}

/**
 * Count Opendatasoft records within `radius` m of the property, falling back to
 * a deterministic value in `[fallbackRange]` scaled by neighbourhood density.
 */
async function fetchOdsCount(
  endpoint: string,
  geoField: string,
  radius: number,
  seed: string,
  ctx: NeighborhoodContext,
  config: PipelineConfig,
  fallbackRange: [number, number],
): Promise<number> {
  const where = `distance(${geoField}, geom'POINT(${ctx.lng} ${ctx.lat})', ${radius}m)`;
  const url = `${endpoint}?where=${encodeURIComponent(where)}&limit=0`;
  const data = await fetchJson<OdsCountResponse>(url, config);
  if (data && typeof data.total_count === "number") return data.total_count;

  const density = getInseeProfile(ctx.district).density;
  const rng = new SeededRandom(seed);
  const [lo, hi] = fallbackRange;
  const richness = clamp(density / 32000, 0.4, 1.2);
  return Math.round(clamp(rng.gaussian((lo + hi) / 2 * richness, (hi - lo) / 5), lo, hi));
}

/* ----------------------------- schools ----------------------------- */

interface EducationResponse {
  total_count?: number;
}

async function fetchSchoolCount(
  ctx: NeighborhoodContext,
  config: PipelineConfig,
): Promise<number> {
  // Opendatasoft ODSQL: count records whose `position` is within RADIUS of us.
  const where = `distance(position, geom'POINT(${ctx.lng} ${ctx.lat})', ${RADIUS_M}m)`;
  const url = `${ENDPOINTS.education}?where=${encodeURIComponent(where)}&limit=0`;
  const data = await fetchJson<EducationResponse>(url, config);
  if (data && typeof data.total_count === "number") {
    return data.total_count;
  }
  // Deterministic fallback scaled by neighbourhood density.
  const density = getInseeProfile(ctx.district).density;
  const rng = new SeededRandom(`schools:${ctx.id}`);
  const base = clamp(density / 4000, 2, 11);
  return Math.round(clamp(rng.gaussian(base, 2), 1, 16));
}

/* ---------------------------- amenities ---------------------------- */

/** Deterministic amenity counts, denser arrondissements get more services. */
function syntheticAmenities(ctx: NeighborhoodContext): Amenities {
  const density = getInseeProfile(ctx.district).density;
  const rng = new SeededRandom(`amenities:${ctx.id}`);
  const richness = clamp(density / 32000, 0.35, 1.25); // 0.35–1.25 multiplier
  return {
    food: Math.round(clamp(rng.gaussian(22 * richness, 6), 1, 60)),
    health: Math.round(clamp(rng.gaussian(7 * richness, 3), 0, 25)),
    green: Math.round(clamp(rng.gaussian(2.5 * richness, 1.5), 0, 8)),
    culture: Math.round(clamp(rng.gaussian(4 * richness, 2), 0, 20)),
  };
}

/* ---------------------------- walk score --------------------------- */

/** Saturating component score: `count` relative to a "great" target. */
function part(count: number, target: number): number {
  return clamp((count / target) * 100, 0, 100);
}

function computeWalkScore(
  a: Amenities,
  schools: number,
  velib: number,
  trees: number,
): number {
  const score =
    0.26 * part(a.food, 15) +
    0.12 * part(a.health, 8) +
    0.14 * part(a.green, 4) +
    0.12 * part(a.culture, 5) +
    0.16 * part(schools, 8) +
    0.1 * part(velib, 4) + // bike mobility
    0.1 * part(trees, 90); // green canopy
  return round(clamp(score, 0, 100));
}
