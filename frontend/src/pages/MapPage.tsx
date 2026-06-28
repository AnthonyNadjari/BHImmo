/**
 * Opportunity map — interactive Leaflet map of active listings colored by deal
 * score, with a quick top-opportunities list.
 */

import { Suspense, lazy } from "react";
import { Link } from "react-router-dom";
import { useAsync } from "../hooks/useAsync";
import { fetchIndex } from "../services/data";
import { DataFreshness } from "../components/DataFreshness";
import { Img } from "../components/Img";
import { Empty, ErrorState, Loading } from "../components/States";
import { districtLabel, formatEuro, scoreColor } from "../services/format";

const PropertyMap = lazy(() => import("../components/PropertyMap"));

export function MapPage() {
  const { loading, error, data, reload } = useAsync(fetchIndex, []);

  if (loading && !data) return <Loading label="Loading map…" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const active = (data?.properties ?? []).filter((e) => e.status === "active");
  const top = [...active].sort((a, b) => b.opportunity_score - a.opportunity_score).slice(0, 8);

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Opportunity map</h1>
          <p className="muted">{active.length} active listings across Paris intra-muros</p>
        </div>
        <DataFreshness generatedAt={data?.generated_at} />
      </div>

      {active.length === 0 ? (
        <Empty>No active listings to map right now.</Empty>
      ) : (
        <div className="map-layout">
          <div className="card map-card">
            <Suspense fallback={<div className="map-loading">Loading map…</div>}>
              <PropertyMap entries={active} />
            </Suspense>
            <div className="scatter-legend">
              <span><i style={{ background: scoreColor(80) }} /> Opportunity</span>
              <span><i style={{ background: scoreColor(55) }} /> Watch</span>
              <span><i style={{ background: scoreColor(30) }} /> Overvalued</span>
            </div>
          </div>
          <div className="card">
            <h2>Top opportunities</h2>
            <ul className="top-list">
              {top.map((e) => (
                <li key={e.id}>
                  <Link to={`/property/${e.id}`} className="top-thumb-link" aria-label={e.address}>
                    <Img src={e.image} seed={e.id} alt="" className="top-thumb" />
                  </Link>
                  <div className="top-info">
                    <Link to={`/property/${e.id}`}>{e.address}</Link>
                    <span className="top-meta">
                      {districtLabel(e.district)} · {formatEuro(e.current_price)} · {e.net_yield.toFixed(1)}% net
                    </span>
                  </div>
                  <span className="top-score" style={{ color: scoreColor(e.opportunity_score) }}>
                    {e.opportunity_score}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
