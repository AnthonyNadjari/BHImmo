/**
 * Dataset access layer. Fetches the static JSON artifacts produced by the
 * pipeline (served from `<base>/data/*.json`) and memoizes them so each file
 * is loaded at most once per session.
 */

import type { IndexFile, MarketFile, Property } from "../types";
import { hasStreetView, streetViewGallery, streetViewThumb } from "./facade";

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
const propertyCache = new Map<string, Promise<Property | undefined>>();

/**
 * Drop the memoized datasets and force the next fetch to bypass all caches,
 * so the "Refresh" control genuinely pulls the latest committed pipeline run.
 */
export function clearDataCache(): void {
  cacheBust = String(Date.now());
  indexPromise = null;
  marketPromise = null;
  propertyCache.clear();
}

export function fetchIndex(): Promise<IndexFile> {
  return (indexPromise ??= getJson<IndexFile>("index.json").then((f) => {
    if (hasStreetView()) {
      for (const p of f.properties) {
        const t = streetViewThumb(p.lat, p.lng);
        if (t) p.image = t;
      }
    }
    return f;
  }));
}

export function fetchMarket(): Promise<MarketFile> {
  return (marketPromise ??= getJson<MarketFile>("market.json"));
}

/**
 * Fetch a single property by id from its own file (`data/property/<id>.json`).
 * At scale this loads one small record instead of the whole dataset. Returns
 * undefined if the property doesn't exist (404).
 */
export function fetchProperty(id: string): Promise<Property | undefined> {
  let p = propertyCache.get(id);
  if (!p) {
    p = getJson<Property>(`property/${encodeURIComponent(id)}.json`)
      .then((prop) => {
        if (prop && hasStreetView()) {
          const g = streetViewGallery(prop.address.lat, prop.address.lng);
          if (g.length) {
            prop.images = g;
            prop.thumb = g[0]!;
          }
        }
        return prop;
      })
      .catch(() => undefined);
    propertyCache.set(id, p);
  }
  return p;
}

/** Resolve several properties by id (used by the watchlist). */
export async function fetchPropertiesByIds(ids: string[]): Promise<Property[]> {
  const all = await Promise.all(ids.map((id) => fetchProperty(id)));
  return all.filter((p): p is Property => p !== undefined);
}
