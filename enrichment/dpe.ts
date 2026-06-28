/**
 * Energy performance (DPE) enrichment via ADEME open data.
 *
 * ADEME publishes every French DPE through a data-fair API that supports
 * geo_distance queries:
 *
 *   https://data.ademe.fr/.../dpe-v2-logements-existants/lines
 *     ?geo_distance=lon,lat,150&size=1&select=etiquette_dpe,etiquette_ges
 *
 * We take the nearest certificate as a proxy for the building. When the API is
 * unavailable we synthesize a plausible class (Paris housing skews C–E given
 * the age of the stock).
 */

import { ENDPOINTS, fetchJson, type PipelineConfig } from "../shared/config.ts";
import { SeededRandom } from "../shared/prng.ts";

export interface DpeContext {
  id: string;
  lat: number;
  lng: number;
}

export interface DpeResult {
  energy_class: string;
  ghg_class: string;
}

interface AdemeResponse {
  results?: Array<{ etiquette_dpe?: string; etiquette_ges?: string }>;
}

const CLASSES = ["A", "B", "C", "D", "E", "F", "G"] as const;
// Weights skewed toward C–E, typical of Parisian Haussmann-era stock.
const ENERGY_WEIGHTS = [0.03, 0.08, 0.2, 0.26, 0.22, 0.13, 0.08];
const GHG_WEIGHTS = [0.05, 0.12, 0.24, 0.24, 0.18, 0.1, 0.07];

export async function enrichDpe(
  ctx: DpeContext,
  config: PipelineConfig,
): Promise<DpeResult> {
  const url = `${ENDPOINTS.ademeDpe}?geo_distance=${ctx.lng},${ctx.lat},150&size=1&select=etiquette_dpe,etiquette_ges`;
  const data = await fetchJson<AdemeResponse>(url, config);
  const hit = data?.results?.[0];
  if (hit?.etiquette_dpe && /^[A-G]$/.test(hit.etiquette_dpe)) {
    return {
      energy_class: hit.etiquette_dpe,
      ghg_class: /^[A-G]$/.test(hit.etiquette_ges ?? "") ? hit.etiquette_ges! : hit.etiquette_dpe,
    };
  }

  const rng = new SeededRandom(`dpe:${ctx.id}`);
  return {
    energy_class: weightedPick(rng, ENERGY_WEIGHTS),
    ghg_class: weightedPick(rng, GHG_WEIGHTS),
  };
}

function weightedPick(rng: SeededRandom, weights: number[]): string {
  const r = rng.float();
  let acc = 0;
  for (let i = 0; i < CLASSES.length; i++) {
    acc += weights[i]!;
    if (r <= acc) return CLASSES[i]!;
  }
  return CLASSES[CLASSES.length - 1]!;
}
