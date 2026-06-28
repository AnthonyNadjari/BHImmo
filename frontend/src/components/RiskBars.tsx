/** Risk exposure bars (flood / clay / noise), each on a 0–1 scale. */

interface Risk {
  label: string;
  value: number;
  hint: string;
}

function level(v: number): { text: string; color: string } {
  if (v >= 0.66) return { text: "High", color: "#e11d48" };
  if (v >= 0.4) return { text: "Moderate", color: "#4f46e5" };
  if (v >= 0.2) return { text: "Low", color: "#2563eb" };
  return { text: "Very low", color: "#0e9488" };
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
