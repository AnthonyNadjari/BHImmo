/**
 * Pipeline orchestrator — the seven mandated steps, exposed as a reusable
 * `runPipeline(config)` so both the CLI (`run.ts`) and the seeder (`seed.ts`)
 * share one implementation.
 *
 *   1. Ingestion      (scraper)        fetch + normalize + dedupe listings
 *   2. Geocoding      (enrichment/BAN) normalize addresses → coordinates
 *   3. Enrichment     (DVF/risks/...)  attach market + risk + transport + DPE
 *   4. Matching       (scraper/match)  reconcile against existing properties
 *   5. Historical     (this file)      append price history, compute DOM
 *   6. Scoring        (scoring)        opportunity score + explainable signals
 *   7. Export         (storage)        properties.json / index.json / market.json
 */

import type { PipelineConfig } from "../shared/config.ts";
import { log } from "../shared/logger.ts";
import { imageSet } from "../shared/images.ts";
import type { NormalizedListing } from "../scraper/index.ts";
import { ingestListings, listingEndedInSale } from "../scraper/index.ts";
import { matchListings, propertyId } from "../scraper/match.ts";
import { enrichProperty, geocode } from "../enrichment/index.ts";
import { scoreProperty } from "../scoring/index.ts";
import { exportDatasets, loadProperties } from "../storage/index.ts";
import type { Property } from "../shared/types.ts";

const DAY_MS = 86_400_000;

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysBetween(fromISO: string, toISO: string): number {
  const ms = Date.parse(toISO) - Date.parse(fromISO);
  return Math.max(0, Math.floor(ms / DAY_MS));
}

/** Recover the source externalId from a property id ("source-externalId"). */
function extractExternalId(id: string): string {
  const idx = id.indexOf("-");
  return idx >= 0 ? id.slice(idx + 1) : id;
}

async function buildNewProperty(
  listing: NormalizedListing,
  config: PipelineConfig,
): Promise<Property> {
  const id = propertyId(listing);
  const today = isoDay(config.now);

  // Step 2 — geocoding.
  const geo = await geocode(listing, config);

  // Step 3 — enrichment.
  const enrichment = await enrichProperty(
    { id, lat: geo.lat, lng: geo.lng, district: geo.district },
    config,
  );

  const gallery = imageSet(id);

  return {
    id,
    address: {
      raw: listing.rawAddress,
      normalized: geo.normalized,
      lat: geo.lat,
      lng: geo.lng,
      district: geo.district,
    },
    characteristics: {
      surface_m2: listing.surface_m2,
      rooms: listing.rooms,
      floor: listing.floor,
    },
    pricing: {
      current_price: listing.price,
      price_per_m2: listing.price_per_m2,
      initial_price: listing.price,
    },
    timeline: { first_seen: today, last_seen: today, days_on_market: 0 },
    price_history: [{ date: today, price: listing.price, source: listing.source }],
    status: "active",
    dvf: enrichment.dvf,
    risks: enrichment.risks,
    transport_score: enrichment.transport_score,
    dpe: enrichment.dpe,
    images: gallery.images,
    thumb: gallery.thumb,
    // Filled by the scoring pass below.
    score: { opportunity_score: 0, price_score: 0, market_gap_score: 0, liquidity_score: 0 },
    signals: { price_drops: 0, total_drop_percent: 0, long_time_on_market: false, explanations: [] },
    source: listing.source,
    url: listing.url,
  };
}

/** Step 5 — apply a fresh observation to an existing property. */
function applyUpdate(
  property: Property,
  listing: NormalizedListing,
  config: PipelineConfig,
): void {
  const today = isoDay(config.now);
  const last = property.price_history[property.price_history.length - 1];

  // Keep at most one observation per calendar day: update today's point in
  // place, otherwise append only when the price actually moved.
  if (last && last.date === today) {
    last.price = listing.price;
  } else if (!last || last.price !== listing.price) {
    property.price_history.push({
      date: today,
      price: listing.price,
      source: listing.source,
    });
  }

  property.pricing.current_price = listing.price;
  property.pricing.price_per_m2 = listing.price_per_m2;
  property.characteristics.surface_m2 = listing.surface_m2;
  property.characteristics.rooms = listing.rooms;
  property.characteristics.floor = listing.floor;
  property.timeline.last_seen = today;
  property.timeline.days_on_market = daysBetween(property.timeline.first_seen, today);
  property.status = "active";
}

export interface PipelineSummary {
  total: number;
  active: number;
  created: number;
  updated: number;
  disappeared: number;
  opportunities: number;
}

export async function runPipeline(config: PipelineConfig): Promise<PipelineSummary> {
  log.info(`P.R.E.R pipeline starting — mode=${config.mode}, asof=${isoDay(config.now)}`);

  const existing = await loadProperties();
  const byId = new Map(existing.map((p) => [p.id, p]));

  // Step 1 — ingestion.
  log.step(1, "Ingestion");
  const listings = await ingestListings(config);

  // Step 4 — matching (identity reconciliation against existing dataset).
  log.step(4, "Matching engine");
  const plan = matchListings(listings, existing);
  log.info(
    `Match plan: ${plan.toCreate.length} new, ${plan.toUpdate.length} updated, ${plan.disappeared.length} disappeared`,
  );

  // Steps 2 + 3 — geocoding & enrichment (only for genuinely new properties).
  log.step(2, "Geocoding (new listings)");
  log.step(3, "Enrichment (DVF / Géorisques / transport / DPE)");
  for (const listing of plan.toCreate) {
    const property = await buildNewProperty(listing, config);
    byId.set(property.id, property);
  }
  if (plan.toCreate.length) log.ok(`Enriched ${plan.toCreate.length} new properties`);

  // Step 5 — historical update for re-seen and disappeared listings.
  log.step(5, "Historical update");
  for (const { property, listing } of plan.toUpdate) {
    applyUpdate(property, listing, config);
  }
  for (const gone of plan.disappeared) {
    gone.status = listingEndedInSale(extractExternalId(gone.id)) ? "sold" : "removed";
  }

  // Step 6 — scoring (recompute for the whole dataset; it's cheap and pure).
  log.step(6, "Scoring engine");
  const all = [...byId.values()];
  for (const property of all) {
    // Backfill imagery for any property persisted before galleries existed.
    if (!property.images || property.images.length === 0) {
      const gallery = imageSet(property.id);
      property.images = gallery.images;
      property.thumb = gallery.thumb;
    }
    const { score, signals } = scoreProperty(property);
    property.score = score;
    property.signals = signals;
  }

  // Step 7 — export.
  // Use day-granularity for generated_at so a no-change run produces
  // byte-identical JSON (the scheduled workflow then commits nothing instead
  // of churning an empty diff 4× a day).
  log.step(7, "Export datasets");
  await exportDatasets(all, `${isoDay(config.now)}T00:00:00.000Z`);

  const active = all.filter((p) => p.status === "active").length;
  const opportunities = all.filter((p) => p.score.opportunity_score >= 68).length;
  log.ok(
    `Done. ${all.length} properties total · ${active} active · ${opportunities} flagged opportunities`,
  );

  return {
    total: all.length,
    active,
    created: plan.toCreate.length,
    updated: plan.toUpdate.length,
    disappeared: plan.disappeared.length,
    opportunities,
  };
}
