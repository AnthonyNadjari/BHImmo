/**
 * Enrichment module (Step 3 of the pipeline).
 *
 * Given a geocoded property, attach DVF market context, natural-risk exposure,
 * a transport score and an energy class. Each enricher is independent and
 * resilient, so they run concurrently.
 */

import type { PipelineConfig } from "../shared/config.ts";
import type { DvfStats, Neighborhood, Risks } from "../shared/types.ts";
import { enrichDvf } from "./dvf.ts";
import { enrichRisks } from "./georisques.ts";
import { enrichTransport } from "./transport.ts";
import { enrichDpe, type DpeResult } from "./dpe.ts";
import { enrichNeighborhood } from "./neighborhood.ts";

export { geocode } from "./geocode.ts";
export type { GeocodeResult } from "./geocode.ts";
export { getInseeProfile } from "./insee.ts";

export interface EnrichmentContext {
  id: string;
  lat: number;
  lng: number;
  district: string;
}

export interface EnrichmentResult {
  dvf: DvfStats;
  risks: Risks;
  transport_score: number;
  dpe: DpeResult;
  neighborhood: Neighborhood;
}

export async function enrichProperty(
  ctx: EnrichmentContext,
  config: PipelineConfig,
): Promise<EnrichmentResult> {
  const [dvf, risks, transport_score, dpe, neighborhood] = await Promise.all([
    enrichDvf(ctx, config),
    enrichRisks(ctx, config),
    enrichTransport(ctx, config),
    enrichDpe(ctx, config),
    enrichNeighborhood(ctx, config),
  ]);
  return { dvf, risks, transport_score, dpe, neighborhood };
}
