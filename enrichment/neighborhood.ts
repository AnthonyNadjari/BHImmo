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
  const [schools, amenities] = await Promise.all([
    fetchSchoolCount(ctx, config),
    fetchAmenities(ctx, config),
  ]);

  const income = getInseeProfile(ctx.district).income;
  const walk_score = computeWalkScore(amenities, schools);

  return { walk_score, schools_500m: schools, income, amenities };
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

interface OverpassCountResponse {
  elements?: Array<{ type?: string; tags?: { total?: string } }>;
}

async function fetchAmenities(
  ctx: NeighborhoodContext,
  config: PipelineConfig,
): Promise<Amenities> {
  // One request → four ordered `out count` blocks (food, health, green, culture).
  const a = `around:${RADIUS_M},${ctx.lat},${ctx.lng}`;
  const query =
    `[out:json][timeout:25];` +
    `(node["shop"](${a}););->.food;` +
    `(node["amenity"~"pharmacy|doctors|clinic|hospital"](${a}););->.health;` +
    `(node["leisure"~"park|garden"](${a});way["leisure"~"park|garden"](${a}););->.green;` +
    `(node["amenity"~"theatre|cinema|library|arts_centre"](${a});node["tourism"="museum"](${a}););->.culture;` +
    `.food out count;.health out count;.green out count;.culture out count;`;

  const data = await fetchJson<OverpassCountResponse>(ENDPOINTS.overpass, config, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });

  const counts = data?.elements
    ?.filter((e) => e.type === "count")
    .map((e) => Number(e.tags?.total ?? 0));

  if (counts && counts.length === 4 && counts.every((n) => Number.isFinite(n))) {
    return { food: counts[0]!, health: counts[1]!, green: counts[2]!, culture: counts[3]! };
  }
  return syntheticAmenities(ctx);
}

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

function computeWalkScore(a: Amenities, schools: number): number {
  const score =
    0.3 * part(a.food, 15) +
    0.15 * part(a.health, 8) +
    0.2 * part(a.green, 4) +
    0.15 * part(a.culture, 5) +
    0.2 * part(schools, 8);
  return round(clamp(score, 0, 100));
}
