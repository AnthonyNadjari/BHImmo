/**
 * Listing ingestion entry point.
 *
 * In `live`/`hybrid` mode the property universe is sourced from REAL Paris
 * apartment transactions published as open data by Etalab (DVF — see
 * `dvf-source.ts`). If those files can't be read — or in `mock` mode — we fall
 * back to the deterministic synthetic universe so the pipeline always produces
 * a valid dataset. No listing-portal scraping (forbidden + blocked in CI).
 */

import type { PipelineConfig } from "../shared/config.ts";
import { log } from "../shared/logger.ts";
import { liveDvfListings } from "./dvf-source.ts";
import { liveListingsAt } from "./synthetic.ts";
import type { RawListing } from "./types.ts";

export async function fetchListings(
  config: PipelineConfig,
): Promise<RawListing[]> {
  // Real DVF transactions are the universe whenever available (independent of
  // run mode, which only governs live vs deterministic secondary enrichment).
  const live = await liveDvfListings(config);
  if (live.length > 0) {
    log.info(
      `Fetched ${live.length} live listings (source: DVF/Etalab real transactions, asof ${config.now.toISOString().slice(0, 10)})`,
    );
    return live;
  }
  if (process.env.PRER_DVF !== "off") {
    log.warn("DVF source unavailable — falling back to synthetic universe");
  }

  const listings = liveListingsAt(config.now);
  log.info(
    `Fetched ${listings.length} listings (source: synthetic fallback, asof ${config.now.toISOString().slice(0, 10)})`,
  );
  return listings;
}
