/**
 * Pipeline orchestrator — exposed as `runPipeline(config)` for the CLI.
 *
 *   1. Ingestion   (scraper)          real DVF sales → property universe
 *   2. Lookups     (enrichment)       BAN · ADEME DPE · Géorisques, once per address
 *   3. References  (enrichment)       IDFM, schools, Vélib', parks, trees, OSM,
 *                                     rent control, INSEE, road noise
 *   4. Enrichment  (enrichment)       comparables, transport, neighbourhood, rent
 *   5. History     (scraper)          earlier DVF sales of the same lot
 *   6. Scoring     (scoring)          deal score + explainable signals
 *   7. Export      (storage)          properties.json / index.json / market.json
 *
 * Every value is real open data or left empty. Without DVF the run throws, so
 * CI keeps the last committed dataset instead of publishing anything made up.
 */

import type { PipelineConfig } from "../shared/config.ts";
import { log } from "../shared/logger.ts";
import { aerialImageSet } from "../shared/images.ts";
import type { Property, SourceStatus } from "../shared/types.ts";
import { districtMarkets, loadDvf, lotHistory, selectUniverse, type DvfTxn } from "../scraper/index.ts";
import { enrichLocal, loadInsee, loadReferences, remoteLookups, streetPhotos } from "../enrichment/index.ts";
import { scoreDataset } from "../scoring/index.ts";
import { exportDatasets, loadProperties } from "../storage/index.ts";

/** A fresh property for a DVF sale (enrichment fills the rest). */
function baseProperty(t: DvfTxn): Property {
  const img = aerialImageSet(t.lat, t.lng);
  return {
    id: `dvf-${t.id}`,
    address: { raw: t.address, normalized: t.address, lat: t.lat, lng: t.lng, district: t.district, ban_id: null },
    characteristics: { surface_m2: t.surface, carrez_m2: t.carrez, rooms: t.rooms },
    sale: { date: t.date, price: t.price, price_per_m2: t.ppm2, mutation_id: t.id, parcel: t.parcel },
    price_history: [],
    dvf: { avg_price_m2_100m: null, avg_price_m2_500m: null, count_100m: 0, count_500m: 0, window_from: t.date, window_to: t.date, comparable_sales: [] },
    risks: { flood: null, clay: null, noise: null },
    transport: null,
    neighborhood: {
      walk_score: null, schools_500m: null, velib_400m: null, trees_150m: null, parks_500m: null,
      amenities: null, income: null, poverty_rate: null,
    },
    rent: null,
    investment: { gross_yield: null, net_yield: null, ppm2_percentile: 50, dvf_gap_pct: null, dpe_risk_score: null, value_add_flag: false },
    pois: [],
    images: [],
    thumb: img.thumb,
    image_credit: img.credit,
    dpe: null,
    score: { opportunity_score: 0, value_score: null, yield_score: null, liquidity_score: null, gentrification_score: null },
    signals: { resale: null, explanations: [] },
    source: "dvf",
    url: "https://app.dvf.etalab.gouv.fr/",
    lookups: {},
  };
}

/** Previous records in the current schema, by id (older formats are dropped). */
async function previousById(): Promise<Map<string, Property>> {
  const existing = await loadProperties();
  const valid = existing.filter((p) => (p as Partial<Property>).sale && (p as Partial<Property>).lookups);
  if (valid.length !== existing.length) log.info(`Dropped ${existing.length - valid.length} records in a legacy format`);
  return new Map(valid.map((p) => [p.id, p]));
}

export interface PipelineSummary {
  total: number;
  created: number;
  kept: number;
  dropped: number;
  opportunities: number;
}

export async function runPipeline(config: PipelineConfig): Promise<PipelineSummary> {
  log.info(`BHImmo pipeline starting — ${config.now.toISOString()}`);
  const previous = await previousById();

  // Step 1 — ingestion (mandatory: throws if DVF is unreachable).
  log.step(1, "Ingestion (DVF)");
  const dvf = await loadDvf(config);
  const universe = selectUniverse(dvf, config.perArrondissement);
  log.ok(`Universe: ${universe.length} most recent sales (${config.perArrondissement}/arrondissement)`);

  const properties: Property[] = [];
  const created: Property[] = [];
  for (const t of universe) {
    const prev = previous.get(`dvf-${t.id}`);
    if (prev) properties.push(prev);
    else {
      const p = baseProperty(t);
      properties.push(p);
      created.push(p);
    }
  }
  const dropped = [...previous.keys()].filter((id) => !properties.some((p) => p.id === id)).length;
  log.info(`${created.length} new · ${properties.length - created.length} kept · ${dropped} rotated out`);

  // Step 2 — per-address lookups (only what is missing).
  log.step(2, "Address lookups (BAN / ADEME DPE / Géorisques)");
  await remoteLookups(properties, config);
  await streetPhotos(created, config);

  // Step 3 — Paris-wide reference data.
  log.step(3, "Reference data (IDFM / schools / Vélib' / parks / trees / OSM / rent / INSEE / noise)");
  const [refs, inseeSources] = await Promise.all([loadReferences(config), loadInsee(config)]);

  // Steps 4 + 5 — local enrichment & lot history.
  log.step(4, "Enrichment (comparables, transport, neighbourhood, rent)");
  const txnById = new Map(universe.map((t) => [`dvf-${t.id}`, t]));
  for (const p of properties) {
    const t = txnById.get(p.id)!;
    enrichLocal(p, t, dvf, refs);
    p.price_history = lotHistory(dvf, t).map((s) => ({ date: s.date, price: s.price, source: "dvf" }));
  }
  log.step(5, "Resale history");
  log.ok(`${properties.filter((p) => p.price_history.length > 1).length} properties with an earlier DVF sale of the same lot`);

  // Step 6 — scoring.
  log.step(6, "Scoring engine");
  const market = districtMarkets(dvf);
  const districtPpm2 = new Map<string, number[]>();
  for (const s of dvf.sales) {
    if (s.year !== market.latestYear) continue;
    (districtPpm2.get(s.district) ?? districtPpm2.set(s.district, []).get(s.district)!).push(s.ppm2);
  }
  for (const list of districtPpm2.values()) list.sort((a, b) => a - b);
  scoreDataset(properties, {
    markets: market.byDistrict,
    cityTrend: market.cityTrend,
    latestYear: market.latestYear,
    districtPpm2,
  });

  // Step 7 — export, with provenance of every source.
  log.step(7, "Export datasets");
  const sources: SourceStatus[] = [
    {
      id: "dvf", label: "DVF — Demandes de valeurs foncières (DGFiP / Etalab)", status: "ok",
      url: "https://www.data.gouv.fr/fr/datasets/demandes-de-valeurs-foncieres-geolocalisees/",
      records: dvf.coverage.sales, period: `${dvf.coverage.first_sale} → ${dvf.coverage.last_sale}`,
    },
    lookupStatus("ban", "BAN — Base Adresse Nationale", "https://adresse.data.gouv.fr/", properties, (p) => p.lookups.ban, (p) => !!p.address.ban_id),
    lookupStatus("ademe", "ADEME — DPE logements existants", "https://data.ademe.fr/datasets/dpe03existant", properties.filter((p) => p.address.ban_id), (p) => p.lookups.dpe, (p) => !!p.dpe),
    lookupStatus("georisques", "Géorisques — TRI inondation", "https://www.georisques.gouv.fr/", properties, (p) => p.lookups.flood, (p) => !!p.risks.flood),
    { id: "ign", label: "IGN — BD ORTHO® / Plan IGN (imagerie)", status: "ok", url: "https://geoservices.ign.fr/bdortho", records: properties.length },
    ...refs.sources.map((s): SourceStatus => (s.status === "unavailable" && hasPrevious(s.id, properties) ? { ...s, status: "stale" } : s)),
    ...inseeSources,
  ];
  await exportDatasets(properties, {
    generatedAt: config.now.toISOString(),
    dvf: dvf.coverage,
    markets: market.byDistrict,
    cityMedian: market.cityMedian,
    cityTrend: market.cityTrend,
    latestYear: market.latestYear,
    refs,
    sources,
  });

  const opportunities = properties.filter((p) => p.score.opportunity_score >= 68).length;
  log.ok(`Done. ${properties.length} real sales · ${opportunities} flagged opportunities`);
  return { total: properties.length, created: created.length, kept: properties.length - created.length, dropped, opportunities };
}

/** Status of a per-address lookup over the properties it applies to. */
function lookupStatus(
  id: string,
  label: string,
  url: string,
  properties: Property[],
  done: (p: Property) => string | undefined,
  matched: (p: Property) => boolean,
): SourceStatus {
  const looked = properties.filter((p) => done(p));
  return {
    id,
    label,
    url,
    status: looked.length === properties.length ? "ok" : looked.length ? "stale" : "unavailable",
    records: looked.filter(matched).length,
  };
}

/** Whether properties still carry values from an earlier load of this source. */
function hasPrevious(id: string, properties: Property[]): boolean {
  const n = properties[0]?.neighborhood;
  if (!n) return false;
  switch (id) {
    case "osm": return properties.some((p) => p.neighborhood.amenities !== null);
    case "trees": return properties.some((p) => p.neighborhood.trees_150m !== null);
    case "schools": return properties.some((p) => p.neighborhood.schools_500m !== null);
    case "velib": return properties.some((p) => p.neighborhood.velib_400m !== null);
    case "parks": return properties.some((p) => p.neighborhood.parks_500m !== null);
    case "rent": return properties.some((p) => p.rent !== null);
    case "idfm": return properties.some((p) => p.transport !== null);
    case "noise": return properties.some((p) => p.risks.noise !== null);
    default: return false;
  }
}
