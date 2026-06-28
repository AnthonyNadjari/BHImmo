/**
 * €/m² distribution of the listing's arrondissement, with the listing and the
 * DVF reference marked — shows at a glance how cheap (or not) it is.
 */

import { useMemo } from "react";
import { useAsync } from "../hooks/useAsync";
import { fetchIndex } from "../services/data";
import { districtLabel, formatNumber } from "../services/format";

interface Props {
  district: string;
  value: number; // listing €/m²
  dvfRef: number;
  percentile: number; // 0 = cheapest
}

export function PriceDistribution({ district, value, dvfRef, percentile }: Props) {
  const { data } = useAsync(fetchIndex, []);

  const peers = useMemo(
    () => (data?.properties ?? []).filter((e) => e.district === district).map((e) => e.price_per_m2),
    [data, district],
  );

  if (peers.length < 4) return null;

  const width = 520;
  const height = 120;
  const pad = { l: 8, r: 8, t: 8, b: 20 };
  const min = Math.min(...peers, value, dvfRef);
  const max = Math.max(...peers, value, dvfRef);
  const span = max - min || 1;
  const bins = 16;
  const counts = new Array(bins).fill(0);
  for (const p of peers) {
    const b = Math.min(bins - 1, Math.floor(((p - min) / span) * bins));
    counts[b]++;
  }
  const maxCount = Math.max(...counts, 1);
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const x = (v: number) => pad.l + ((v - min) / span) * innerW;
  const barW = innerW / bins;

  const cheaperThan = Math.round(100 - percentile);

  return (
    <div className="distrib">
      <svg viewBox={`0 0 ${width} ${height}`} className="distrib-svg" role="img" aria-label="Price distribution">
        {counts.map((c, i) => {
          const h = (c / maxCount) * innerH;
          return (
            <rect
              key={i}
              className="distrib-bar"
              x={pad.l + i * barW + 1}
              y={pad.t + innerH - h}
              width={barW - 2}
              height={h}
            />
          );
        })}
        {/* DVF reference (dashed) */}
        <line className="distrib-dvf" x1={x(dvfRef)} x2={x(dvfRef)} y1={pad.t} y2={pad.t + innerH} />
        {/* this listing (solid) */}
        <line className="distrib-listing" x1={x(value)} x2={x(value)} y1={pad.t - 2} y2={pad.t + innerH} />
        <circle className="distrib-listing-dot" cx={x(value)} cy={pad.t - 2} r={3.5} />
        <text className="axis-label" x={pad.l} y={height - 6}>{formatNumber(min)}</text>
        <text className="axis-label" x={width - pad.r} y={height - 6} textAnchor="end">{formatNumber(max)} €/m²</text>
      </svg>
      <p className="distrib-caption">
        Cheaper than <strong>{cheaperThan}%</strong> of the {districtLabel(district)} ·
        <span className="distrib-key listing"> listing</span>
        <span className="distrib-key dvf"> DVF avg</span>
      </p>
    </div>
  );
}
