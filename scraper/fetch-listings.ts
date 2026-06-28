/**
 * Listing ingestion entry point.
 *
 * In every mode we currently source listings from the deterministic synthetic
 * universe (no free, ToS-compatible listings API exists). The function is kept
 * async and source-agnostic so a real portal connector can be slotted in later
 * without touching the rest of the pipeline — it just has to return
 * `RawListing[]`.
 */

import type { PipelineConfig } from "../shared/config.ts";
import { log } from "../shared/logger.ts";
import { liveListingsAt } from "./synthetic.ts";
import type { RawListing } from "./types.ts";

export async function fetchListings(
  config: PipelineConfig,
): Promise<RawListing[]> {
  const listings = liveListingsAt(config.now);
  log.info(
    `Fetched ${listings.length} live listings (source: synthetic, asof ${config.now.toISOString().slice(0, 10)})`,
  );
  return listings;
}
