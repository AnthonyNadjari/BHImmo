/**
 * Dataset export (Step 7). Writes the three public artifacts consumed by the
 * static frontend:
 *
 *   data/properties.json  full records (source of truth)
 *   data/index.json       compact per-property rows for the dashboard
 *   data/market.json      per-arrondissement market model + source provenance
 */

import { join } from "node:path";
import { DATA_DIR, FILES } from "../shared/config.ts";
import { log } from "../shared/logger.ts";
import type { Badge, IndexEntry, IndexFile, Property } from "../shared/types.ts";
import { buildMarket, type MarketContext } from "./market.ts";
import { saveProperties, writeJson } from "./repository.ts";

const OPPORTUNITY_THRESHOLD = 68;
/** Sold at least this % ABOVE the local DVF average → "overvalued" (a fact, not a score cut). */
const OVERVALUED_GAP_PCT = -10;

function badgeFor(score: number, dvfGapPct: number | null): Badge {
  if (score >= OPPORTUNITY_THRESHOLD) return "opportunity";
  if (dvfGapPct !== null && dvfGapPct <= OVERVALUED_GAP_PCT) return "overvalued";
  return "watch";
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
    price: p.sale.price,
    price_per_m2: p.sale.price_per_m2,
    sale_date: p.sale.date,
    opportunity_score: p.score.opportunity_score,
    badge: badgeFor(p.score.opportunity_score, p.investment.dvf_gap_pct),
    image: p.thumb,
    walk_score: p.neighborhood.walk_score,
    gross_yield: p.investment.gross_yield,
    net_yield: p.investment.net_yield,
    ppm2_percentile: p.investment.ppm2_percentile,
    dvf_gap_pct: p.investment.dvf_gap_pct,
    dpe_energy: p.dpe?.energy_class ?? null,
    dpe_scope: p.dpe?.scope ?? null,
    resale_change_pct: p.signals.resale?.change_pct ?? null,
    spark: p.price_history.map((h) => h.price),
  };
}

export async function exportDatasets(properties: Property[], ctx: MarketContext): Promise<void> {
  // Stable order: newest sale first, then id (clean diffs between runs).
  const sorted = [...properties].sort((a, b) => b.sale.date.localeCompare(a.sale.date) || a.id.localeCompare(b.id));
  await saveProperties(sorted, ctx.generatedAt);

  const entries = sorted.map(toIndexEntry).sort((a, b) => b.opportunity_score - a.opportunity_score || a.id.localeCompare(b.id));
  const index: IndexFile = { generated_at: ctx.generatedAt, dvf: ctx.dvf, count: entries.length, properties: entries };
  await writeJson(join(DATA_DIR, FILES.index), index);
  log.ok(`Wrote ${FILES.index} (${entries.length} rows)`);

  const market = buildMarket(sorted, ctx);
  await writeJson(join(DATA_DIR, FILES.market), market);
  log.ok(`Wrote ${FILES.market} (${market.arrondissements.length} arrondissements)`);
}
