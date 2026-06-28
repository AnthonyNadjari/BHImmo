/**
 * Photo-forward listing card (SeLoger / Bien'ici style) used by the dashboard's
 * card-grid view. Renders from an `IndexEntry`; the whole card links to the
 * property detail page. Reuses the shared Img, Badge and formatting helpers so
 * it stays visually consistent with the table view.
 */

import { Link } from "react-router-dom";
import { Img } from "./Img";
import { Badge } from "./Badge";
import {
  districtLabel,
  formatEuro,
  formatPerM2,
  scoreColor,
} from "../services/format";
import { yieldColor } from "../services/yield";
import type { IndexEntry } from "../types";

export function PropertyCard({ entry }: { entry: IndexEntry }) {
  const e = entry;
  return (
    <Link
      to={`/property/${e.id}`}
      className={`property-card ${e.status !== "active" ? "is-inactive" : ""}`}
      aria-label={e.address}
    >
      <div className="property-card-photo">
        <Img src={e.image} seed={e.id} alt={e.address} className="property-card-img" />
        <div className="property-card-badge">
          <Badge badge={e.badge} />
        </div>
        {e.dpe_energy && (
          <span className={`dpe-chip property-card-dpe dpe-${e.dpe_energy}`}>
            {e.dpe_energy}
          </span>
        )}
        <span
          className="property-card-score"
          style={{ background: scoreColor(e.opportunity_score) }}
        >
          {e.opportunity_score}
        </span>
      </div>

      <div className="property-card-body">
        <div className="property-card-price">{formatEuro(e.current_price)}</div>
        <div className="property-card-meta">
          {formatPerM2(e.price_per_m2)} · {e.surface_m2} m² · {e.rooms} p ·{" "}
          {districtLabel(e.district)}
        </div>
        <div className="property-card-foot">
          <span
            className="property-card-yield"
            style={{ color: yieldColor(e.net_yield) }}
          >
            {e.net_yield.toFixed(1)}% net
          </span>
          <span className="property-card-address" title={e.address}>
            {e.address}
          </span>
        </div>
      </div>
    </Link>
  );
}
