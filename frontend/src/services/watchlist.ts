/**
 * Watchlist persistence (localStorage). For each tracked sale we snapshot the
 * deal score and the local DVF reference at the moment it was added, so the
 * Watchlist page can surface what changed as new DVF releases and open data
 * come in (a sale price itself never changes). It lives entirely in the
 * browser — no backend, no auth.
 */

import type { Property } from "../types";

const KEY = "prer.watchlist.v2";

export interface WatchSnapshot {
  addedAt: string;
  scoreAtAdd: number;
  dvfGapAtAdd: number | null;
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
    scoreAtAdd: p.score.opportunity_score,
    dvfGapAtAdd: p.investment.dvf_gap_pct,
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

export type AlertKind = "score-up" | "score-down" | "market";

export interface WatchAlert {
  kind: AlertKind;
  message: string;
}

/** Compute alerts for a watched sale vs. the snapshot taken when added. */
export function computeAlerts(p: Property, snap: WatchSnapshot): WatchAlert[] {
  const alerts: WatchAlert[] = [];
  const delta = p.score.opportunity_score - snap.scoreAtAdd;
  if (delta !== 0) {
    alerts.push({
      kind: delta > 0 ? "score-up" : "score-down",
      message: `Deal score ${delta > 0 ? "+" : ""}${delta} since you added it`,
    });
  }
  const gap = p.investment.dvf_gap_pct;
  if (gap !== null && snap.dvfGapAtAdd !== null && Math.abs(gap - snap.dvfGapAtAdd) >= 1) {
    alerts.push({
      kind: "market",
      message: `Gap vs local DVF now ${gap > 0 ? `${gap}% below` : `${Math.abs(gap)}% above`} (was ${snap.dvfGapAtAdd}%)`,
    });
  }
  return alerts;
}
