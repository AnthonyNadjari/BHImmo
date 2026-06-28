/**
 * PAGE 2 — Property detail.
 * Header (address / price / score), price-history chart, DVF market comparison,
 * OSM map, risk exposure, explainable signals, sub-scores and comparable sales.
 */

import { Link, useParams } from "react-router-dom";
import { useAsync } from "../hooks/useAsync";
import { fetchProperty } from "../services/data";
import {
  districtLabel,
  formatDate,
  formatEuro,
  formatPercent,
  formatPerM2,
  scoreColor,
  STATUS_LABEL,
} from "../services/format";
import { PriceChart } from "../components/PriceChart";
import { RiskBars } from "../components/RiskBars";
import { ScoreGauge } from "../components/ScoreBar";
import { MapEmbed } from "../components/MapEmbed";
import { WatchButton } from "../components/WatchButton";

export function PropertyDetail() {
  const { id = "" } = useParams();
  const { loading, error, data: p } = useAsync(() => fetchProperty(id), [id]);

  if (loading) return <p className="state">Loading property…</p>;
  if (error) return <p className="state error">Failed to load: {error.message}</p>;
  if (!p) return <NotFound />;

  const dvfRef =
    p.dvf.avg_price_m2_100m > 0 && p.dvf.avg_price_m2_500m > 0
      ? 0.6 * p.dvf.avg_price_m2_100m + 0.4 * p.dvf.avg_price_m2_500m
      : p.dvf.avg_price_m2_500m || p.dvf.avg_price_m2_100m;
  const gapPct = dvfRef > 0 ? ((dvfRef - p.pricing.price_per_m2) / dvfRef) * 100 : 0;
  const dropPct = p.signals.total_drop_percent;

  return (
    <section className="detail">
      <Link to="/" className="back-link">
        ← Back to dashboard
      </Link>

      {/* Header */}
      <header className="detail-head">
        <div>
          <h1>{p.address.normalized}</h1>
          <p className="muted">
            {districtLabel(p.address.district)} arrondissement · {p.characteristics.surface_m2} m² ·{" "}
            {p.characteristics.rooms} rooms · floor {p.characteristics.floor} ·{" "}
            <span className={`status-pill ${p.status}`}>{STATUS_LABEL[p.status]}</span>
          </p>
        </div>
        <div className="detail-head-right">
          <div className="big-price">
            {formatEuro(p.pricing.current_price)}
            <span>{formatPerM2(p.pricing.price_per_m2)}</span>
          </div>
          <div className="big-score" style={{ borderColor: scoreColor(p.score.opportunity_score) }}>
            <span>Opportunity</span>
            <strong style={{ color: scoreColor(p.score.opportunity_score) }}>
              {p.score.opportunity_score}
            </strong>
          </div>
          <WatchButton property={p} />
        </div>
      </header>

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
          <div className="kv-row vertical">
            <KV label="Listing €/m²" value={formatPerM2(p.pricing.price_per_m2)} />
            <KV label="DVF avg · 100 m" value={formatPerM2(p.dvf.avg_price_m2_100m)} />
            <KV label="DVF avg · 500 m" value={formatPerM2(p.dvf.avg_price_m2_500m)} />
            <KV
              label="Gap vs DVF"
              value={`${gapPct >= 0 ? "−" : "+"}${Math.abs(gapPct).toFixed(1)}% ${gapPct >= 0 ? "below" : "above"}`}
              accent={gapPct >= 0}
            />
          </div>
        </div>

        {/* Sub-scores */}
        <div className="card">
          <h2>Score breakdown</h2>
          <ScoreGauge label="Market gap" score={p.score.market_gap_score} />
          <ScoreGauge label="Price vs arrondissement" score={p.score.price_score} />
          <ScoreGauge label="Liquidity" score={p.score.liquidity_score} />
          <ScoreGauge label="Transport" score={p.transport_score} />
        </div>

        {/* Risks */}
        <div className="card">
          <h2>Risks</h2>
          <RiskBars flood={p.risks.flood} clay={p.risks.clay} noise={p.risks.noise} />
          {p.dpe && (
            <div className="dpe">
              <span>Energy (DPE)</span>
              <strong className={`dpe-class dpe-${p.dpe.energy_class}`}>{p.dpe.energy_class}</strong>
              <span>GHG</span>
              <strong className={`dpe-class dpe-${p.dpe.ghg_class}`}>{p.dpe.ghg_class}</strong>
            </div>
          )}
        </div>

        {/* Map */}
        <div className="card span-2">
          <h2>Location</h2>
          <MapEmbed lat={p.address.lat} lng={p.address.lng} label={p.address.normalized} />
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

      {p.url && (
        <p className="muted source-note">
          Source: {p.source}
          {" · "}
          <a href={p.url} target="_blank" rel="noreferrer">
            original listing ↗
          </a>{" "}
          (synthetic demo link)
        </p>
      )}
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
      <p>Property not found.</p>
      <Link to="/" className="btn">
        Back to dashboard
      </Link>
    </div>
  );
}
