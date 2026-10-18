/**
 * Quarterly price chart (pure SVG): up to three series of median €/m² on ONE
 * axis, a crosshair + tooltip on hover, a legend and direct end-labels (so
 * identity never relies on color alone), and an optional highlighted point
 * (e.g. this sale). Series colors are the validated categorical slots 1–3.
 */

import { useMemo, useState } from "react";
import "../dataviz.css";
import { formatNumber } from "../services/format";

export interface LineSeries {
  id: string;
  label: string;
  /** Categorical slot color (see dataviz.css: --series-1…3). */
  color: string;
  points: Array<{ q: string; median: number; n: number }>;
}

interface Props {
  series: LineSeries[];
  /** A single highlighted observation, e.g. this sale's €/m² in its quarter. */
  marker?: { q: string; value: number; label: string };
  height?: number;
  ariaLabel: string;
}

const PAD = { top: 14, right: 96, bottom: 26, left: 56 };
const WIDTH = 760;

/** "2025-Q4" → "T4 25". */
const qLabel = (q: string) => `T${q.slice(-1)} ${q.slice(2, 4)}`;

export function LineChart({ series, marker, height = 240, ariaLabel }: Props) {
  const [hover, setHover] = useState<number | null>(null);

  const quarters = useMemo(() => {
    const set = new Set<string>();
    for (const s of series) for (const p of s.points) set.add(p.q);
    if (marker) set.add(marker.q);
    return [...set].sort();
  }, [series, marker]);

  const values = series.flatMap((s) => s.points.map((p) => p.median)).concat(marker ? [marker.value] : []);
  if (quarters.length < 2 || values.length === 0) return <p className="muted">Not enough sales to draw a trend.</p>;

  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const lo = min - span * 0.08;
  const hi = max + span * 0.08;
  const x = (i: number) => PAD.left + (i / (quarters.length - 1)) * innerW;
  const y = (v: number) => PAD.top + innerH - ((v - lo) / (hi - lo)) * innerH;
  const qi = new Map(quarters.map((q, i) => [q, i]));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => lo + t * (hi - lo));
  const xTicks = quarters.map((q, i) => ({ q, i })).filter(({ q }) => q.endsWith("Q1") || quarters.length <= 8);

  // Direct labels at each series' last point, nudged apart vertically.
  const ends = series
    .filter((s) => s.points.length)
    .map((s) => {
      const last = s.points[s.points.length - 1]!;
      return { s, y: y(last.median), x: x(qi.get(last.q)!) };
    })
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i]!.y - ends[i - 1]!.y < 13) ends[i]!.y = ends[i - 1]!.y + 13;

  const hq = hover === null ? null : quarters[hover]!;

  return (
    <div className="chart-wrap linechart">
      <div className="linechart-legend" aria-hidden="true">
        {series.map((s) => (
          <span key={s.id}>
            <i style={{ background: s.color }} /> {s.label}
          </span>
        ))}
        {marker && (
          <span>
            <i className="linechart-marker-key" /> {marker.label}
          </span>
        )}
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        className="price-chart"
        role="img"
        aria-label={ariaLabel}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((tv, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(tv)} y2={y(tv)} className="grid-line" />
            <text x={PAD.left - 8} y={y(tv) + 4} className="axis-label" textAnchor="end">
              {formatNumber(Math.round(tv / 100) * 100)}
            </text>
          </g>
        ))}
        {xTicks.map(({ q, i }) => (
          <text key={q} x={x(i)} y={height - 6} className="axis-label" textAnchor="middle">
            {qLabel(q)}
          </text>
        ))}

        {series.map((s) => (
          <polyline
            key={s.id}
            points={s.points.map((p) => `${x(qi.get(p.q)!).toFixed(1)},${y(p.median).toFixed(1)}`).join(" ")}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {ends.map(({ s, x: ex, y: ey }) => (
          <text key={s.id} x={ex + 8} y={ey + 4} className="linechart-endlabel">
            {s.label}
          </text>
        ))}

        {marker && qi.has(marker.q) && (
          <circle cx={x(qi.get(marker.q)!)} cy={y(marker.value)} r={5.5} className="linechart-marker" />
        )}

        {hq !== null && hover !== null && (
          <>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} className="hover-line" />
            {series.map((s) => {
              const p = s.points.find((pt) => pt.q === hq);
              return p ? <circle key={s.id} cx={x(hover)} cy={y(p.median)} r={4} fill={s.color} className="linechart-dot" /> : null;
            })}
          </>
        )}

        {/* hover hit-targets, wider than the marks */}
        {quarters.map((q, i) => (
          <rect
            key={q}
            x={x(i) - innerW / quarters.length / 2}
            y={PAD.top}
            width={innerW / quarters.length}
            height={innerH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>

      {hq !== null && (
        <div className="chart-tooltip linechart-tooltip">
          <strong>{qLabel(hq)}</strong>
          {series.map((s) => {
            const p = s.points.find((pt) => pt.q === hq);
            return (
              <span key={s.id}>
                <i style={{ background: s.color }} /> {s.label}: {p ? `${formatNumber(p.median)} €/m² (${p.n} sales)` : "—"}
              </span>
            );
          })}
          {marker && marker.q === hq && (
            <span>
              <i className="linechart-marker-key" /> {marker.label}: {formatNumber(marker.value)} €/m²
            </span>
          )}
        </div>
      )}
    </div>
  );
}
