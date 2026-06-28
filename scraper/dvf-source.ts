/**
 * LIVE listing source — real Paris apartment transactions from DVF.
 *
 * DVF (Demandes de Valeurs Foncières) is the official open dataset of French
 * real-estate transactions published by the DGFiP / Etalab. We read the
 * geocoded flat files hosted on data.gouv.fr (free, key-less, stable URLs):
 *
 *   https://files.data.gouv.fr/geo-dvf/latest/csv/<year>/communes/75/<commune>.csv
 *
 * Each Paris arrondissement is a commune (75101…75120). We keep clean
 * single-apartment sales (real address, price, surface, rooms, coordinates and
 * mutation date) and expose them both as listings (the property universe) and
 * as comparable-sales context for the DVF enrichment step — all from the same
 * real data, so the whole pipeline runs on genuine transactions.
 *
 * No scraping of listing portals (which forbid it and block CI). When the files
 * are unavailable the caller falls back to the deterministic synthetic universe
 * so GitHub Actions always produces a valid dataset.
 */

import { haversineMeters, round } from "../shared/geo.ts";
import { SeededRandom } from "../shared/prng.ts";
import { ARRONDISSEMENT_BY_CODE } from "../shared/paris.ts";
import { log } from "../shared/logger.ts";
import type { PipelineConfig } from "../shared/config.ts";
import type { RawListing } from "./types.ts";

const GEO_DVF_BASE = "https://files.data.gouv.fr/geo-dvf/latest/csv";
/** Most recent complete DVF vintage (overridable for testing). */
const YEAR = process.env.PRER_DVF_YEAR ?? "2024";
/** How many recent transactions to surface per arrondissement. */
const PER_ARR = Number(process.env.PRER_DVF_PER_ARR ?? 25);

/** Paris arrondissement commune codes 75101 (1er) … 75120 (20e). */
const COMMUNES = Array.from({ length: 20 }, (_, i) => `751${String(i + 1).padStart(2, "0")}`);

export interface DvfTxn {
  /** id_mutation — stable across DVF vintages. */
  id: string;
  date: string;
  price: number;
  surface: number;
  rooms: number;
  lat: number;
  lng: number;
  /** Postal-style district code, e.g. "75004". */
  district: string;
  address: string;
  ppm2: number;
}

let CACHE: DvfTxn[] | null = null;

/** Resilient text fetch with timeout; null on failure or when DVF is disabled. */
async function fetchText(url: string, config: PipelineConfig): Promise<string | null> {
  // DVF is the real data backbone — load it regardless of run mode (so the
  // universe + comparables stay real even when secondary enrichment runs
  // offline/deterministically for scale). Opt out only with PRER_DVF=off.
  if (process.env.PRER_DVF === "off") return null;
  const controller = new AbortController();
  // CSV files are larger than JSON endpoints — allow more time.
  const timer = setTimeout(() => controller.abort(), Math.max(config.requestTimeoutMs, 20_000));
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "BHImmo/1.0 (+open-data)" },
    });
    if (!res.ok) {
      log.warn(`HTTP ${res.status} for DVF ${url.slice(-28)}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    if (config.mode === "live") log.warn(`DVF fetch failed (${url.slice(-28)}): ${(err as Error).message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Title-case an upper-cased DVF street name ("BD DU PALAIS" → "Bd Du Palais"). */
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\p{L}/gu, (c) => c.toUpperCase())
    .trim();
}

/** Parse one commune CSV into clean single-apartment transactions. */
function parseCommuneCsv(csv: string, district: string): DvfTxn[] {
  const lines = csv.split("\n");
  if (lines.length < 2) return [];
  const header = lines[0]!.split(",");
  const col = (name: string) => header.indexOf(name);
  const I = {
    id: col("id_mutation"), date: col("date_mutation"), nature: col("nature_mutation"),
    price: col("valeur_fonciere"), num: col("adresse_numero"), suf: col("adresse_suffixe"),
    voie: col("adresse_nom_voie"), cp: col("code_postal"), type: col("type_local"),
    surf: col("surface_reelle_bati"), rooms: col("nombre_pieces_principales"),
    lon: col("longitude"), lat: col("latitude"),
  };
  if (I.id < 0 || I.price < 0 || I.type < 0) return [];

  // Group rows by mutation: a sale can span several lots/locals.
  const groups = new Map<string, string[][]>();
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i]!.split(",");
    if (row.length < header.length) continue;
    const mid = row[I.id]!;
    (groups.get(mid) ?? groups.set(mid, []).get(mid)!).push(row);
  }

  const txns: DvfTxn[] = [];
  for (const [mid, rows] of groups) {
    const apts = rows.filter((r) => r[I.type] === "Appartement" && r[I.nature] === "Vente");
    const dwellings = rows.filter((r) => r[I.type] === "Appartement" || r[I.type] === "Maison");
    // Keep only a single, unambiguous apartment sale (price maps to one home).
    if (apts.length !== 1 || dwellings.length !== 1) continue;

    const r = apts[0]!;
    const price = Number(r[I.price]);
    const surface = Number(r[I.surf]);
    const lat = Number(r[I.lat]);
    const lng = Number(r[I.lon]);
    if (!Number.isFinite(price) || price <= 0) continue;
    if (!Number.isFinite(surface) || surface < 9) continue;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const ppm2 = price / surface;
    if (ppm2 < 2000 || ppm2 > 40000) continue; // drop obvious data errors
    // Drop atypical sales (viager / nue-propriété / mispriced lots) that trade
    // far from the arrondissement reference and would fake huge "discounts".
    const ref = ARRONDISSEMENT_BY_CODE.get(district)?.refPriceM2 ?? 10500;
    if (ppm2 < 0.6 * ref || ppm2 > 2.2 * ref) continue;

    const rooms = Math.max(1, Math.round(Number(r[I.rooms])) || 1);
    const num = (r[I.num] ?? "").trim();
    const suf = (r[I.suf] ?? "").trim();
    const voie = titleCase(r[I.voie] ?? "");
    const cp = (r[I.cp] ?? "").trim() || district;
    const street = `${num}${suf ? " " + suf : ""} ${voie}`.replace(/\s+/g, " ").trim();
    const address = `${street}, ${cp} Paris`;

    txns.push({
      id: mid,
      date: (r[I.date] ?? "").slice(0, 10),
      price: round(price),
      surface: round(surface, 1),
      rooms,
      lat: round(lat, 6),
      lng: round(lng, 6),
      district,
      address,
      ppm2: round(ppm2),
    });
  }
  return txns;
}

/** Load (and cache) all real Paris apartment transactions for the vintage. */
export async function loadParisDvf(config: PipelineConfig): Promise<DvfTxn[]> {
  if (CACHE) return CACHE;
  if (process.env.PRER_DVF === "off") {
    CACHE = [];
    return CACHE;
  }
  const all: DvfTxn[] = [];
  for (const commune of COMMUNES) {
    const district = `750${commune.slice(3)}`; // 75104 → 75004
    const csv = await fetchText(`${GEO_DVF_BASE}/${YEAR}/communes/75/${commune}.csv`, config);
    if (!csv) continue;
    all.push(...parseCommuneCsv(csv, district));
  }
  CACHE = all;
  log.info(`DVF: ${all.length} real apartment transactions loaded (Etalab geo-dvf ${YEAR})`);
  return all;
}

/**
 * The property universe: the `PER_ARR` most recent transactions per
 * arrondissement, as source-agnostic RawListings. Returns [] (→ synthetic
 * fallback) if the files could not be read.
 */
export async function liveDvfListings(config: PipelineConfig): Promise<RawListing[]> {
  const txns = await loadParisDvf(config);
  if (txns.length === 0) return [];

  const byDistrict = new Map<string, DvfTxn[]>();
  for (const t of txns) (byDistrict.get(t.district) ?? byDistrict.set(t.district, []).get(t.district)!).push(t);

  const out: RawListing[] = [];
  for (const [, list] of byDistrict) {
    list.sort((a, b) => b.date.localeCompare(a.date)); // most recent first
    for (const t of list.slice(0, PER_ARR)) {
      // DVF carries no floor; derive a stable plausible value for display only.
      const floor = new SeededRandom(`floor:${t.id}`).int(0, Math.min(7, Math.max(1, t.rooms + 2)));
      out.push({
        source: "dvf",
        externalId: t.id,
        rawAddress: t.address,
        district: t.district,
        surface_m2: t.surface,
        rooms: t.rooms,
        floor,
        price: t.price,
        observedDate: t.date,
        url: "https://app.dvf.etalab.gouv.fr/",
        fallbackLat: t.lat,
        fallbackLng: t.lng,
      });
    }
  }
  log.info(`DVF: selected ${out.length} listings (${PER_ARR}/arrondissement) from real transactions`);
  return out;
}

/**
 * Comparable apartment sales within `maxDist` m, from the loaded real data.
 * `excludeId` drops a transaction (e.g. the property's own sale) so it isn't
 * listed as its own comparable / biasing the local average.
 */
export function nearbyDvfComps(
  lat: number,
  lng: number,
  maxDist = 500,
  excludeId?: string,
): Array<{ price: number; date: string; distance_m: number; pricePerM2: number }> {
  if (!CACHE) return [];
  const out: Array<{ price: number; date: string; distance_m: number; pricePerM2: number }> = [];
  for (const t of CACHE) {
    if (excludeId && t.id === excludeId) continue;
    const d = haversineMeters(lat, lng, t.lat, t.lng);
    if (d <= maxDist) out.push({ price: t.price, date: t.date, distance_m: round(d), pricePerM2: t.ppm2 });
  }
  return out;
}
