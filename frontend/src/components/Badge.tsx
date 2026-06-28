/** Opportunity / watch / overvalued badge. */

import { Icon } from "./Icon";
import { BADGES } from "../services/format";
import type { Badge as BadgeType } from "../types";

const ICON = {
  opportunity: "trending-up",
  watch: "eye",
  overvalued: "trending-down",
} as const;

export function Badge({ badge }: { badge: BadgeType }) {
  const meta = BADGES[badge];
  return (
    <span className={`badge ${meta.className}`} title={meta.label}>
      <Icon name={ICON[badge]} size={13} />
      {meta.label}
    </span>
  );
}

export function badgeFromScore(score: number): BadgeType {
  if (score >= 68) return "opportunity";
  if (score <= 45) return "overvalued";
  return "watch";
}
