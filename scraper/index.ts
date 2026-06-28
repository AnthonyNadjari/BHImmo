/** Scraper module: fetch → normalize → deduplicate. */

import type { PipelineConfig } from "../shared/config.ts";
import { log } from "../shared/logger.ts";
import { fetchListings } from "./fetch-listings.ts";
import { normalizeListings } from "./normalize.ts";
import type { NormalizedListing } from "./types.ts";

export type { RawListing, NormalizedListing } from "./types.ts";
export { listingEndedInSale } from "./synthetic.ts";

/** Collapse duplicate listings that share a source + externalId. */
function deduplicate(listings: NormalizedListing[]): NormalizedListing[] {
  const seen = new Map<string, NormalizedListing>();
  for (const l of listings) {
    seen.set(`${l.source}:${l.externalId}`, l);
  }
  return [...seen.values()];
}

/**
 * Step 1 of the pipeline. Returns the deduplicated set of listings currently
 * visible from all sources.
 */
export async function ingestListings(
  config: PipelineConfig,
): Promise<NormalizedListing[]> {
  const raw = await fetchListings(config);
  const normalized = normalizeListings(raw);
  const deduped = deduplicate(normalized);
  log.ok(`Ingested ${deduped.length} normalized listings`);
  return deduped;
}
