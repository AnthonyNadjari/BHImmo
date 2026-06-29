/**
 * Data-freshness indicator + manual refresh.
 *
 * Shows when the dataset was last generated (relative time) and the automated
 * cadence, with a button that drops the in-memory cache and re-fetches the
 * JSON. The pipeline runs in GitHub Actions every 6 hours; there is no live
 * server to "refresh", so this re-pulls the latest committed dataset and
 * reports how many listings are NEW since the user's last refresh.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./Icon";
import { clearDataCache } from "../services/data";
import { timeAgo } from "../services/format";
import { hasSnapshot, markSeen, newSince } from "../services/seen";

type Status = "idle" | "refreshing" | "done";

export function DataFreshness({
  generatedAt,
  currentIds,
}: {
  generatedAt?: string;
  /** Ids of the currently-loaded listings, for the "new since refresh" diff. */
  currentIds?: string[];
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [newCount, setNewCount] = useState(0);
  const timers = useRef<number[]>([]);
  const idsRef = useRef<string[]>([]);
  idsRef.current = currentIds ?? [];

  // How many are new vs the last acknowledged snapshot (shown until refresh).
  const standingNew = useMemo(() => newSince(currentIds ?? []), [currentIds]);

  // Arm the baseline on the very first visit so the next refresh is meaningful.
  useEffect(() => {
    if (currentIds && currentIds.length && !hasSnapshot()) markSeen(currentIds);
  }, [currentIds]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const refresh = () => {
    if (status === "refreshing") return;
    const fresh = newSince(idsRef.current);
    setNewCount(fresh);
    setStatus("refreshing");
    clearDataCache();
    window.dispatchEvent(new Event("prer:refresh"));
    timers.current.push(
      window.setTimeout(() => {
        setStatus("done");
        markSeen(idsRef.current); // acknowledge the now-current set
      }, 650),
      window.setTimeout(() => setStatus("idle"), 3200),
    );
  };

  const shownNew = status === "idle" ? standingNew : newCount;

  return (
    <div className="freshness" role="status" aria-live="polite">
      <span className="freshness-dot" aria-hidden="true" />
      <span className="freshness-text">
        {status === "done" ? (
          <strong className="freshness-ok">
            {newCount > 0 ? `✓ ${newCount} new since last refresh` : "✓ Up to date — no new listings"}
          </strong>
        ) : generatedAt ? (
          <>
            Updated <strong>{timeAgo(generatedAt)}</strong>
            {shownNew > 0 && <span className="freshness-new">{shownNew} new</span>}
          </>
        ) : (
          "Loading…"
        )}
        <span className="freshness-cadence"> · auto-refresh every 6 h</span>
      </span>
      <button
        type="button"
        className={`refresh-btn ${status === "refreshing" ? "spinning" : ""}`}
        onClick={refresh}
        aria-label="Refresh data"
        title="Re-fetch the latest dataset"
      >
        <Icon name="refresh" size={14} className="refresh-icon" />
        {status === "refreshing" ? "Refreshing…" : "Refresh"}
      </button>
    </div>
  );
}
