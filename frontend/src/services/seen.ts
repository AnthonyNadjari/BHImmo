/**
 * "New since last refresh" tracking.
 *
 * We remember (in localStorage) the set of listing ids the user had the last
 * time they refreshed, so on the next refresh we can tell them how many
 * listings are new. Static site, no server — this is a purely client-side diff
 * against the last acknowledged snapshot.
 */

const KEY = "bhi:seen-ids";

function snapshot(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set<string>();
  }
}

/** True once a snapshot has been stored (i.e. the user has visited before). */
export function hasSnapshot(): boolean {
  return snapshot().size > 0;
}

/** How many of `ids` weren't in the last acknowledged snapshot (0 if none). */
export function newSince(ids: string[]): number {
  const seen = snapshot();
  if (seen.size === 0) return 0;
  let n = 0;
  for (const id of ids) if (!seen.has(id)) n++;
  return n;
}

/** Acknowledge the current set as seen (the baseline for the next refresh). */
export function markSeen(ids: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}
