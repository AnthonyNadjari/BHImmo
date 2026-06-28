/**
 * Opportunity map (bonus). Spatial heatmap of active listings colored by
 * opportunity score, plus a quick top-opportunities list.
 */

import { Link } from "react-router-dom";
import { useAsync } from "../hooks/useAsync";
import { fetchIndex } from "../services/data";
import { OpportunityScatter } from "../components/OpportunityScatter";
import { districtLabel, formatEuro, scoreColor } from "../services/format";

export function MapPage() {
  const { loading, error, data } = useAsync(fetchIndex, []);

  if (loading) return <p className="state">Loading map…</p>;
  if (error) return <p className="state error">Failed to load: {error.message}</p>;

  const active = (data?.properties ?? []).filter((e) => e.status === "active");
  const top = [...active]
    .sort((a, b) => b.opportunity_score - a.opportunity_score)
    .slice(0, 8);

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Opportunity map</h1>
          <p className="muted">{active.length} active listings across Paris intra-muros</p>
        </div>
      </div>

      <div className="map-layout">
        <div className="card">
          <OpportunityScatter entries={active} />
        </div>
        <div className="card">
          <h2>Top opportunities</h2>
          <ol className="top-list">
            {top.map((e) => (
              <li key={e.id}>
                <Link to={`/property/${e.id}`}>{e.address}</Link>
                <span className="top-meta">
                  {districtLabel(e.district)} · {formatEuro(e.current_price)}
                </span>
                <span className="top-score" style={{ color: scoreColor(e.opportunity_score) }}>
                  {e.opportunity_score}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
