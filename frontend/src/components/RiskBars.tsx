/** Risk exposure bars (flood / clay / noise), each on a 0–1 scale. */

interface Risk {
  label: string;
  value: number;
  hint: string;
}

function level(v: number): { text: string; color: string } {
  if (v >= 0.66) return { text: "High", color: "#b03a3a" };
  if (v >= 0.4) return { text: "Moderate", color: "#c2741c" };
  if (v >= 0.2) return { text: "Low", color: "#b8860b" };
  return { text: "Very low", color: "#1a8a4a" };
}

export function RiskBars({
  flood,
  clay,
  noise,
}: {
  flood: number;
  clay: number;
  noise: number;
}) {
  const risks: Risk[] = [
    { label: "Flood", value: flood, hint: "Proximity to the Seine flood zone (PPRI proxy)" },
    { label: "Clay (RGA)", value: clay, hint: "Clay shrink–swell exposure (Géorisques)" },
    { label: "Noise", value: noise, hint: "Transit/traffic proximity proxy" },
  ];

  return (
    <div className="risk-bars">
      {risks.map((r) => {
        const l = level(r.value);
        return (
          <div className="risk-row" key={r.label} title={r.hint}>
            <span className="risk-label">{r.label}</span>
            <div className="score-bar-track">
              <div
                className="score-bar-fill"
                style={{ width: `${Math.round(r.value * 100)}%`, background: l.color }}
              />
            </div>
            <span className="risk-level" style={{ color: l.color }}>
              {l.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}
