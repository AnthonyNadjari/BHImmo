/**
 * Gauge — a 270° SVG arc gauge (0–100) for scores like walkability and
 * transport. Colored by value on the cold ramp; serif number in the centre.
 * Pure SVG, no chart libs.
 */

function rampColor(v: number): string {
  if (v >= 75) return "var(--success)"; // teal/green — excellent
  if (v >= 55) return "var(--primary)"; // azure/indigo — good
  if (v >= 35) return "var(--warn)"; // amber — fair
  return "var(--danger)"; // rose — poor
}

function ratingText(v: number): string {
  if (v >= 75) return "Excellent";
  if (v >= 55) return "Good";
  if (v >= 35) return "Fair";
  return "Limited";
}

/** Point on a circle (degrees, 0° = 12 o'clock, clockwise). */
function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** SVG arc path between two angles (degrees). */
function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const s = polar(cx, cy, r, endDeg);
  const e = polar(cx, cy, r, startDeg);
  const large = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 0 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

export function Gauge({
  value,
  label,
  size = 116,
  suffix = "/100",
}: {
  value: number;
  label: string;
  size?: number;
  suffix?: string;
}) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const stroke = 9;
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - stroke) / 2 - 2;
  const sweep = 270; // 270° arc, opening at the bottom
  const start = -135; // start angle (relative to 12 o'clock)
  const end = start + sweep;
  const valEnd = start + (sweep * v) / 100;
  const color = rampColor(v);

  return (
    <div className="nv-gauge">
      <svg
        className="nv-gauge-svg"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`${label}: ${v} out of 100`}
      >
        <path
          className="nv-gauge-track"
          d={arcPath(cx, cy, r, start, end)}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {v > 0 && (
          <path
            className="nv-gauge-arc"
            d={arcPath(cx, cy, r, start, valEnd)}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
          />
        )}
        <text
          x={cx}
          y={cy + 2}
          textAnchor="middle"
          dominantBaseline="middle"
          className="nv-gauge-num"
          fill={color}
        >
          {v}
        </text>
        <text
          x={cx}
          y={cy + 20}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--faint)"
          style={{ fontFamily: "var(--mono)", fontSize: 9 }}
        >
          {suffix}
        </text>
      </svg>
      <span className="nv-gauge-label">{label}</span>
      <span className="nv-gauge-tag" style={{ color }}>
        {ratingText(v)}
      </span>
    </div>
  );
}
