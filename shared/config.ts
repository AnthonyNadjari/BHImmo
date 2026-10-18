/**
 * Central configuration: API endpoints, run parameters and resilient fetch
 * helpers.
 *
 * Every source is free, key-less French open data. The pipeline never invents
 * a value: when a call fails, helpers resolve to `null` and the caller leaves
 * the field empty (or keeps the value from the previous run). Only the DVF
 * transaction files are mandatory — without them the run aborts and the last
 * committed dataset stays in place.
 */

import { log } from "./logger.ts";

export interface PipelineConfig {
  /** Universe = every sale in the last N days of DVF coverage… */
  universeDays: number;
  /** …topped up to at least this many sales per arrondissement. */
  minPerArrondissement: number;
  /** Max properties getting per-address lookups in one run (bounds CI time). */
  maxLookups: number;
  /** Number of DVF vintages to load (comparables, resale history, trend). */
  dvfYears: number;
  /** Per-request network timeout in milliseconds. */
  requestTimeoutMs: number;
  /** Parallel per-address lookups (BAN / ADEME / Géorisques). */
  concurrency: number;
  now: Date;
}

export function loadConfig(): PipelineConfig {
  return {
    universeDays: Number(process.env.PRER_UNIVERSE_DAYS ?? 92),
    minPerArrondissement: Number(process.env.PRER_MIN_PER_ARR ?? 100),
    maxLookups: Number(process.env.PRER_MAX_LOOKUPS ?? 4000),
    dvfYears: Number(process.env.PRER_DVF_YEARS ?? 5),
    requestTimeoutMs: Number(process.env.PRER_TIMEOUT_MS ?? 20_000),
    concurrency: Number(process.env.PRER_CONCURRENCY ?? 6),
    now: new Date(),
  };
}

const ODS_PARIS = "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets";

/** Public, key-less open-data endpoints. */
export const ENDPOINTS = {
  /** Etalab geo-DVF flat files (one folder per vintage). */
  dvf: "https://files.data.gouv.fr/geo-dvf/latest/csv",
  /** Géoplateforme geocoder (BAN), with the legacy BAN API as a fallback. */
  geocoder: ["https://data.geopf.fr/geocodage/search", "https://api-adresse.data.gouv.fr/search/"],
  /** Géorisques — flood zoning (TRI). */
  georisquesTri: "https://georisques.gouv.fr/api/v1/tri_zonage",
  /** ADEME — DPE of existing dwellings (since July 2021). */
  ademeDpe: "https://data.ademe.fr/data-fair/api/v1/datasets/dpe03existant/lines",
  /** IGN Géoplateforme WMS (aerial photography). */
  ignWms: "https://data.geopf.fr/wms-r",
  /** OpenStreetMap Overpass mirrors, tried in order. */
  overpass: [
    "https://overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ],
  /** INSEE Melodi (populations, FiLoSoFi). */
  melodi: "https://api.insee.fr/melodi/data",
  idfmStations:
    "https://data.iledefrance-mobilites.fr/api/explore/v2.1/catalog/datasets/emplacement-des-gares-idf/exports/json",
  schools:
    "https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-annuaire-education/exports/json",
  velib: `${ODS_PARIS}/velib-emplacement-des-stations/exports/json`,
  parks: `${ODS_PARIS}/espaces_verts/exports/json`,
  trees: `${ODS_PARIS}/les-arbres/exports/csv`,
  rentControl: `${ODS_PARIS}/logement-encadrement-des-loyers`,
  arrondissements: `${ODS_PARIS}/arrondissements/exports/json`,
  roadNoise: `${ODS_PARIS}/bruit-exposition-des-parisien-ne-s-aux-depassements-des-seuils-nocturne-ou-journ/exports/json`,
} as const;

export const DATA_DIR = "data";
export const FILES = {
  /** Full records, one shard per arrondissement: properties/75011.json. */
  propertiesDir: "properties",
  /** Pre-sharding single file (read once for migration, then removed). */
  legacyProperties: "properties.json",
  index: "index.json",
  market: "market.json",
  quartiers: "quartiers.geojson",
} as const;

const USER_AGENT = "BHImmo/2.0 (+https://github.com/AnthonyNadjari/BHImmo; open-data)";

interface FetchOptions extends RequestInit {
  /** Attempts before giving up (transient errors & 429/5xx are retried). */
  retries?: number;
  /** Override the configured timeout. */
  timeoutMs?: number;
}

/**
 * `fetch` with timeout + retries. Resolves to the Response on 2xx, or `null`
 * after the last failed attempt (never throws).
 */
async function fetchWithRetry(
  url: string,
  config: PipelineConfig,
  opts: FetchOptions = {},
): Promise<Response | null> {
  const { retries = 3, timeoutMs = config.requestTimeoutMs, ...init } = opts;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: { "User-Agent": USER_AGENT, ...(init.headers ?? {}) },
      });
      if (res.ok) return res;
      // 4xx other than 429 won't get better by retrying.
      if (res.status !== 429 && res.status < 500) {
        log.warn(`HTTP ${res.status} for ${shorten(url)}`);
        return null;
      }
      if (attempt === retries) log.warn(`HTTP ${res.status} for ${shorten(url)}`);
    } catch (err) {
      if (attempt === retries) log.warn(`Request failed (${shorten(url)}): ${(err as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
    await sleep(400 * 2 ** (attempt - 1));
  }
  return null;
}

/** GET JSON, `null` on any failure. An empty 2xx body resolves to `{}`. */
export async function fetchJson<T = unknown>(
  url: string,
  config: PipelineConfig,
  opts?: FetchOptions,
): Promise<T | null> {
  const res = await fetchWithRetry(url, config, { ...opts, headers: { Accept: "application/json", ...(opts?.headers ?? {}) } });
  if (!res) return null;
  try {
    const text = await res.text();
    return (text.trim() ? JSON.parse(text) : {}) as T;
  } catch (err) {
    log.warn(`Invalid JSON from ${shorten(url)}: ${(err as Error).message}`);
    return null;
  }
}

export async function fetchText(url: string, config: PipelineConfig, opts?: FetchOptions): Promise<string | null> {
  const res = await fetchWithRetry(url, config, opts);
  if (!res) return null;
  try {
    return await res.text();
  } catch {
    return null;
  }
}

export async function fetchBuffer(url: string, config: PipelineConfig, opts?: FetchOptions): Promise<Buffer | null> {
  const res = await fetchWithRetry(url, config, opts);
  if (!res) return null;
  try {
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/** Run `fn` over `items` with at most `limit` promises in flight. */
export async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!, i);
    }
  });
  await Promise.all(workers);
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function shorten(url: string): string {
  return url.length > 90 ? `${url.slice(0, 87)}…` : url;
}
