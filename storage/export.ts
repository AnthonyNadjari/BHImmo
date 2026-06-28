/**
 * Dataset export (Step 7). Writes the three public artifacts consumed by the
 * static frontend:
 *
 *   data/properties.json  full records (source of truth)
 *   data/index.json       compact per-property rows for the dashboard
 *   data/market.json      per-arrondissement market model
 */

import { join } from "node:path";
import { DATA_DIR, FILES } from "../shared/config.ts";
import { log } from "../shared/logger.ts";
import type { IndexEntry, IndexFile, Property } from "../shared/types.ts";
import { buildMarket } from "./market.ts";
import { saveProperties, writeJson } from "./repository.ts";

const OPPORTUNITY_THRESHOLD = 68;
const OVERVALUED_THRESHOLD = 45;

function badgeFor(score: number): IndexEntry["badge"] {
  if (score >= OPPORTUNITY_THRESHOLD) return "opportunity";
  if (score <= OVERVALUED_THRESHOLD) return "overvalued";
  return "watch";
}

/** Last N price points, for the dashboard sparkline. */
function spark(property: Property, n = 12): number[] {
  return property.price_history.slice(-n).map((p) => p.price);
}

function toIndexEntry(p: Property): IndexEntry {
  return {
    id: p.id,
    address: p.address.normalized,
    district: p.address.district,
    lat: p.address.lat,
    lng: p.address.lng,
    surface_m2: p.characteristics.surface_m2,
    rooms: p.characteristics.rooms,
    current_price: p.pricing.current_price,
    price_per_m2: p.pricing.price_per_m2,
    opportunity_score: p.score.opportunity_score,
    price_drops: p.signals.price_drops,
    total_drop_percent: p.signals.total_drop_percent,
    days_on_market: p.timeline.days_on_market,
    long_time_on_market: p.signals.long_time_on_market,
    status: p.status,
    spark: spark(p),
    badge: badgeFor(p.score.opportunity_score),
  };
}

export async function exportDatasets(
  properties: Property[],
  generatedAt: string,
): Promise<void> {
  // Full records.
  await saveProperties(properties, generatedAt);

  // Compact index, sorted by opportunity score (best first).
  const entries = properties
    .map(toIndexEntry)
    .sort((a, b) => b.opportunity_score - a.opportunity_score);
  const index: IndexFile = {
    generated_at: generatedAt,
    count: entries.length,
    properties: entries,
  };
  await writeJson(join(DATA_DIR, FILES.index), index);
  log.ok(`Wrote ${FILES.index} (${entries.length} rows)`);

  // Market model.
  const market = buildMarket(properties, generatedAt);
  await writeJson(join(DATA_DIR, FILES.market), market);
  log.ok(`Wrote ${FILES.market} (${market.arrondissements.length} arrondissements)`);
}
