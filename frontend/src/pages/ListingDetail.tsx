/**
 * Listing detail — one apartment on the market: its interior photos from the
 * original adverts, asking-price history (real price drops), the DVF estimate
 * from similar sales nearby, the price trend around it, legal-rent yield and
 * links to the original adverts.
 */

import { Link, useParams } from "react-router-dom";
import { useAsync } from "../hooks/useAsync";
import { fetchListings, fetchMarket } from "../services/data";
import { districtLabel, formatDate, formatEuro, formatPercent, formatPerM2, NA } from "../services/format";
import { Gallery } from "../components/Gallery";
import { PriceChart } from "../components/PriceChart";
import { LineChart, type LineSeries } from "../components/LineChart";
import { ScoreRing } from "../components/ScoreRing";
import { YieldBadge } from "../components/YieldBadge";
import { ErrorState, Loading } from "../components/States";

export function ListingDetail() {
  const { id = "" } = useParams();
  const { loading, error, data, reload } = useAsync(fetchListings, []);
  const { data: market } = useAsync(fetchMarket, []);

  if (loading && !data) return <Loading label="Loading listing…" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const l = data?.listings.find((x) => x.id === id);
  if (!l) {
    return (
      <div className="state">
        <p>Listing not found — it may have left the market.</p>
        <Link to="/listings" className="btn">
          Back to listings
        </Link>
      </div>
    );
  }

  const gap = l.investment.dvf_gap_pct;
  const gapEur = l.investment.estimate_gap_eur;
  const basis = l.dvf.reference_basis;
  const arr = market?.arrondissements.find((a) => a.district === l.address.district);
  const series: LineSeries[] = [
    { id: "local", label: "≤ 500 m", color: "var(--series-1)", points: l.dvf.local_index },
    ...(arr ? [{ id: "arr", label: `${districtLabel(l.address.district)} arr.`, color: "var(--series-2)", points: arr.index }] : []),
    ...(market ? [{ id: "paris", label: "Paris", color: "var(--series-3)", points: market.paris_index }] : []),
  ];

  return (
    <section className="detail">
      <Link to="/listings" className="back-link">
        ← Back to listings
      </Link>

      <div className="detail-hero">
        <div className="detail-hero-media">
          <Gallery images={l.pictures} alt={l.title || "Apartment photo"} credit={`Photos: ${l.publisher ?? "original advert"} via Stream.estate`} />
        </div>
        <aside className="detail-hero-info">
          <span className={`status-pill ${l.expired ? "sold" : ""}`}>
            {l.expired ? `Off the market ${formatDate(l.expired_at ?? "")}` : `On the market · ${l.days_on_market} days`}
          </span>
          <h1>{l.title || `${l.rooms ?? ""} pièces, ${l.surface_m2} m²`}</h1>
          <p className="muted">
            {districtLabel(l.address.district)} arrondissement{l.address.quartier ? ` · ${l.address.quartier}` : ""} ·{" "}
            {l.surface_m2} m² · {l.rooms ?? NA} rooms
            {l.floor !== null ? ` · floor ${l.floor}` : ""}
            {l.construction_year ? ` · built ${l.construction_year}` : ""}
          </p>
          <div className="hero-bottom">
            <div className="hero-price">
              <strong>{formatEuro(l.price)}</strong>
              <span>{formatPerM2(l.price_per_m2)}</span>
            </div>
            <ScoreRing score={l.score.opportunity_score} />
          </div>
          {l.dvf.estimate !== null && gapEur !== null && (
            <p className="estimate-line">
              DVF estimate from similar sales <strong>{formatEuro(l.dvf.estimate)}</strong>
              <span className={gapEur >= 0 ? "accent-good" : "accent-bad"}>
                {" "}
                · asking {formatEuro(Math.abs(gapEur))} {gapEur >= 0 ? "below" : "above"}
              </span>
            </p>
          )}
          <YieldBadge inv={l.investment} rent={l.rent} />
          {l.urls.length > 0 && (
            <div className="listing-links">
              {l.urls.map((u, i) => (
                <a key={u} className="btn small" href={u} target="_blank" rel="noreferrer noopener">
                  Original advert{l.urls.length > 1 ? ` ${i + 1}` : ""} ↗
                </a>
              ))}
            </div>
          )}
        </aside>
      </div>

      <div className="detail-grid">
        <div className="card span-2">
          <h2>Asking-price history</h2>
          {l.price_history.length > 1 ? (
            <PriceChart history={l.price_history} />
          ) : (
            <p className="muted">No price change since it was listed on {formatDate(l.listed_at)}.</p>
          )}
          <div className="kv-row">
            <KV label="Listed" value={formatDate(l.listed_at)} />
            <KV label="First asking price" value={formatEuro(l.price_history[0]?.price ?? l.price)} />
            <KV label="Now" value={formatEuro(l.price)} />
            <KV label="Change" value={formatPercent(l.price_change_pct)} accent={l.price_change_pct < 0} />
            <KV label="Price drops" value={String(l.price_drops)} />
            <KV label="Charges / yr" value={l.condo_fees ? formatEuro(l.condo_fees) : NA} />
          </div>
        </div>

        <div className="card">
          <h2>Signals</h2>
          <ul className="signal-list">
            {l.explanations.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h2>Valuation (DVF)</h2>
          <div className="kv-row vertical compact-kv">
            <KV label="Asking €/m²" value={formatPerM2(l.price_per_m2)} />
            <KV label="Similar sales €/m²" value={l.dvf.reference_m2 ? formatPerM2(l.dvf.reference_m2) : NA} />
            <KV
              label="Asking vs DVF"
              value={gap === null ? "not enough sales" : `${Math.abs(gap).toFixed(1)}% ${gap >= 0 ? "below" : "above"}`}
              accent={gap !== null && gap >= 0}
            />
            <KV label="DPE (advert)" value={l.dpe ? `${l.dpe.energy_class}${l.dpe.ghg_class ? ` / GES ${l.dpe.ghg_class}` : ""}` : NA} />
          </div>
          <p className="data-note">
            {basis
              ? `Median of ${basis.comps} ${basis.size_min !== null ? `similar-size (${basis.size_min}–${basis.size_max} m²) ` : ""}apartment sales within ${basis.radius_m} m, `
              : "Not enough DVF sales nearby. "}
            from {formatDate(l.dvf.window_from)} to {formatDate(l.dvf.window_to)} (latest DVF release), restated at the latest
            quarter.
          </p>
        </div>

        {l.description && (
          <div className="card span-2">
            <h2>Description (advert)</h2>
            <p className="listing-desc">{l.description}</p>
          </div>
        )}

        <div className="card span-2">
          <h2>Price trend around this address</h2>
          <LineChart series={series} ariaLabel="Quarterly median price per m² within 500 m, in the arrondissement and in Paris" />
        </div>
      </div>

      <p className="muted source-note">
        Source: Stream.estate (adverts {l.publisher ? `by ${l.publisher}` : ""}) · valuation: DVF (DGFiP / Etalab) · fetched{" "}
        {formatDate(l.fetched_at.slice(0, 10))}
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
