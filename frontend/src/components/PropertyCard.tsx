/**
 * Photo-forward card for one real DVF sale, used by the dashboard's card-grid
 * view. The picture is the IGN aerial view of the address (pin at the centre).
 * Renders from an `IndexEntry`; the whole card links to the detail page.
 */

import { Link } from "react-router-dom";
import { Img, LocationPin } from "./Img";
import { Badge } from "./Badge";
import { districtLabel, formatEuro, formatMonth, formatPerM2, scoreColor } from "../services/format";
import { yieldColor } from "../services/yield";
import type { IndexEntry } from "../types";

export function PropertyCard({ entry }: { entry: IndexEntry }) {
  const e = entry;
  return (
    <Link to={`/property/${e.id}`} className="property-card" aria-label={e.address}>
      <div className="property-card-photo">
        <Img src={e.image} alt={`Aerial view of ${e.address}`} className="property-card-img" />
        <LocationPin src={e.image} />
        <div className="property-card-badge">
          <Badge badge={e.badge} />
        </div>
        {e.dpe_energy && (
          <span
            className={`dpe-chip property-card-dpe dpe-${e.dpe_energy}`}
            title={e.dpe_scope === "unit" ? "DPE of this apartment (ADEME)" : "Median DPE of the building (ADEME)"}
          >
            {e.dpe_energy}
          </span>
        )}
        <span className="property-card-score" style={{ background: scoreColor(e.opportunity_score) }}>
          {e.opportunity_score}
        </span>
      </div>

      <div className="property-card-body">
        <div className="property-card-price">
          {formatEuro(e.price)}
          <span className="property-card-sold">sold {formatMonth(e.sale_date)}</span>
        </div>
        <div className="property-card-meta">
          {formatPerM2(e.price_per_m2)} · {e.surface_m2} m² · {e.rooms} p · {districtLabel(e.district)}
        </div>
        <div className="property-card-foot">
          <span className="property-card-yield" style={{ color: yieldColor(e.net_yield) }}>
            {e.net_yield === null ? "yield n/a" : `${e.net_yield.toFixed(1)}% net`}
          </span>
          <span className="property-card-address" title={e.address}>
            {e.address}
          </span>
        </div>
      </div>
    </Link>
  );
}
