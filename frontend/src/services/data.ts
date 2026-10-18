/**
 * Dataset access layer. Fetches the static JSON artifacts produced by the
 * pipeline (served from `<base>/data/*.json`) and memoizes them so each file
 * is loaded at most once per session.
 */

import type { IndexFile, ListingsFile, MarketFile, Property } from "../types";

const BASE = import.meta.env.BASE_URL;

/**
 * Cache-busting token. Empty on first load (lets the browser/CDN cache
 * normally); set to a timestamp on manual refresh so the next fetch defeats
 * any CDN/browser caching and pulls the freshest committed dataset.
 */
let cacheBust = "";

async function getJson<T>(name: string): Promise<T> {
  const q = cacheBust ? `?v=${cacheBust}` : "";
  const res = await fetch(`${BASE}data/${name}${q}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${name} (HTTP ${res.status})`);
  return (await res.json()) as T;
}

let indexPromise: Promise<IndexFile> | null = null;
let marketPromise: Promise<MarketFile> | null = null;
let quartiersPromise: Promise<QuartierGeoJson> | null = null;
let listingsPromise: Promise<ListingsFile | null> | null = null;

/** Quartier polygons (official boundaries) for the price map. */
export interface QuartierGeoJson {
  type: "FeatureCollection";
  features: Array<{ type: "Feature"; properties: { id: string; name: string; district: string }; geometry: GeoJSON.Geometry }>;
}
const propertyCache = new Map<string, Promise<Property | undefined>>();

/**
 * Drop the memoized datasets and force the next fetch to bypass all caches,
 * so the "Refresh" control genuinely pulls the latest committed pipeline run.
 */
export function clearDataCache(): void {
  cacheBust = String(Date.now());
  indexPromise = null;
  marketPromise = null;
  quartiersPromise = null;
  listingsPromise = null;
  propertyCache.clear();
}

export function fetchIndex(): Promise<IndexFile> {
  return (indexPromise ??= getJson<IndexFile>("index.json"));
}

export function fetchMarket(): Promise<MarketFile> {
  return (marketPromise ??= getJson<MarketFile>("market.json"));
}

/**
 * Listings on the market (Stream.estate). Null when the pipeline has no API
 * key yet — the file simply doesn't exist then.
 */
export function fetchListings(): Promise<ListingsFile | null> {
  return (listingsPromise ??= getJson<ListingsFile>("listings.json").catch(() => null));
}

export function fetchQuartiers(): Promise<QuartierGeoJson> {
  return (quartiersPromise ??= getJson<QuartierGeoJson>("quartiers.geojson"));
}

/**
 * Fetch a single property by id from its own file (`data/property/<id>.json`).
 * At scale this loads one small record instead of the whole dataset. Returns
 * undefined if the property doesn't exist (404).
 */
export function fetchProperty(id: string): Promise<Property | undefined> {
  let p = propertyCache.get(id);
  if (!p) {
    p = getJson<Property>(`property/${encodeURIComponent(id)}.json`).catch(() => undefined);
    propertyCache.set(id, p);
  }
  return p;
}

/** Resolve several properties by id (used by the watchlist). */
export async function fetchPropertiesByIds(ids: string[]): Promise<Property[]> {
  const all = await Promise.all(ids.map((id) => fetchProperty(id)));
  return all.filter((p): p is Property => p !== undefined);
}
