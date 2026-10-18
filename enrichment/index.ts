/**
 * Enrichment module (Steps 2–3 of the pipeline).
 *
 *  - `remoteLookups`: per-address API calls (BAN, ADEME DPE, Géorisques). Their
 *    results are stored on the property with the date of the lookup, so each
 *    address is queried once; failed calls are retried on the next run.
 *  - `enrichLocal`: everything computed from the in-memory DVF + reference sets
 *    (comparables, transport, neighbourhood, rent, POIs, noise, imagery). It is
 *    recomputed on every run; when a reference set is unavailable the previous
 *    real value is kept instead of being replaced by a guess.
 */

import { mapPool, type PipelineConfig } from "../shared/config.ts";
import { round } from "../shared/geo.ts";
import { aerialImageSet } from "../shared/images.ts";
import { log } from "../shared/logger.ts";
import { ARRONDISSEMENTS } from "../shared/paris.ts";
import type { Property, RiskFact } from "../shared/types.ts";
import type { DvfData, DvfTxn } from "../scraper/index.ts";
import { enrichDvf } from "./dvf.ts";
import { lookupDpe } from "./dpe.ts";
import { mapillaryImages } from "./facade.ts";
import { geocode } from "./geocode.ts";
import { lookupClay, lookupFlood } from "./georisques.ts";
import { getInseeProfile } from "./insee.ts";
import { computeWalkScore, enrichNeighborhood } from "./neighborhood.ts";
import { nearbyPois } from "./pois.ts";
import type { References } from "./reference.ts";
import { enrichRent } from "./rent.ts";
import { enrichTransport } from "./transport.ts";

export { dvfReference } from "./dvf.ts";
export { getInseeProfile, loadInsee } from "./insee.ts";
export { loadReferences, type References } from "./reference.ts";

const today = (config: PipelineConfig) => config.now.toISOString().slice(0, 10);

/** Fill the per-address lookups that haven't completed yet. */
export async function remoteLookups(properties: Property[], config: PipelineConfig): Promise<void> {
  const stats = { ban: 0, dpe: 0, flood: 0, clay: 0, failed: 0 };
  const pending = properties.filter(
    (p) => !p.lookups.ban || (p.address.ban_id && !p.lookups.dpe) || !p.lookups.flood || !p.lookups.clay,
  );
  if (pending.length) log.info(`Address lookups for ${pending.length} properties (BAN · ADEME · Géorisques)…`);

  let done = 0;
  await mapPool(pending, config.concurrency, async (p) => {
    if (++done % 100 === 0) log.info(`  … ${done}/${pending.length}`);
    const day = today(config);
    if (!p.lookups.ban) {
      const g = await geocode(p.address.raw, p.address.district, config);
      if (g === undefined) stats.failed++;
      else {
        p.lookups.ban = day;
        stats.ban++;
        if (g) {
          p.address.normalized = g.normalized;
          p.address.ban_id = g.ban_id;
        }
      }
    }
    if (p.address.ban_id && !p.lookups.dpe) {
      const surfaces = [p.characteristics.surface_m2, p.characteristics.carrez_m2].filter((s): s is number => !!s);
      const dpe = await lookupDpe(p.address.ban_id, surfaces, p.sale.date, config);
      if (dpe === undefined) stats.failed++;
      else {
        p.dpe = dpe;
        p.lookups.dpe = day;
        stats.dpe++;
      }
    }
    if (!p.lookups.flood) {
      const flood = await lookupFlood(p.address.lat, p.address.lng, config);
      if (flood === undefined) stats.failed++;
      else {
        p.risks.flood = flood;
        p.lookups.flood = day;
        stats.flood++;
      }
    }
    if (!p.lookups.clay) {
      const clay = await lookupClay(p.address.lat, p.address.lng, config);
      if (clay === undefined) stats.failed++;
      else {
        p.risks.clay = clay;
        p.lookups.clay = day;
        stats.clay++;
      }
    }
  });

  if (pending.length) {
    log.ok(
      `Lookups done — BAN ${stats.ban} · DPE ${stats.dpe} · flood ${stats.flood} · clay ${stats.clay}` +
        (stats.failed ? ` · ${stats.failed} failed (retried next run)` : ""),
    );
  }
}

/** Road-noise exposure of the arrondissement (share of residents over Lden). */
function noiseFact(district: string, refs: References): RiskFact | null {
  if (!refs.noise) return null;
  const n = Number(district.slice(-2));
  const group = n <= 4 ? ARRONDISSEMENTS.slice(0, 4) : ARRONDISSEMENTS.filter((a) => a.district === district);
  const pop = group.reduce((s, a) => s + (getInseeProfile(a.district).population ?? NaN), 0);
  const exposed = refs.noise.exposed.get(district);
  if (!exposed || !Number.isFinite(pop) || pop <= 0) return null;

  // Severity relative to the noisiest arrondissement (data-driven scale).
  const shares = ARRONDISSEMENTS.map((a) => {
    const g = Number(a.district.slice(-2)) <= 4 ? ARRONDISSEMENTS.slice(0, 4) : [a];
    const p = g.reduce((s, x) => s + (getInseeProfile(x.district).population ?? NaN), 0);
    return (refs.noise!.exposed.get(a.district) ?? NaN) / p;
  }).filter(Number.isFinite);
  const share = exposed / pop;
  const where = n <= 4 ? "Paris Centre" : `${n}e`;
  return {
    value: round(share / Math.max(...shares), 2),
    label: `${round(share * 100, 1)} % des habitants (${where}) au-dessus de ${refs.noise.dbThreshold} dB(A) Lden — bruit routier ${refs.noise.year}`,
    scope: "arrondissement",
    source: "Ville de Paris — exposition au bruit routier",
  };
}

/** Recompute every locally-derived field of a property. */
export function enrichLocal(p: Property, txn: DvfTxn, dvf: DvfData, refs: References): void {
  const { lat, lng, district } = p.address;
  p.dvf = enrichDvf(dvf, txn);

  const transport = enrichTransport(lat, lng, refs);
  if (transport || refs.stations) p.transport = transport;

  // Neighbourhood: per component, keep the last real value if the source is down.
  const fresh = enrichNeighborhood(lat, lng, district, refs);
  const prev = p.neighborhood;
  p.neighborhood = {
    walk_score: null,
    schools_500m: refs.schools ? fresh.schools_500m : prev?.schools_500m ?? null,
    velib_400m: refs.velib ? fresh.velib_400m : prev?.velib_400m ?? null,
    trees_150m: refs.trees ? fresh.trees_150m : prev?.trees_150m ?? null,
    parks_500m: refs.parks ? fresh.parks_500m : prev?.parks_500m ?? null,
    amenities: refs.amenities ? fresh.amenities : prev?.amenities ?? null,
    income: fresh.income ?? prev?.income ?? null,
    poverty_rate: fresh.poverty_rate ?? prev?.poverty_rate ?? null,
  };
  p.neighborhood.walk_score = computeWalkScore(p.neighborhood);

  const surface = p.characteristics.carrez_m2 ?? p.characteristics.surface_m2;
  if (refs.rent) p.rent = enrichRent(lat, lng, p.characteristics.rooms, surface, p.dpe, refs);

  const pois = nearbyPois(lat, lng, refs);
  if (pois.length || (refs.stations && refs.parks && refs.velib)) p.pois = pois;

  const noise = noiseFact(district, refs);
  if (noise || refs.noise) p.risks.noise = noise;

  // Keep street-level photos fetched earlier (Mapillary), then the IGN views.
  const aerial = aerialImageSet(lat, lng);
  const street = (p.images ?? []).filter((u) => !u.startsWith("https://data.geopf.fr/"));
  p.images = [...street, ...aerial.images];
  p.thumb = street[0] ?? aerial.thumb;
  p.image_credit = street.length ? `© Mapillary contributors · ${aerial.credit}` : aerial.credit;
}

/** One-off street-level photos for newly created properties (needs MLY_TOKEN). */
export async function streetPhotos(properties: Property[], config: PipelineConfig): Promise<void> {
  if (!process.env.MLY_TOKEN || properties.length === 0) return;
  await mapPool(properties, config.concurrency, async (p) => {
    const imgs = await mapillaryImages(p.address.lat, p.address.lng, config);
    if (imgs.length) p.images = imgs;
  });
}
