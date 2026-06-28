/**
 * PAGE 2 — Property detail.
 * Header (address / price / score), price-history chart, DVF market comparison,
 * OSM map, risk exposure, explainable signals, sub-scores and comparable sales.
 */

import { Suspense, lazy } from "react";
import { Link, useParams } from "react-router-dom";
import { useAsync } from "../hooks/useAsync";
import { fetchProperty } from "../services/data";
import {
  districtLabel,
  formatDate,
  formatEuro,
  formatPercent,
  formatPerM2,
  STATUS_LABEL,
} from "../services/format";
import { PriceChart } from "../components/PriceChart";
import { Gallery } from "../components/Gallery";
import { RiskBars } from "../components/RiskBars";
import { RadarChart } from "../components/RadarChart";
import { PriceDistribution } from "../components/PriceDistribution";
import { YieldBadge } from "../components/YieldBadge";
import { WatchButton } from "../components/WatchButton";
import { NeighborhoodCard } from "../components/NeighborhoodCard";
import { ScoreRing } from "../components/ScoreRing";
import { Badge, badgeFromScore } from "../components/Badge";
import { ErrorState, Loading } from "../components/States";

const MiniMap = lazy(() => import("../components/MiniMap"));

export function PropertyDetail() {
  const { id = "" } = useParams();
  const { loading, error, data: p, reload } = useAsync(() => fetchProperty(id), [id]);

  if (loading) return <Loading label="Loading property…" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!p) return <NotFound />;

  const dvfRef =
    p.dvf.avg_price_m2_100m > 0 && p.dvf.avg_price_m2_500m > 0
      ? 0.6 * p.dvf.avg_price_m2_100m + 0.4 * p.dvf.avg_price_m2_500m
      : p.dvf.avg_price_m2_500m || p.dvf.avg_price_m2_100m;
  const gapPct = dvfRef > 0 ? ((dvfRef - p.pricing.price_per_m2) / dvfRef) * 100 : 0;
  const dropPct = p.signals.total_drop_percent;

  const radarAxes = [
    { label: "Value", value: p.score.value_score },
    { label: "Yield", value: p.score.yield_score },
    { label: "Negotiation", value: p.score.negotiation_score },
    { label: "Liquidity", value: p.score.liquidity_score },
    { label: "Gentrif.", value: p.score.gentrification_score },
    { label: "Low-risk", value: Math.round(100 - 100 * Math.max(p.risks.flood, p.risks.clay, p.risks.noise)) },
  ];

  return (
    <section className="detail">
      <Link to="/" className="back-link">
        ← Back to dashboard
      </Link>

      {/* Photo-led hero */}
      <div className="detail-hero">
        <div className="detail-hero-media">
          <Gallery images={p.images} seed={p.id} alt={p.address.normalized} />
          <div className="hero-photo-scrim" aria-hidden="true" />
          <div className="hero-photo-badge">
            <Badge badge={badgeFromScore(p.score.opportunity_score)} />
          </div>
        </div>
        <aside className="detail-hero-info">
          <span className={`status-pill ${p.status}`}>{STATUS_LABEL[p.status]}</span>
          <h1>{p.address.normalized}</h1>
          <p className="muted">
            {districtLabel(p.address.district)} arrondissement · {p.characteristics.surface_m2} m² ·{" "}
            {p.characteristics.rooms} rooms · floor {p.characteristics.floor}
          </p>
          {p.status !== "active" && (
            <p className="hist-note">
              No longer listed ({STATUS_LABEL[p.status]?.toLowerCase()}) — figures are historical,
              last seen {formatDate(p.timeline.last_seen)}.
            </p>
          )}
          <div className="hero-bottom">
            <div className="hero-price">
              <strong>{formatEuro(p.pricing.current_price)}</strong>
              <span>{formatPerM2(p.pricing.price_per_m2)}</span>
            </div>
            <ScoreRing score={p.score.opportunity_score} />
          </div>
          <YieldBadge inv={p.investment} rent={p.rent} />
          <WatchButton property={p} />
        </aside>
      </div>

      <div className="detail-grid">
        {/* Price history */}
        <div className="card span-2">
          <h2>Price history</h2>
          <PriceChart history={p.price_history} />
          <div className="kv-row">
            <KV label="Initial" value={formatEuro(p.pricing.initial_price)} />
            <KV label="Current" value={formatEuro(p.pricing.current_price)} />
            <KV label="Total change" value={formatPercent(-dropPct)} accent={dropPct > 0} />
            <KV label="Price drops" value={String(p.signals.price_drops)} />
            <KV label="Days on market" value={`${p.timeline.days_on_market} d`} />
          </div>
        </div>

        {/* Signals */}
        <div className="card">
          <h2>Signals</h2>
          <ul className="signal-list">
            {p.signals.explanations.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>

        {/* Market comparison */}
        <div className="card">
          <h2>Market comparison (DVF)</h2>
          <div className="kv-row vertical compact-kv">
            <KV label="Listing €/m²" value={formatPerM2(p.pricing.price_per_m2)} />
            <KV label="DVF avg · 100 m" value={formatPerM2(p.dvf.avg_price_m2_100m)} />
            <KV label="DVF avg · 500 m" value={formatPerM2(p.dvf.avg_price_m2_500m)} />
            <KV
              label="Gap vs DVF"
              value={`${Math.abs(gapPct).toFixed(1)}% ${gapPct >= 0 ? "below" : "above"} DVF`}
              accent={gapPct >= 0}
            />
          </div>
          <PriceDistribution
            district={p.address.district}
            value={p.pricing.price_per_m2}
            dvfRef={Math.round(dvfRef)}
            percentile={p.investment.ppm2_percentile}
          />
        </div>

        {/* Deal profile (radar) */}
        <div className="card">
          <h2>Deal profile</h2>
          <RadarChart axes={radarAxes} />
        </div>

        {/* Risks */}
        <div className="card">
          <h2>Risks</h2>
          <RiskBars flood={p.risks.flood} clay={p.risks.clay} noise={p.risks.noise} />
          {p.dpe && (
            <>
              <div className="dpe">
                <span>Energy (DPE)</span>
                <strong className={`dpe-class dpe-${p.dpe.energy_class}`}>{p.dpe.energy_class}</strong>
                <span>GHG</span>
                <strong className={`dpe-class dpe-${p.dpe.ghg_class}`}>{p.dpe.ghg_class}</strong>
              </div>
              {(p.dpe.energy_class === "F" || p.dpe.energy_class === "G") && (
                <p className={`dpe-note ${p.investment.value_add_flag ? "good" : ""}`}>
                  {p.investment.value_add_flag
                    ? "Value-add: discount exceeds renovation cost — reno-arbitrage."
                    : `Class ${p.dpe.energy_class} — rental restrictions apply (G banned since 2025, F from 2028).`}
                </p>
              )}
            </>
          )}
        </div>

        {/* Neighbourhood & lifestyle */}
        <div className="card">
          <h2>Neighbourhood & lifestyle</h2>
          <NeighborhoodCard hood={p.neighborhood} />
        </div>

        {/* Map */}
        <div className="card">
          <h2>Location & amenities</h2>
          <Suspense fallback={<div className="map-loading">Loading map…</div>}>
            <MiniMap property={p} />
          </Suspense>
          <div className="minimap-legend">
            <span><i style={{ background: "#e0a44a" }} /> Transport</span>
            <span><i style={{ background: "#3ecf8e" }} /> Park</span>
            <span><i style={{ background: "#34c6c6" }} /> Vélib'</span>
          </div>
        </div>

        {/* Comparable sales */}
        <div className="card span-2">
          <h2>Comparable DVF sales</h2>
          {p.dvf.comparable_sales.length === 0 ? (
            <p className="muted">No comparable sales found nearby.</p>
          ) : (
            <table className="data-table compact">
              <thead>
                <tr>
                  <th>Sale price</th>
                  <th>Date</th>
                  <th>Distance</th>
                </tr>
              </thead>
              <tbody>
                {p.dvf.comparable_sales.map((c, i) => (
                  <tr key={i}>
                    <td className="num">{formatEuro(c.price)}</td>
                    <td>{formatDate(c.date)}</td>
                    <td className="num">{c.distance_m} m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <p className="muted source-note">
        Source: {p.source}
        {p.url && /^https?:\/\//i.test(p.url) && isReachableUrl(p.url) ? (
          <>
            {" · "}
            <a href={p.url} target="_blank" rel="noreferrer noopener">
              original listing ↗
            </a>
          </>
        ) : (
          p.url && <>{" · "}original listing unavailable (synthetic demo)</>
        )}
      </p>
    </section>
  );
}

/**
 * Reserved TLDs (RFC 2606 / 6761) never resolve on the public internet, so a
 * link to them always 404s. The synthetic dataset uses https://example.invalid/…
 * — render those as inert text instead of a dead clickable link.
 */
function isReachableUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return !/\.(invalid|example|test|localhost)$/.test(host) && host !== "localhost";
  } catch {
    return false;
  }
}

function KV({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="kv">
      <span className="kv-label">{label}</span>
      <span className={`kv-value ${accent ? "accent-good" : ""}`}>{value}</span>
    </div>
  );
}

function NotFound() {
  return (
    <div className="state">
      <p>Property not found.</p>
      <Link to="/" className="btn">
        Back to dashboard
      </Link>
    </div>
  );
}
