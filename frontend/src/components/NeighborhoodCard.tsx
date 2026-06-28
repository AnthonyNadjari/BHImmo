/**
 * Neighbourhood & lifestyle card: walkability score, nearby amenities
 * (OSM / data.education / INSEE) and median household income.
 */

import { ScoreGauge } from "./ScoreBar";
import { formatIncome } from "../services/format";
import type { Property } from "../types";

export function NeighborhoodCard({ hood }: { hood: Property["neighborhood"] }) {
  if (!hood) return null;
  const a = hood.amenities;
  const items: Array<{ icon: string; label: string; value: number }> = [
    { icon: "🛒", label: "Shops", value: a.food },
    { icon: "⚕️", label: "Health", value: a.health },
    { icon: "🎭", label: "Culture", value: a.culture },
    { icon: "🎓", label: "Schools", value: hood.schools_500m },
    { icon: "🚲", label: "Vélib'", value: hood.velib_400m },
    { icon: "🌳", label: "Trees", value: hood.trees_150m },
  ];

  return (
    <>
      <ScoreGauge label="Walkability" score={hood.walk_score} />
      <div className="amenity-grid">
        {items.map((it) => (
          <div className="amenity" key={it.label}>
            <span className="amenity-icon" aria-hidden="true">{it.icon}</span>
            <strong>{it.value}</strong>
            <span className="amenity-label">{it.label}</span>
          </div>
        ))}
      </div>
      <div className="hood-income">
        <span className="kv-label">Median income (area)</span>
        <strong>{formatIncome(hood.income)}/yr</strong>
      </div>
      <p className="muted xsmall">Amenities within 500 m · OSM · data.education · INSEE</p>
    </>
  );
}
