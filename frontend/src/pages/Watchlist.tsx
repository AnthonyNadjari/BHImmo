/**
 * PAGE 3 — Watchlist.
 * Sales the user is tracking (localStorage), with deal-score and market-gap
 * alerts computed against the snapshot taken when each was added.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAsync } from "../hooks/useAsync";
import { fetchPropertiesByIds } from "../services/data";
import {
  computeAlerts,
  getWatchlist,
  removeFromWatchlist,
  type WatchMap,
} from "../services/watchlist";
import {
  districtLabel,
  formatDate,
  formatEuro,
  formatPerM2,
  scoreColor,
} from "../services/format";
import { Img, LocationPin } from "../components/Img";
import { thumbFor } from "../services/imagery";
import { ErrorState, Loading } from "../components/States";

export function Watchlist() {
  const [watch, setWatch] = useState<WatchMap>(() => getWatchlist());

  useEffect(() => {
    const sync = () => setWatch(getWatchlist());
    sync();
    window.addEventListener("prer:watchlist", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("prer:watchlist", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const ids = Object.keys(watch);
  // Load only the tracked properties (one small file each), refetching when the
  // set of watched ids changes.
  const { loading, error, data: properties, reload } = useAsync(
    () => fetchPropertiesByIds(ids),
    [ids.join(",")],
  );

  if (loading && !properties) return <Loading label="Loading watchlist…" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const rows = (properties ?? []).filter((p) => ids.includes(p.id));

  if (rows.length === 0) {
    return (
      <section>
        <h1>Watchlist</h1>
        <div className="state">
          <p>You aren't tracking any properties yet.</p>
          <p className="muted">
            Open a sale and hit <strong>☆ Add to watchlist</strong> to follow its score as new DVF data comes in.
          </p>
          <Link to="/sales" className="btn">
            Browse past sales
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Watchlist</h1>
          <p className="muted">{rows.length} tracked · alerts vs. the day you added them</p>
        </div>
      </div>

      <div className="watch-grid">
        {rows.map((p) => {
          const snap = watch[p.id]!;
          const alerts = computeAlerts(p, snap);
          return (
            <div className="card watch-card" key={p.id}>
              <Link to={`/property/${p.id}`} className="watch-thumb-link" aria-label={p.address.normalized}>
                <Img src={thumbFor(p.address)} alt="" className="watch-thumb" />
                <LocationPin src={thumbFor(p.address)} />
              </Link>
              <div className="watch-card-head">
                <Link to={`/property/${p.id}`} className="watch-title">
                  {p.address.normalized}
                </Link>
                <button
                  className="icon-btn"
                  title="Remove from watchlist"
                  aria-label="Remove from watchlist"
                  onClick={() => removeFromWatchlist(p.id)}
                >
                  ✕
                </button>
              </div>
              <p className="muted">
                {districtLabel(p.address.district)} · {p.characteristics.surface_m2} m² ·{" "}
                <span className="status-pill sold">Sold {formatDate(p.sale.date)}</span>
              </p>

              <div className="watch-metrics">
                <div>
                  <span className="kv-label">Price</span>
                  <strong>{formatEuro(p.sale.price)}</strong>
                </div>
                <div>
                  <span className="kv-label">€/m²</span>
                  <strong>{formatPerM2(p.sale.price_per_m2)}</strong>
                </div>
                <div>
                  <span className="kv-label">Score</span>
                  <strong style={{ color: scoreColor(p.score.opportunity_score) }}>
                    {p.score.opportunity_score}
                  </strong>
                </div>
              </div>

              <div className="watch-alerts">
                {alerts.length === 0 ? (
                  <span className="alert calm">No change since {formatDate(snap.addedAt)}</span>
                ) : (
                  alerts.map((a, i) => (
                    <span key={i} className={`alert ${a.kind}`}>
                      {a.kind === "score-down" ? "↓ " : a.kind === "score-up" ? "↑ " : "● "}
                      {a.message}
                    </span>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
