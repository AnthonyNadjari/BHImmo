/** Circular opportunity-score gauge (SVG donut), colored by the score ramp. */

import { scoreColor } from "../services/format";

export function ScoreRing({ score, size = 108 }: { score: number; size?: number }) {
  const stroke = 9;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.max(0, Math.min(100, score)) / 100);
  const color = scoreColor(score);
  const label =
    score >= 68 ? "Strong opportunity" : score >= 50 ? "Worth watching" : score >= 45 ? "Marginal" : "Overvalued";

  return (
    <div className="score-ring" style={{ width: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--score-track)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="score-ring-arc"
        />
      </svg>
      <div className="score-ring-center">
        <strong style={{ color }}>{score}</strong>
        <span>/ 100</span>
      </div>
      <div className="score-ring-label" style={{ color }}>{label}</div>
    </div>
  );
}
