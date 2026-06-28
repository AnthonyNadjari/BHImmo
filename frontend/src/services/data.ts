/**
 * Dataset access layer. Fetches the static JSON artifacts produced by the
 * pipeline (served from `<base>/data/*.json`) and memoizes them so each file
 * is loaded at most once per session.
 */

import type { IndexFile, MarketFile, Property } from "../types";

const BASE = import.meta.env.BASE_URL;

async function getJson<T>(name: string): Promise<T> {
  const res = await fetch(`${BASE}data/${name}`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Failed to load ${name} (HTTP ${res.status})`);
  return (await res.json()) as T;
}

let indexPromise: Promise<IndexFile> | null = null;
let marketPromise: Promise<MarketFile> | null = null;
let propertiesPromise: Promise<Property[]> | null = null;

/**
 * Drop the memoized datasets so the next fetch re-downloads fresh JSON.
 * Used by the "Refresh" control to pick up a newer pipeline run without a
 * full page reload.
 */
export function clearDataCache(): void {
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
