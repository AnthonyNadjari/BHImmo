/** Price history line chart (pure SVG with hover tooltip). */

import { useState } from "react";
import type { PriceHistoryPoint } from "../types";
import { formatDate, formatEuro } from "../services/format";

interface Props {
  history: PriceHistoryPoint[];
  height?: number;
}

const PAD = { top: 16, right: 16, bottom: 28, left: 64 };

export function PriceChart({ history, height = 240 }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 720;

  if (history.length < 2) {
    return <p className="muted">Not enough history to plot a price curve.</p>;
  }

  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;

  const prices = history.map((h) => h.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;
  // Pad the value axis by 8% so the line never hugs the edges.
  const lo = min - span * 0.08;
  const hi = max + span * 0.08;
  const vSpan = hi - lo;

  const x = (i: number) => PAD.left + (i / (history.length - 1)) * innerW;
  const y = (price: number) => PAD.top + innerH - ((price - lo) / vSpan) * innerH;

  const linePath = history
    .map((h, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(h.price).toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L${x(history.length - 1).toFixed(1)} ${(PAD.top + innerH).toFixed(1)} L${x(0).toFixed(1)} ${(PAD.top + innerH).toFixed(1)} Z`;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => lo + t * vSpan);

  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="price-chart"
        role="img"
        aria-label="Price history"
        onMouseLeave={() => setHover(null)}
      >
        {/* horizontal gridlines + value axis labels */}
        {ticks.map((tv, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y(tv)}
              y2={y(tv)}
              className="grid-line"
            />
            <text x={PAD.left - 8} y={y(tv) + 4} className="axis-label" textAnchor="end">
              {Math.round(tv / 1000)}k
            </text>
          </g>
        ))}

        <path d={areaPath} className="chart-area" />
        <path d={linePath} className="chart-line" />

        {history.map((h, i) => (
          <circle key={i} cx={x(i)} cy={y(h.price)} r={hover === i ? 5 : 3} className="chart-dot" />
        ))}

        {/* x labels: first (left-aligned), middle, last (right-aligned) */}
        {[0, Math.floor((history.length - 1) / 2), history.length - 1].map((i) => (
          <text
            key={i}
            x={x(i)}
            y={height - 8}
            className="axis-label"
            textAnchor={i === 0 ? "start" : i === history.length - 1 ? "end" : "middle"}
          >
            {formatDate(history[i]!.date)}
          </text>
        ))}

        {/* hover hit-targets */}
        {history.map((_, i) => (
          <rect
            key={i}
            x={x(i) - innerW / history.length / 2}
            y={PAD.top}
            width={innerW / history.length}
            height={innerH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}

        {hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} className="hover-line" />
        )}
      </svg>

      {hover !== null && (
        <div className="chart-tooltip">
          <strong>{formatEuro(history[hover]!.price)}</strong>
          <span>{formatDate(history[hover]!.date)}</span>
        </div>
      )}
    </div>
  );
}
