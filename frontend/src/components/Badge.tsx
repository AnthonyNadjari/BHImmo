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

/**
 * Same rule as the pipeline: "opportunity" is a deal score ≥ 68; "overvalued"
 * means the sale closed ≥ 10 % above the local DVF average (a fact).
 */
export function badgeFor(score: number, dvfGapPct: number | null): BadgeType {
  if (score >= 68) return "opportunity";
  if (dvfGapPct !== null && dvfGapPct <= -10) return "overvalued";
  return "watch";
}
