/**
 * PAGE 2 — Sale detail.
 * One real DVF apartment sale: aerial imagery of the address, sale and resale
 * history, DVF comparables, explainable signals, open-data neighbourhood and
 * risk facts, rent-control yield and an investment simulator. Every figure
 * names its source; missing data is shown as missing.
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
  NA,
} from "../services/format";
import { PriceChart } from "../components/PriceChart";
import { Gallery } from "../components/Gallery";
import { RadarChart, type RadarAxis } from "../components/RadarChart";
import { PriceDistribution } from "../components/PriceDistribution";
import { YieldBadge } from "../components/YieldBadge";
import { WatchButton } from "../components/WatchButton";
import { NeighborhoodViz } from "../components/NeighborhoodViz";
import { InvestmentCalculator } from "../components/InvestmentCalculator";
import { ScoreRing } from "../components/ScoreRing";
import { Badge, badgeFor } from "../components/Badge";
import { ErrorState, Loading } from "../components/States";

const MiniMap = lazy(() => import("../components/MiniMap"));

export function PropertyDetail() {
  const { id = "" } = useParams();
  const { loading, error, data: p, reload } = useAsync(() => fetchProperty(id), [id]);

  if (loading && !p) return <Loading label="Loading sale…" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!p) return <NotFound />;

  const a100 = p.dvf.avg_price_m2_100m;
  const a500 = p.dvf.avg_price_m2_500m;
  const dvfRef = a100 && a500 ? 0.6 * a100 + 0.4 * a500 : a100 ?? a500;
  const gapPct = p.investment.dvf_gap_pct;
  const resale = p.signals.resale;

  const risk = [p.risks.flood, p.risks.clay].filter((r) => r !== null).map((r) => r!.value);
  const radarAxes = [
    { label: "Value", value: p.score.value_score },
    { label: "Yield", value: p.score.yield_score },
    { label: "Liquidity", value: p.score.liquidity_score },
    { label: "Gentrif.", value: p.score.gentrification_score },
    { label: "Low-risk", value: risk.length ? Math.round(100 - 100 * Math.max(...risk)) : null },
  ].filter((x): x is RadarAxis => x.value !== null);

  return (
    <section className="detail">
      <Link to="/" className="back-link">
        ← Back to dashboard
      </Link>

      {/* Imagery-led hero */}
      <div className="detail-hero">
        <div className="detail-hero-media">
          <Gallery images={p.images} alt={`Aerial view of ${p.address.normalized}`} credit={p.image_credit} />
          <div className="hero-photo-scrim" aria-hidden="true" />
          <div className="hero-photo-badge">
            <Badge badge={badgeFor(p.score.opportunity_score, p.investment.dvf_gap_pct)} />
          </div>
        </div>
        <aside className="detail-hero-info">
          <span className="status-pill sold">Sold {formatDate(p.sale.date)}</span>
          <h1>{p.address.normalized}</h1>
          <p className="muted">
            {districtLabel(p.address.district)} arrondissement · {p.characteristics.surface_m2} m²
            {p.characteristics.carrez_m2 ? ` (Carrez ${p.characteristics.carrez_m2} m²)` : ""} ·{" "}
            {p.characteristics.rooms} room{p.characteristics.rooms > 1 ? "s" : ""}
          </p>
          <div className="hero-bottom">
            <div className="hero-price">
              <strong>{formatEuro(p.sale.price)}</strong>
              <span>{formatPerM2(p.sale.price_per_m2)}</span>
            </div>
            <ScoreRing score={p.score.opportunity_score} />
          </div>
          <YieldBadge inv={p.investment} rent={p.rent} />
          <WatchButton property={p} />
        </aside>
      </div>

      <div className="detail-grid">
        {/* Sale & resale history */}
        <div className="card span-2">
          <h2>Sale history (DVF)</h2>
          {p.price_history.length > 1 ? (
            <PriceChart history={p.price_history} />
          ) : (
            <p className="muted">
              No earlier sale of this lot (same parcel and lot number) in the DVF years loaded — this is its only
              recorded sale.
            </p>
          )}
          <div className="kv-row">
            <KV label="Sale price" value={formatEuro(p.sale.price)} />
            <KV label="Sale date" value={formatDate(p.sale.date)} />
            <KV label="Previous sale" value={resale ? `${formatEuro(resale.previous_price)} · ${formatDate(resale.previous_date)}` : NA} />
            <KV label="Change" value={resale ? formatPercent(resale.change_pct) : NA} accent={!!resale && resale.change_pct > 0} />
            <KV label="Held" value={resale ? `${resale.years} y` : NA} />
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
            <KV label="This sale €/m²" value={formatPerM2(p.sale.price_per_m2)} />
            <KV label={`DVF avg · 100 m (${p.dvf.count_100m} sales)`} value={a100 ? formatPerM2(a100) : NA} />
            <KV label={`DVF avg · 500 m (${p.dvf.count_500m} sales)`} value={a500 ? formatPerM2(a500) : NA} />
            <KV
              label="Gap vs DVF"
              value={gapPct === null ? "not enough comparables" : `${Math.abs(gapPct).toFixed(1)}% ${gapPct >= 0 ? "below" : "above"} DVF`}
              accent={gapPct !== null && gapPct >= 0}
            />
          </div>
          <p className="data-note">
            Apartment sales from {formatDate(p.dvf.window_from)} to {formatDate(p.dvf.window_to)}, this sale excluded.
          </p>
          {dvfRef && (
            <PriceDistribution
              district={p.address.district}
              value={p.sale.price_per_m2}
              dvfRef={Math.round(dvfRef)}
              percentile={p.investment.ppm2_percentile}
            />
          )}
        </div>

        {/* Deal profile (radar) */}
        <div className="card">
          <h2>Deal profile</h2>
          {radarAxes.length >= 3 ? <RadarChart axes={radarAxes} /> : <p className="muted">Not enough data for a profile.</p>}
        </div>

        {/* Neighbourhood & data — visual open-data section */}
        <NeighborhoodViz property={p} />

        {/* Map */}
        <div className="card span-2">
          <h2>Location & amenities</h2>
          <Suspense fallback={<div className="map-loading">Loading map…</div>}>
            <MiniMap property={p} />
          </Suspense>
          <div className="minimap-legend">
            <span><i style={{ background: "#2563eb" }} /> Transport (IDFM)</span>
            <span><i style={{ background: "#0e9488" }} /> Park (Ville de Paris)</span>
            <span><i style={{ background: "#0891b2" }} /> Vélib'</span>
          </div>
        </div>

        {/* Comparable sales */}
        <div className="card span-2">
          <h2>Comparable DVF sales</h2>
          {p.dvf.comparable_sales.length === 0 ? (
            <p className="muted">No apartment sale within 500 m in the comparison window.</p>
          ) : (
            <table className="data-table compact">
              <thead>
                <tr>
                  <th>Sale price</th>
                  <th>Surface</th>
                  <th>€/m²</th>
                  <th>Date</th>
                  <th>Distance</th>
                </tr>
              </thead>
              <tbody>
                {p.dvf.comparable_sales.map((c, i) => (
                  <tr key={i}>
                    <td className="num">{formatEuro(c.price)}</td>
                    <td className="num">{c.surface_m2} m²</td>
                    <td className="num">{formatPerM2(c.price_per_m2)}</td>
                    <td>{formatDate(c.date)}</td>
                    <td className="num">{c.distance_m} m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Investment simulator */}
        <InvestmentCalculator property={p} />
      </div>

      <p className="muted source-note">
        Source: DVF (DGFiP / Etalab) — mutation {p.sale.mutation_id}, parcel {p.sale.parcel}
        {p.address.ban_id && <> · BAN {p.address.ban_id}</>} ·{" "}
        <a href={p.url} target="_blank" rel="noreferrer noopener">
          explore DVF ↗
        </a>
      </p>
    </section>
  );
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
      <p>Sale not found — it may have rotated out after a newer DVF release.</p>
      <Link to="/" className="btn">
        Back to dashboard
      </Link>
    </div>
  );
}
