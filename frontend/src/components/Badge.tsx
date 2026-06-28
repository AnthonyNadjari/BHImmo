/** Opportunity / watch / overvalued badge. */

import { BADGES } from "../services/format";
import type { Badge as BadgeType } from "../types";

export function Badge({ badge }: { badge: BadgeType }) {
  const meta = BADGES[badge];
  return (
    <span className={`badge ${meta.className}`} title={meta.label}>
      <span aria-hidden="true">{meta.emoji}</span> {meta.label}
    </span>
  );
}

export function badgeFromScore(score: number): BadgeType {
  if (score >= 68) return "opportunity";
  if (score <= 45) return "overvalued";
  return "watch";
}
