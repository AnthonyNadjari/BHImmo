/** 6-axis radar/spider chart (pure SVG) — the property's profile at a glance. */

export interface RadarAxis {
  label: string;
  value: number; // 0–100
}

export function RadarChart({ axes, size = 240 }: { axes: RadarAxis[]; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 34;
  const n = axes.length;

  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const point = (i: number, radius: number) => ({
    x: cx + Math.cos(angle(i)) * radius,
    y: cy + Math.sin(angle(i)) * radius,
  });

  const rings = [0.25, 0.5, 0.75, 1];
  const polygon = axes
    .map((a, i) => {
      const p = point(i, (Math.max(0, Math.min(100, a.value)) / 100) * r);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="radar" role="img" aria-label="Property profile">
      {/* grid rings */}
      {rings.map((ring, ri) => (
        <polygon
          key={ri}
          className="radar-ring"
          points={axes
            .map((_, i) => {
              const p = point(i, ring * r);
              return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
            })
            .join(" ")}
        />
      ))}
      {/* spokes + labels */}
      {axes.map((a, i) => {
        const edge = point(i, r);
        const lbl = point(i, r + 16);
        const anchor = Math.abs(lbl.x - cx) < 6 ? "middle" : lbl.x > cx ? "start" : "end";
        return (
          <g key={i}>
            <line className="radar-spoke" x1={cx} y1={cy} x2={edge.x} y2={edge.y} />
            <text className="radar-label" x={lbl.x} y={lbl.y + 3} textAnchor={anchor as "middle" | "start" | "end"}>
              {a.label}
            </text>
          </g>
        );
      })}
      {/* value polygon */}
      <polygon className="radar-area" points={polygon} />
      {axes.map((a, i) => {
        const p = point(i, (Math.max(0, Math.min(100, a.value)) / 100) * r);
        return <circle key={i} className="radar-dot" cx={p.x} cy={p.y} r={2.6} />;
      })}
    </svg>
  );
}
