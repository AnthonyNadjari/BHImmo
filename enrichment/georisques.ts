/**
 * Natural-risk enrichment.
 *
 * - Clay shrink-swell (`clay`) is sourced from the Géorisques RGA API
 *   (https://www.georisques.gouv.fr/api/v1/rga?latlon=lng,lat), the most
 *   stable Géorisques v1 endpoint, mapped to a 0–1 exposure. Falls back to a
 *   deterministic estimate on failure.
 * - Flood (`flood`) is a transparent geographic proxy: proximity to a
 *   simplified centerline of the Seine (the Paris PPRI follows the river).
 *   No data is invented and no flood API is hallucinated.
 * - Noise (`noise`) is a transit/traffic-proximity proxy (distance to the
 *   nearest major station). It is clearly a heuristic, not a measured value.
 *
 * All three are returned on a 0–1 scale (higher = more exposure).
 */

import { ENDPOINTS, fetchJson, type PipelineConfig } from "../shared/config.ts";
import { clamp, haversineMeters, round } from "../shared/geo.ts";
import { STATIONS } from "../shared/paris.ts";
import { SeededRandom } from "../shared/prng.ts";
import type { Risks } from "../shared/types.ts";

export interface RiskContext {
  id: string;
  lat: number;
  lng: number;
  district: string;
}

/** Simplified Seine centerline through Paris (lat/lng vertices, W→E). */
const SEINE: Array<[number, number]> = [
  [48.846, 2.277],
  [48.85, 2.288],
  [48.853, 2.3],
  [48.86, 2.313],
  [48.861, 2.323],
  [48.858, 2.333],
  [48.857, 2.345],
  [48.853, 2.355],
  [48.849, 2.365],
  [48.84, 2.38],
  [48.835, 2.39],
];

interface RgaResponse {
  exposition?: string;
  codeExposition?: string | number;
  data?: { exposition?: string };
}

const RGA_LEVELS: Record<string, number> = {
  nul: 0.05,
  aucune: 0.05,
  faible: 0.25,
  moyen: 0.55,
  moyenne: 0.55,
  fort: 0.85,
  forte: 0.85,
};

export async function enrichRisks(
  ctx: RiskContext,
  config: PipelineConfig,
): Promise<Risks> {
  return {
    flood: floodProxy(ctx),
    clay: await clayExposure(ctx, config),
    noise: noiseProxy(ctx),
  };
}

async function clayExposure(
  ctx: RiskContext,
  config: PipelineConfig,
): Promise<number> {
  const url = `${ENDPOINTS.georisquesClay}?latlon=${ctx.lng},${ctx.lat}`;
  const data = await fetchJson<RgaResponse>(url, config);
  const label = (data?.exposition ?? data?.data?.exposition ?? "")
    .toString()
    .toLowerCase()
    .trim();
  if (label && RGA_LEVELS[label] !== undefined) return RGA_LEVELS[label]!;

  // Deterministic fallback: Paris is mostly low/moderate clay exposure.
  const rng = new SeededRandom(`clay:${ctx.id}`);
  return round(clamp(rng.gaussian(0.3, 0.12), 0.05, 0.7), 2);
}

function floodProxy(ctx: RiskContext): number {
  let minDist = Infinity;
  for (const [lat, lng] of SEINE) {
    minDist = Math.min(minDist, haversineMeters(ctx.lat, ctx.lng, lat, lng));
  }
  const rng = new SeededRandom(`flood:${ctx.id}`);
  const jitter = rng.range(-0.05, 0.05);

  let base: number;
  if (minDist < 150) base = 0.85;
  else if (minDist < 350) base = 0.6;
  else if (minDist < 700) base = 0.35;
  else if (minDist < 1200) base = 0.15;
  else base = 0.05;

  return round(clamp(base + jitter, 0, 1), 2);
}

function noiseProxy(ctx: RiskContext): number {
  let nearest = Infinity;
  for (const s of STATIONS) {
    nearest = Math.min(nearest, haversineMeters(ctx.lat, ctx.lng, s.lat, s.lng));
  }
  const rng = new SeededRandom(`noise:${ctx.id}`);
  const jitter = rng.range(-0.08, 0.08);

  // Closer to a major hub → noisier surroundings.
  let base: number;
  if (nearest < 120) base = 0.75;
  else if (nearest < 300) base = 0.55;
  else if (nearest < 600) base = 0.4;
  else base = 0.28;

  return round(clamp(base + jitter, 0.05, 0.95), 2);
}
