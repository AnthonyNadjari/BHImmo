/** Tiny inline price sparkline (pure SVG, no dependencies). */

interface Props {
  values: number[];
  width?: number;
  height?: number;
}

export function Sparkline({ values, width = 88, height = 24 }: Props) {
  if (values.length < 2) {
    return <span className="spark-empty">—</span>;
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

  // Down overall → red, up → green, flat → grey.
  const trend = values[values.length - 1]! - values[0]!;
  const stroke = trend < 0 ? "#1a8a4a" : trend > 0 ? "#b03a3a" : "#888";

  return (
    <svg width={width} height={height} className="spark" aria-hidden="true">
      <polyline points={points} fill="none" stroke={stroke} strokeWidth={1.5} />
    </svg>
  );
}
