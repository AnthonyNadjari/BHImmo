/**
 * PAGE 3 — Watchlist.
 * Properties the user is tracking (localStorage), with price-drop and
 * status-change alerts computed against the snapshot taken when each was added.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAsync } from "../hooks/useAsync";
import { fetchProperties } from "../services/data";
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
  STATUS_LABEL,
} from "../services/format";
import { Img } from "../components/Img";
import { ErrorState, Loading } from "../components/States";

export function Watchlist() {
  const { loading, error, data: properties, reload } = useAsync(fetchProperties, []);
  const [watch, setWatch] = useState<WatchMap>({});

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

  if (loading) return <Loading label="Loading watchlist…" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const ids = Object.keys(watch);
  const rows = (properties ?? []).filter((p) => ids.includes(p.id));

  if (rows.length === 0) {
    return (
      <section>
        <h1>Watchlist</h1>
        <div className="state">
          <p>You aren't tracking any properties yet.</p>
          <p className="muted">
            Open a property and hit <strong>☆ Add to watchlist</strong> to follow its price.
          </p>
          <Link to="/" className="btn">
            Browse dashboard
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
                <Img src={p.thumb || p.images?.[0] || ""} seed={p.id} alt="" className="watch-thumb" />
              </Link>
              <div className="watch-card-head">
                <Link to={`/property/${p.id}`} className="watch-title">
                  {p.address.normalized}
                </Link>
                <button
                  className="icon-btn"
                  title="Remove"
                  onClick={() => removeFromWatchlist(p.id)}
                >
                  ✕
                </button>
              </div>
              <p className="muted">
                {districtLabel(p.address.district)} · {p.characteristics.surface_m2} m² ·{" "}
                <span className={`status-pill ${p.status}`}>{STATUS_LABEL[p.status]}</span>
              </p>

              <div className="watch-metrics">
                <div>
                  <span className="kv-label">Price</span>
                  <strong>{formatEuro(p.pricing.current_price)}</strong>
                </div>
                <div>
                  <span className="kv-label">€/m²</span>
                  <strong>{formatPerM2(p.pricing.price_per_m2)}</strong>
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
                      {a.kind === "price-drop" ? "↓ " : a.kind === "price-rise" ? "↑ " : "● "}
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
