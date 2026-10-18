/** Tiny inline sparkline of a lot's DVF sale prices (pure SVG). */

interface Props {
  values: number[];
  width?: number;
  height?: number;
}

export function Sparkline({ values, width = 88, height = 24 }: Props) {
  if (values.length < 2) {
    return <span className="spark-empty" aria-label="no earlier sale of this lot in DVF">—</span>;
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

  // Price between successive DVF sales of the same lot: appreciation → green,
  // loss → red, flat → grey (same convention as the Market page's trend).
  const first = values[0]!;
  const last = values[values.length - 1]!;
  const trend = last - first;
  const stroke = trend > 0 ? "#0e9488" : trend < 0 ? "#e11d48" : "#64748b";
  const pct = first ? ((last - first) / first) * 100 : 0;

  return (
    <svg
      width={width}
      height={height}
      className="spark"
      role="img"
      aria-label={`${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% between DVF sales of this lot`}
    >
      <polyline points={points} fill="none" stroke={stroke} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
