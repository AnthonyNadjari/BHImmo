/**
 * Neighbourhood & lifestyle card: walkability score, nearby amenities
 * (visual bars) and median household income.
 */

import { ScoreGauge } from "./ScoreBar";
import { AmenityBar } from "./AmenityBar";
import { formatIncome } from "../services/format";
import type { Property } from "../types";

export function NeighborhoodCard({ hood }: { hood: Property["neighborhood"] }) {
  if (!hood) return null;
  const a = hood.amenities;
  const rows = [
    { icon: "bag", label: "Shops", value: a.food, max: 30 },
    { icon: "pulse", label: "Health", value: a.health, max: 12 },
    { icon: "ticket", label: "Culture", value: a.culture, max: 10 },
    { icon: "school", label: "Schools", value: hood.schools_500m, max: 12 },
    { icon: "bike", label: "Vélib'", value: hood.velib_400m, max: 8 },
    { icon: "tree", label: "Trees", value: hood.trees_150m, max: 120 },
  ] as const;

  return (
    <>
      <ScoreGauge label="Walkability" score={hood.walk_score} />
      <div className="amenity-list">
        {rows.map((r) => (
          <AmenityBar key={r.label} icon={r.icon} label={r.label} value={r.value} max={r.max} />
        ))}
      </div>
      <div className="hood-income">
        <span className="kv-label">Median income (area)</span>
        <strong>{formatIncome(hood.income)}/yr</strong>
      </div>
      <p className="muted xsmall">Within ~500 m · OSM · data.education · INSEE · opendata.paris</p>
    </>
  );
}
