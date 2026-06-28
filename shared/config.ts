/**
 * Central configuration: runtime mode, API endpoints, and a resilient
 * `fetchJson` helper.
 *
 * Every external call is free / public (French open-data gov APIs). The
 * pipeline must never *require* the network: in `mock` mode no request is
 * made, and in `hybrid`/`live` mode any failure falls back to deterministic
 * synthetic data so GitHub Actions always produces a valid dataset.
 */

import { log } from "./logger.ts";

export type RunMode = "mock" | "hybrid" | "live";

export interface PipelineConfig {
  mode: RunMode;
  /** Number of brand-new synthetic listings to introduce per run. */
  newListingsPerRun: number;
  /** Target size of the active listing pool when seeding from scratch. */
  targetPoolSize: number;
  /** Per-request network timeout in milliseconds. */
  requestTimeoutMs: number;
  /** Logical "today" — overridable for deterministic seeding. */
  now: Date;
}

function parseMode(value: string | undefined): RunMode {
  if (value === "live" || value === "hybrid" || value === "mock") return value;
  return "hybrid";
}

export function loadConfig(): PipelineConfig {
  const now = process.env.PRER_NOW ? new Date(process.env.PRER_NOW) : new Date();
  return {
    mode: parseMode(process.env.PRER_MODE),
    newListingsPerRun: Number(process.env.PRER_NEW_LISTINGS ?? 6),
    targetPoolSize: Number(process.env.PRER_POOL_SIZE ?? 60),
    requestTimeoutMs: Number(process.env.PRER_TIMEOUT_MS ?? 8000),
    now,
  };
}

/** Public, key-less French open-data endpoints used for enrichment. */
export const ENDPOINTS = {
  /** Base Adresse Nationale — geocoding. */
  ban: "https://api-adresse.data.gouv.fr/search/",
  /** DVF (Demandes de Valeurs Foncières) geo API, community-hosted Etalab data. */
  dvf: "https://api.cquest.org/dvf",
  /** Géorisques — natural & technological risk exposure. */
  georisquesFlood: "https://www.georisques.gouv.fr/api/v1/gaspar/azi",
  georisquesClay: "https://www.georisques.gouv.fr/api/v1/rga",
  /** ADEME / DPE — energy performance certificates (existing dwellings). */
  ademeDpe:
    "https://data.ademe.fr/data-fair/api/v1/datasets/dpe-v2-logements-existants/lines",
  /** Overpass — OSM query endpoint, used to count nearby transit stops. */
  overpass: "https://overpass-api.de/api/interpreter",
} as const;

export const DATA_DIR = "data";
export const FILES = {
  properties: "properties.json",
  index: "index.json",
  market: "market.json",
} as const;

/**
 * `fetch` with a timeout that resolves to `null` on any error instead of
 * throwing. Callers treat `null` as "API unavailable → use fallback".
 */
export async function fetchJson<T = unknown>(
  url: string,
  config: PipelineConfig,
  init?: RequestInit,
): Promise<T | null> {
  if (config.mode === "mock") return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": "PRER/1.0 (+open-data)", ...(init?.headers ?? {}) },
    });
    if (!res.ok) {
      log.warn(`HTTP ${res.status} for ${shorten(url)}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    if (config.mode === "live") {
      log.warn(`Request failed (${shorten(url)}): ${(err as Error).message}`);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function shorten(url: string): string {
  return url.length > 80 ? `${url.slice(0, 77)}…` : url;
}
