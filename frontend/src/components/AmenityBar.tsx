/** Amenity row: icon + label + fill bar + count (replaces raw integers). */

import { Icon } from "./Icon";

type IconName = Parameters<typeof Icon>[0]["name"];

export function AmenityBar({
  icon,
  label,
  value,
  max,
}: {
  icon: IconName;
  label: string;
  value: number;
  max: number;
}) {
  const pct = Math.min(1, value / max) * 100;
  return (
    <div className="amenity-row">
      <Icon name={icon} size={15} className="amenity-row-icon" />
      <span className="amenity-row-label">{label}</span>
      <div className="amenity-row-track">
        <div className="amenity-row-fill" style={{ width: `${pct}%` }} />
      </div>
      <strong className="amenity-row-value">{value}</strong>
    </div>
  );
}
