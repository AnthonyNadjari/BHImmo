/**
 * Data-freshness indicator + manual refresh.
 *
 * Shows when the dataset was last generated (relative time) and the automated
 * cadence, with a button that drops the in-memory cache and re-fetches the
 * JSON. The pipeline runs in GitHub Actions every 6 hours; there is no live
 * server to "refresh", so this re-pulls the latest committed dataset and
 * confirms the result (it stays silent only while no data has loaded yet).
 */

import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { clearDataCache } from "../services/data";
import { timeAgo } from "../services/format";

type Status = "idle" | "refreshing" | "done";

export function DataFreshness({ generatedAt }: { generatedAt?: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const refresh = () => {
    if (status === "refreshing") return;
    setStatus("refreshing");
    clearDataCache();
    window.dispatchEvent(new Event("prer:refresh"));
    timers.current.push(
      window.setTimeout(() => setStatus("done"), 650),
      window.setTimeout(() => setStatus("idle"), 2600),
    );
  };

  return (
    <div className="freshness" role="status" aria-live="polite">
      <span className="freshness-dot" aria-hidden="true" />
      <span className="freshness-text">
        {status === "done" ? (
          <strong className="freshness-ok">✓ Up to date</strong>
        ) : generatedAt ? (
          <>Updated <strong>{timeAgo(generatedAt)}</strong></>
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
