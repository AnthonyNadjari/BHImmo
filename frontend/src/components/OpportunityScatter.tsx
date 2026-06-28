/**
 * Dependency-free "opportunity heatmap": every active listing plotted by its
 * coordinates over the Paris bounding box, colored and sized by opportunity
 * score. Clicking a point opens the property. (Bonus feature — gives a spatial
 * read on where the opportunities cluster without loading a tile map.)
 */

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { IndexEntry } from "../types";
import { districtLabel, formatEuro, scoreColor } from "../services/format";

const BOUNDS = { latMin: 48.815, latMax: 48.905, lngMin: 2.25, lngMax: 2.418 };
const W = 720;
const H = 460;

const projX = (lng: number) => ((lng - BOUNDS.lngMin) / (BOUNDS.lngMax - BOUNDS.lngMin)) * W;
const projY = (lat: number) => ((BOUNDS.latMax - lat) / (BOUNDS.latMax - BOUNDS.latMin)) * H;

export function OpportunityScatter({ entries }: { entries: IndexEntry[] }) {
  const navigate = useNavigate();
  const [hover, setHover] = useState<IndexEntry | null>(null);

  // District centroids for light labelling.
  const labels = useMemo(() => {
    const groups = new Map<string, { lat: number; lng: number; n: number }>();
    for (const e of entries) {
      const g = groups.get(e.district) ?? { lat: 0, lng: 0, n: 0 };
      g.lat += e.lat;
      g.lng += e.lng;
      g.n += 1;
      groups.set(e.district, g);
    }
    return [...groups.entries()].map(([d, g]) => ({
      district: d,
      lat: g.lat / g.n,
      lng: g.lng / g.n,
    }));
  }, [entries]);

  // Plot best-scoring last so they render on top.
  const sorted = useMemo(
    () => [...entries].sort((a, b) => a.opportunity_score - b.opportunity_score),
    [entries],
  );

  return (
    <div className="scatter-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="scatter" role="img" aria-label="Opportunity map">
        <rect x={0} y={0} width={W} height={H} className="scatter-bg" />

        {labels.map((l) => (
          <text key={l.district} x={projX(l.lng)} y={projY(l.lat)} className="scatter-arr">
            {districtLabel(l.district)}
          </text>
        ))}

        {sorted.map((e) => {
          const r = 4 + (e.opportunity_score / 100) * 7;
          return (
            <circle
              key={e.id}
              cx={projX(e.lng)}
              cy={projY(e.lat)}
              r={r}
              fill={scoreColor(e.opportunity_score)}
              fillOpacity={0.78}
              stroke="#fff"
              strokeWidth={0.6}
              className="scatter-dot"
              onMouseEnter={() => setHover(e)}
              onMouseLeave={() => setHover(null)}
              onClick={() => navigate(`/property/${e.id}`)}
            />
          );
        })}
      </svg>

      {hover && (
        <div className="scatter-tooltip">
          <strong>Score {hover.opportunity_score}</strong>
          <span>{hover.address}</span>
          <span>
            {formatEuro(hover.current_price)} · {districtLabel(hover.district)}
          </span>
        </div>
      )}

      <div className="scatter-legend">
        <span><i style={{ background: scoreColor(80) }} /> Opportunity</span>
        <span><i style={{ background: scoreColor(55) }} /> Watch</span>
        <span><i style={{ background: scoreColor(30) }} /> Overvalued</span>
      </div>
    </div>
  );
}
