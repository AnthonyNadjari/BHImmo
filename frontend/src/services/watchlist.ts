/**
 * Watchlist persistence (localStorage). For each tracked property we snapshot
 * the price and status at the moment it was added, so the Watchlist page can
 * surface "price dropped" / "status changed" alerts by diffing against the
 * current dataset. No backend, no auth — it lives entirely in the browser.
 */

import type { Property, PropertyStatus } from "../types";

const KEY = "prer.watchlist.v1";

export interface WatchSnapshot {
  addedAt: string;
  priceAtAdd: number;
  statusAtAdd: PropertyStatus;
}

export type WatchMap = Record<string, WatchSnapshot>;

function read(): WatchMap {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as WatchMap;
  } catch {
    return {};
  }
}

function write(map: WatchMap): void {
  localStorage.setItem(KEY, JSON.stringify(map));
  window.dispatchEvent(new Event("prer:watchlist"));
}

export function getWatchlist(): WatchMap {
  return read();
}

export function isWatched(id: string): boolean {
  return id in read();
}

export function watchCount(): number {
  return Object.keys(read()).length;
}

export function addToWatchlist(p: Property): void {
  const map = read();
  map[p.id] = {
    addedAt: new Date().toISOString(),
    priceAtAdd: p.pricing.current_price,
    statusAtAdd: p.status,
  };
  write(map);
}

export function removeFromWatchlist(id: string): void {
  const map = read();
  delete map[id];
  write(map);
}

export function toggleWatchlist(p: Property): boolean {
  const watched = isWatched(p.id);
  if (watched) removeFromWatchlist(p.id);
  else addToWatchlist(p);
  return !watched;
}

export type AlertKind = "price-drop" | "price-rise" | "status-change";

export interface WatchAlert {
  kind: AlertKind;
  message: string;
}

/** Compute alerts for a watched property vs. the snapshot taken when added. */
export function computeAlerts(
  p: Property,
  snap: WatchSnapshot,
): WatchAlert[] {
  const alerts: WatchAlert[] = [];

  if (p.pricing.current_price < snap.priceAtAdd) {
    const pct = ((snap.priceAtAdd - p.pricing.current_price) / snap.priceAtAdd) * 100;
    alerts.push({
      kind: "price-drop",
      message: `Price dropped ${pct.toFixed(1)}% since you added it`,
    });
  } else if (p.pricing.current_price > snap.priceAtAdd) {
    alerts.push({ kind: "price-rise", message: "Price increased since you added it" });
  }

  if (p.status !== snap.statusAtAdd) {
    alerts.push({
      kind: "status-change",
      message: `Status changed: ${snap.statusAtAdd} → ${p.status}`,
    });
  }

  return alerts;
}
