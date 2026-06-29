/**
 * NeighborhoodViz — the visual "Neighbourhood & data" section for the property
 * detail page. Turns raw open-data numbers (walk/transport scores, DPE, amenity
 * counts, schools/vélib/trees/income, flood/clay/noise risks) into charts,
 * gauges, ladders, icon bars and severity meters. Pure SVG/CSS, no chart libs.
 */

import "../dataviz.css";
import { Gauge } from "./Gauge";
import { DpeLadder } from "./DpeLadder";
import { formatIncome } from "../services/format";
import type { Property } from "../types";

/* ---- Small inline icons (self-contained, Lucide-style) ------------------ */
type IcoProps = { size?: number };
const ico = (children: JSX.Element, size = 16) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);
const WalkIcon = ({ size }: IcoProps) =>
  ico(
    <>
      <circle cx="13" cy="4" r="1.6" />
      <path d="M11 21l1.5-5-2.5-2 1-5 3 2 2 1" />
      <path d="M8 13l2-2" />
      <path d="M14.5 16.5 17 21" />
    </>,
    size,
  );
const TransitIcon = ({ size }: IcoProps) =>
  ico(
    <>
      <rect x="5" y="3" width="14" height="14" rx="2.5" />
      <path d="M5 12h14" />
      <circle cx="8.5" cy="14.5" r="0.8" />
      <circle cx="15.5" cy="14.5" r="0.8" />
      <path d="M8 21l1.5-2M16 21l-1.5-2" />
    </>,
    size,
  );
const BoltIcon = ({ size }: IcoProps) => ico(<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />, size);
const SchoolIcon = ({ size }: IcoProps) =>
  ico(
    <>
      <path d="M22 10 12 5 2 10l10 5 10-5Z" />
      <path d="M6 12v5c0 1 2.5 2 6 2s6-1 6-2v-5" />
    </>,
    size,
  );
const BikeIcon = ({ size }: IcoProps) =>
  ico(
    <>
      <circle cx="5.5" cy="17.5" r="3.2" />
      <circle cx="18.5" cy="17.5" r="3.2" />
      <path d="M15 6h2l1.5 4.5M5.5 17.5 9 9h5l-3.5 8.5" />
    </>,
    size,
  );
const TreeIcon = ({ size }: IcoProps) =>
  ico(
    <>
      <path d="M12 2 6 11h12L12 2Z" />
      <path d="M8 11 4 17h16l-4-6" />
      <line x1="12" y1="17" x2="12" y2="22" />
    </>,
    size,
  );
const WalletIcon = ({ size }: IcoProps) =>
  ico(
    <>
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 10h18" />
      <circle cx="17" cy="14" r="1" />
    </>,
    size,
  );
const BagIcon = ({ size }: IcoProps) =>
  ico(
    <>
      <path d="M6 7h12l-1 13H7L6 7Z" />
      <path d="M9 7a3 3 0 0 1 6 0" />
    </>,
    size,
  );
const HealthIcon = ({ size }: IcoProps) =>
  ico(
    <>
      <path d="M19 14c1.5-1.6 3-3.4 3-5.5A4 4 0 0 0 12 6 4 4 0 0 0 2 8.5C2 12 6.5 16 12 20c2-1.4 3.8-2.8 5.2-4.2" />
      <path d="M9 11h2V9h2v2h2v2h-2v2h-2v-2H9Z" />
    </>,
    size,
  );
const GreenIcon = ({ size }: IcoProps) =>
  ico(
    <>
      <path d="M12 22c5-1 8-5 8-11V4c-7 0-11 3-11 9 0 3 1.5 6 3 9Z" />
      <path d="M12 22c0-5-1-9-3-12" />
    </>,
    size,
  );
const CultureIcon = ({ size }: IcoProps) =>
  ico(
    <>
      <path d="M3 9 12 4l9 5" />
      <path d="M5 9v8m4-8v8m6-8v8m4-8v8" />
      <path d="M3 21h18" />
    </>,
    size,
  );
const ShieldIcon = ({ size }: IcoProps) =>
  ico(<path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6l-7-3Z" />, size);
const PinIcon = ({ size }: IcoProps) =>
  ico(
    <>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </>,
    size,
  );

/* ---- Risk severity model ------------------------------------------------ */
function riskLevel(v: number): { text: string; color: string; cells: number } {
  // 5-cell severity meter; map 0–1 → number of lit cells.
  const cells = Math.max(1, Math.min(5, Math.round(v * 5)));
  if (v >= 0.66) return { text: "High", color: "var(--danger)", cells };
  if (v >= 0.4) return { text: "Moderate", color: "var(--warn)", cells };
  if (v >= 0.2) return { text: "Low", color: "var(--primary)", cells };
  return { text: "Very low", color: "var(--success)", cells };
}

/* ---- Amenity descriptor ------------------------------------------------- */
const AMENITIES = [
  { key: "food", label: "Food & shops", color: "#2563eb", Ico: BagIcon, max: 20 },
  { key: "health", label: "Health", color: "#0e9488", Ico: HealthIcon, max: 10 },
  { key: "green", label: "Green spaces", color: "#10b981", Ico: GreenIcon, max: 5 },
  { key: "culture", label: "Culture", color: "#6366f1", Ico: CultureIcon, max: 6 },
] as const;

export function NeighborhoodViz({ property: p }: { property: Property }) {
  const hood = p.neighborhood;
  const a = hood.amenities;

  const stats = [
    { label: "Schools", Ico: SchoolIcon, value: hood.schools_500m, max: 10, unit: "≤500 m", green: false },
    { label: "Vélib' docks", Ico: BikeIcon, value: hood.velib_400m, max: 8, unit: "≤400 m", green: false },
    { label: "Street trees", Ico: TreeIcon, value: hood.trees_150m, max: 120, unit: "≤150 m", green: true },
  ] as const;

  const risks = [
    { label: "Flood", value: p.risks.flood, hint: "Seine flood-zone proximity (PPRI proxy)" },
    { label: "Clay (RGA)", value: p.risks.clay, hint: "Clay shrink–swell exposure (Géorisques)" },
    { label: "Noise", value: p.risks.noise, hint: "Transit / traffic proximity proxy" },
  ];

  return (
    <section className="card nv-section" aria-labelledby="nv-heading">
      <h2 id="nv-heading">Neighbourhood &amp; data</h2>
      <p className="nv-section-sub">
        Open-data signals around {p.address.normalized} — walkability, transit, energy, amenities and
        environmental risk, visualised.
      </p>

      <div className="nv-grid">
        {/* 1. Walk + transport gauges */}
        <div className="nv-tile">
          <p className="nv-tile-title">
            <WalkIcon /> Getting around
          </p>
          <div className="nv-gauges">
            <Gauge value={hood.walk_score} label="Walkability" />
            <Gauge value={p.transport_score} label="Transit" />
          </div>
        </div>

        {/* 2. DPE / GHG ladder */}
        <div className="nv-tile nv-span-2">
          <p className="nv-tile-title">
            <BoltIcon /> Energy performance (DPE)
          </p>
          {p.dpe ? (
            <>
              <DpeLadder energyClass={p.dpe.energy_class} ghgClass={p.dpe.ghg_class} />
              {(p.dpe.energy_class === "F" || p.dpe.energy_class === "G") && (
                <p className={`dpe-note ${p.investment.value_add_flag ? "good" : ""}`} style={{ marginTop: 14 }}>
                  {p.investment.value_add_flag
                    ? "Value-add: the discount exceeds the renovation cost — reno-arbitrage."
                    : `Class ${p.dpe.energy_class} — rental restrictions apply (G banned since 2025, F from 2028).`}
                </p>
              )}
            </>
          ) : (
            <p className="muted xsmall">No DPE on file for this property.</p>
          )}
        </div>

        {/* 3. Amenities (icon-led bars) */}
        <div className="nv-tile">
          <p className="nv-tile-title">
            <PinIcon /> Amenities nearby
          </p>
          <div className="nv-amen">
            {AMENITIES.map(({ key, label, color, Ico, max }) => {
              const value = a[key];
              const lit = Math.max(0, Math.min(6, Math.round((value / max) * 6)));
              return (
                <div className="nv-amen-row" key={key}>
                  <span className="nv-amen-ico" style={{ background: color }}>
                    <Ico size={16} />
                  </span>
                  <div className="nv-amen-body">
                    <div className="nv-amen-top">
                      <span className="nv-amen-label">{label}</span>
                      <span className="nv-amen-count">{value}</span>
                    </div>
                    <div className="nv-amen-dots" aria-hidden="true">
                      {Array.from({ length: 6 }, (_, i) => (
                        <span
                          key={i}
                          className="nv-amen-dot"
                          style={i < lit ? { background: color } : undefined}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Neighbourhood stats (icon + scale) */}
        <div className="nv-tile">
          <p className="nv-tile-title">
            <TransitIcon /> Local fabric
          </p>
          <div className="nv-stats">
            {stats.map(({ label, Ico, value, max, unit, green }) => {
              const pct = Math.min(100, (value / max) * 100);
              return (
                <div className="nv-stat" key={label}>
                  <span className="nv-stat-ico">
                    <Ico size={16} />
                  </span>
                  <div className="nv-stat-body">
                    <div className="nv-stat-top">
                      <span className="nv-stat-label">{label}</span>
                      <span className="nv-stat-val">
                        {value} <span>{unit}</span>
                      </span>
                    </div>
                    <div className="nv-stat-track">
                      <div
                        className={`nv-stat-fill ${green ? "green" : ""}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="nv-stat">
              <span className="nv-stat-ico">
                <WalletIcon size={16} />
              </span>
              <div className="nv-stat-body">
                <div className="nv-stat-top">
                  <span className="nv-stat-label">Median income</span>
                  <span className="nv-stat-val">
                    {formatIncome(hood.income)} <span>/yr</span>
                  </span>
                </div>
                <div className="nv-stat-track">
                  <div
                    className="nv-stat-fill"
                    style={{ width: `${Math.min(100, (hood.income / 60000) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 5. Risk exposure (severity meters) */}
        <div className="nv-tile">
          <p className="nv-tile-title">
            <ShieldIcon /> Environmental risk
          </p>
          <div className="nv-risks">
            {risks.map((r) => {
              const lvl = riskLevel(r.value);
              return (
                <div className="nv-risk" key={r.label} title={r.hint}>
                  <div className="nv-risk-top">
                    <span className="nv-risk-label">{r.label}</span>
                    <span
                      className="nv-risk-level"
                      style={{ color: "#fff", background: lvl.color }}
                    >
                      {lvl.text}
                    </span>
                  </div>
                  <div className="nv-risk-meter" aria-hidden="true">
                    {Array.from({ length: 5 }, (_, i) => (
                      <span
                        key={i}
                        className="nv-risk-cell"
                        style={i < lvl.cells ? { background: lvl.color } : undefined}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="nv-foot">
        Within ~500 m · OSM · data.education · INSEE · opendata.paris · Géorisques · ADEME DPE
      </p>
    </section>
  );
}
