/**
 * Data-freshness indicator + manual refresh.
 *
 * Shows when the dataset was last generated (relative time) and the automated
 * cadence, with a button that drops the in-memory cache and re-fetches the
 * JSON. The pipeline runs in GitHub Actions every 6 hours; there is no live
 * server to "refresh", so this re-pulls the latest committed dataset.
 */

import { useState } from "react";
import { clearDataCache } from "../services/data";
import { timeAgo } from "../services/format";

export function DataFreshness({ generatedAt }: { generatedAt?: string }) {
  const [spinning, setSpinning] = useState(false);

  const refresh = () => {
    setSpinning(true);
    clearDataCache();
    window.dispatchEvent(new Event("prer:refresh"));
    // Visual feedback; the actual reload is driven by useAsync re-running.
    window.setTimeout(() => setSpinning(false), 700);
  };

  return (
    <div className="freshness" role="status">
      <span className="freshness-dot" aria-hidden="true" />
      <span className="freshness-text">
        {generatedAt ? <>Updated <strong>{timeAgo(generatedAt)}</strong></> : "Loading…"}
        <span className="freshness-cadence"> · auto-refresh every 6 h</span>
      </span>
      <button
        type="button"
        className={`refresh-btn ${spinning ? "spinning" : ""}`}
        onClick={refresh}
        aria-label="Refresh data"
        title="Re-fetch the latest dataset"
      >
        <span className="refresh-icon" aria-hidden="true">↻</span>
        Refresh
      </button>
    </div>
  );
}
