/** Net rental yield at the legal rent ceiling (encadrement des loyers). */

import { yieldColor, yieldLabel } from "../services/yield";
import type { Property } from "../types";

export function YieldBadge({ inv, rent }: { inv: Property["investment"]; rent: Property["rent"] }) {
  if (inv.net_yield === null || inv.gross_yield === null || !rent) {
    return (
      <div className="yield-badge">
        <div className="yield-sub muted">No rent-control reference for this address — yield not computed.</div>
      </div>
    );
  }
  const color = yieldColor(inv.net_yield);
  return (
    <div className="yield-badge" style={{ borderColor: color }}>
      <div className="yield-main">
        <strong style={{ color }}>{inv.net_yield.toFixed(1)}%</strong>
        <span>net yield at the legal rent ceiling</span>
      </div>
      <div className="yield-sub">
        <span style={{ color }}>{yieldLabel(inv.net_yield)}</span>
        <span className="muted">· {inv.gross_yield.toFixed(1)}% gross</span>
        <span className="muted">· max {rent.monthly_est.toLocaleString("fr-FR")} €/mo</span>
      </div>
    </div>
  );
}

/** Compact variant for the dashboard cell. */
export function YieldCell({ net }: { net: number | null }) {
  return (
    <span className="yield-cell" style={{ color: yieldColor(net) }}>
      {net === null ? "—" : `${net.toFixed(1)}%`}
    </span>
  );
}
