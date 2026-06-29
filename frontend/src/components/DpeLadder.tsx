/**
 * DpeLadder — the classic French A→G energy/GHG staircase. Each grade is a
 * colored bar that grows longer toward G (worse); the property's grade is
 * highlighted and flagged with an arrow. Uses --dpe-a..--dpe-g tokens.
 */

const GRADES = ["A", "B", "C", "D", "E", "F", "G"] as const;
type Grade = (typeof GRADES)[number];

// Step widths recreate the recognizable DPE staircase (A short → G full).
const WIDTH: Record<Grade, string> = {
  A: "22%",
  B: "33%",
  C: "45%",
  D: "57%",
  E: "70%",
  F: "85%",
  G: "100%",
};

function dpeVar(g: Grade): string {
  return `var(--dpe-${g.toLowerCase()})`;
}

export function DpeLadder({
  energyClass,
  ghgClass,
}: {
  energyClass: string;
  ghgClass: string;
}) {
  return (
    <div className="nv-ladders">
      <Ladder caption="Energy (DPE)" unit="kWh/m²·yr" active={energyClass} />
      <Ladder caption="Climate (GHG)" unit="kg CO₂/m²·yr" active={ghgClass} />
    </div>
  );
}

function Ladder({ caption, unit, active }: { caption: string; unit: string; active: string }) {
  const norm = (active || "").toUpperCase();
  return (
    <div className="nv-ladder">
      <p className="nv-ladder-cap">
        <span>{caption}</span>
        <strong>{unit}</strong>
      </p>
      <div className="nv-ladder-rows" role="img" aria-label={`${caption}: class ${norm || "unknown"}`}>
        {GRADES.map((g) => {
          const isActive = g === norm;
          return (
            <div key={g} className={`nv-ladder-row ${isActive ? "is-active" : ""}`}>
              <span className="nv-ladder-grade">{g}</span>
              <div
                className="nv-ladder-bar"
                style={{ width: WIDTH[g], background: dpeVar(g) }}
              >
                {isActive ? g : ""}
              </div>
              {isActive && (
                <span className="nv-ladder-arrow" style={{ background: dpeVar(g) }}>
                  ◄ {g}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
