/**
 * Dataset access layer. Fetches the static JSON artifacts produced by the
 * pipeline (served from `<base>/data/*.json`) and memoizes them so each file
 * is loaded at most once per session.
 */

import type { IndexFile, MarketFile, Property } from "../types";

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
let propertiesPromise: Promise<Property[]> | null = null;

/**
 * Drop the memoized datasets and force the next fetch to bypass all caches,
 * so the "Refresh" control genuinely pulls the latest committed pipeline run.
 */
export function clearDataCache(): void {
  cacheBust = String(Date.now());
  indexPromise = null;
  marketPromise = null;
  propertiesPromise = null;
}

export function fetchIndex(): Promise<IndexFile> {
  return (indexPromise ??= getJson<IndexFile>("index.json"));
}

export function fetchMarket(): Promise<MarketFile> {
  return (marketPromise ??= getJson<MarketFile>("market.json"));
}

export function fetchProperties(): Promise<Property[]> {
  return (propertiesPromise ??= getJson<{ properties: Property[] }>(
    "properties.json",
  ).then((f) => f.properties));
}

export async function fetchProperty(id: string): Promise<Property | undefined> {
  const all = await fetchProperties();
  return all.find((p) => p.id === id);
}
