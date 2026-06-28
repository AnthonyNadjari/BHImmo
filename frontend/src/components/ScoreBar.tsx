/** Compact horizontal score bar (0–100) used in the dashboard table. */

import { scoreColor } from "../services/format";

interface Props {
  score: number;
  width?: number;
}

export function ScoreBar({ score, width = 132 }: Props) {
  const color = scoreColor(score);
  return (
    <div className="score-bar" style={{ width }}>
      <div className="score-bar-track">
        <div className="score-bar-fill" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="score-bar-value" style={{ color }}>
        {score}
      </span>
    </div>
  );
}

/** Larger labelled gauge for the detail page sub-scores. */
export function ScoreGauge({ label, score }: { label: string; score: number }) {
  const color = scoreColor(score);
  return (
    <div className="gauge">
      <div className="gauge-head">
        <span>{label}</span>
        <strong style={{ color }}>{score}</strong>
      </div>
      <div className="score-bar-track">
        <div className="score-bar-fill" style={{ width: `${score}%`, background: color }} />
      </div>
    </div>
  );
}
