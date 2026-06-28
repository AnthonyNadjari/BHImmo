/** Net rental yield, the number a Paris investor decides on. */

import { yieldColor, yieldLabel } from "../services/yield";
import type { Property } from "../types";

export function YieldBadge({ inv, rent }: { inv: Property["investment"]; rent?: Property["rent"] }) {
  const color = yieldColor(inv.net_yield);
  return (
    <div className="yield-badge" style={{ borderColor: color }}>
      <div className="yield-main">
        <strong style={{ color }}>{inv.net_yield.toFixed(1)}%</strong>
        <span>net yield (est.)</span>
      </div>
      <div className="yield-sub">
        <span style={{ color }}>{yieldLabel(inv.net_yield)}</span>
        <span className="muted">· {inv.gross_yield.toFixed(1)}% gross</span>
        {rent && <span className="muted">· {rent.monthly_est.toLocaleString("fr-FR")} €/mo</span>}
      </div>
    </div>
  );
}

/** Compact variant for the dashboard cell. */
export function YieldCell({ net }: { net: number }) {
  return (
    <span className="yield-cell" style={{ color: yieldColor(net) }}>
      {net.toFixed(1)}%
    </span>
  );
}
