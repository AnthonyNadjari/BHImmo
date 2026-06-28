/** Tiny inline price sparkline (pure SVG, no dependencies). */

interface Props {
  values: number[];
  width?: number;
  height?: number;
}

export function Sparkline({ values, width = 88, height = 24 }: Props) {
  if (values.length < 2) {
    return <span className="spark-empty" aria-label="no price history">—</span>;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = width / (values.length - 1);

  const points = values
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / span) * (height - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  // This listing's own price trajectory: a price DROP is good for a buyer →
  // green; a rise → red; flat → grey. (Distinct from the Market page's
  // area-level "Trend 1Y", which uses the conventional down=red.)
  const first = values[0]!;
  const last = values[values.length - 1]!;
  const trend = last - first;
  const stroke = trend < 0 ? "#0f7a4d" : trend > 0 ? "#c0392b" : "#8a92a6";
  const pct = first ? ((last - first) / first) * 100 : 0;

  return (
    <svg
      width={width}
      height={height}
      className="spark"
      role="img"
      aria-label={`price trend ${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% over tracked history`}
    >
      <polyline points={points} fill="none" stroke={stroke} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
