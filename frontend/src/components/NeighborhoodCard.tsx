/**
 * Neighbourhood & lifestyle card: walkability score, nearby amenities
 * (OSM / data.education / INSEE) and median household income.
 */

import { ScoreGauge } from "./ScoreBar";
import { Icon } from "./Icon";
import { formatIncome } from "../services/format";
import type { Property } from "../types";

export function NeighborhoodCard({ hood }: { hood: Property["neighborhood"] }) {
  if (!hood) return null;
  const a = hood.amenities;
  const items = [
    { icon: "bag", label: "Shops", value: a.food },
    { icon: "pulse", label: "Health", value: a.health },
    { icon: "ticket", label: "Culture", value: a.culture },
    { icon: "school", label: "Schools", value: hood.schools_500m },
    { icon: "bike", label: "Vélib'", value: hood.velib_400m },
    { icon: "tree", label: "Trees", value: hood.trees_150m },
  ] as const;

  return (
    <>
      <ScoreGauge label="Walkability" score={hood.walk_score} />
      <div className="amenity-grid">
        {items.map((it) => (
          <div className="amenity" key={it.label}>
            <Icon name={it.icon} size={17} className="amenity-icon" />
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
