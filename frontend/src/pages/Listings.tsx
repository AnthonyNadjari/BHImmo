/**
 * Listings currently on the market, with their real interior photos (licensed
 * Stream.estate API), each valued against what similar DVF sales nearby imply,
 * with its real asking-price history (price drops) and days on market.
 * Until the pipeline has an API key, this page explains how to enable it —
 * it never shows placeholder listings.
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAsync } from "../hooks/useAsync";
import { fetchListings } from "../services/data";
import { districtLabel, formatEuro, formatNumber, formatPerM2, NA, scoreColor } from "../services/format";
import { yieldColor } from "../services/yield";
import { Img } from "../components/Img";
import { DataFreshness } from "../components/DataFreshness";
import { ErrorState, Loading } from "../components/States";
import type { Listing } from "../types";

const PAGE = 60;
type Sort = "score" | "gap" | "drop" | "newest" | "price";

export function Listings() {
  const { loading, error, data, reload } = useAsync(fetchListings, []);
  const [district, setDistrict] = useState("all");
  const [maxPrice, setMaxPrice] = useState(0);
  const [minRooms, setMinRooms] = useState(0);
  const [onlyDrops, setOnlyDrops] = useState(false);
  const [onlyBelow, setOnlyBelow] = useState(false);
  const [showExpired, setShowExpired] = useState(false);
  const [sort, setSort] = useState<Sort>("score");
  const [shown, setShown] = useState(PAGE);

  const all = data?.listings ?? [];
  const districts = useMemo(() => [...new Set(all.map((l) => l.address.district))].sort(), [all]);
  const filtered = useMemo(() => {
    const rows = all.filter(
      (l) =>
        (showExpired || !l.expired) &&
        (district === "all" || l.address.district === district) &&
        (!maxPrice || l.price <= maxPrice) &&
        (!minRooms || (l.rooms ?? 0) >= minRooms) &&
        (!onlyDrops || l.price_drops > 0) &&
        (!onlyBelow || (l.investment.dvf_gap_pct ?? -Infinity) >= 10),
    );
    const key: Record<Sort, (l: Listing) => number> = {
      score: (l) => -l.score.opportunity_score,
      gap: (l) => -(l.investment.dvf_gap_pct ?? -Infinity),
      drop: (l) => l.price_change_pct,
      newest: (l) => -Date.parse(l.listed_at),
      price: (l) => l.price,
    };
    return rows.sort((a, b) => key[sort](a) - key[sort](b));
  }, [all, district, maxPrice, minRooms, onlyDrops, onlyBelow, showExpired, sort]);
  useEffect(() => setShown(PAGE), [filtered]);

  if (loading && !data) return <Loading label="Loading listings…" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  if (!data) {
    return (
      <section>
        <div className="page-head">
          <h1>For sale</h1>
        </div>
        <div className="card listings-setup">
          <h2>Interior photos need a licensed listings feed</h2>
          <p>
            DVF records completed sales only — their adverts (and photos) are gone. Listings currently on the market,
            with their interior photos, real price drops and days on market, come from the{" "}
            <a href="https://stream.estate/" target="_blank" rel="noreferrer noopener">Stream.estate API ↗</a> (the data
            behind Melo, 1 500+ French sources). Listing portals are not scraped: their databases are legally protected
            and the photos belong to the agencies.
          </p>
          <ol>
            <li>Create an account on stream.estate (free credit to start) and an API key in its console.</li>
            <li>
              Add it to the repository: <em>Settings → Secrets and variables → Actions → New secret</em>{" "}
              <code>STREAM_ESTATE_API_KEY</code>.
            </li>
            <li>Run the <em>Data pipeline</em> workflow — listings appear here, valued against DVF sales.</li>
          </ol>
          <p className="muted">
            Nothing is shown until real listings arrive — no placeholders. Meanwhile, the{" "}
            <Link to="/sales">past sales (DVF)</Link>, <Link to="/map">map</Link> and <Link to="/market">market</Link> pages
            show what apartments actually sell for, street by street.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>For sale</h1>
          <p className="muted">
            {formatNumber(filtered.length)} of {formatNumber(all.length)} Paris apartments on the market · photos from the
            original adverts via Stream.estate
          </p>
        </div>
        <DataFreshness generatedAt={data.generated_at} currentIds={all.map((l) => l.id)} />
      </div>

      <div className="filters">
        <select className="input" aria-label="Arrondissement" value={district} onChange={(e) => setDistrict(e.target.value)}>
          <option value="all">All arrondissements</option>
          {districts.map((d) => (
            <option key={d} value={d}>
              {districtLabel(d)} ({d})
            </option>
          ))}
        </select>
        <select className="input" aria-label="Maximum budget" value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))}>
          <option value="0">Any budget</option>
          <option value="300000">≤ 300 k€</option>
          <option value="500000">≤ 500 k€</option>
          <option value="750000">≤ 750 k€</option>
          <option value="1000000">≤ 1 M€</option>
        </select>
        <select className="input" aria-label="Minimum rooms" value={minRooms} onChange={(e) => setMinRooms(Number(e.target.value))}>
          <option value="0">Any rooms</option>
          <option value="2">2+ rooms</option>
          <option value="3">3+ rooms</option>
          <option value="4">4+ rooms</option>
        </select>
        <button className={`chip ${onlyDrops ? "on" : ""}`} aria-pressed={onlyDrops} onClick={() => setOnlyDrops((v) => !v)}>
          Price dropped
        </button>
        <button className={`chip ${onlyBelow ? "on" : ""}`} aria-pressed={onlyBelow} onClick={() => setOnlyBelow((v) => !v)}>
          ≥10% below DVF estimate
        </button>
        <button className={`chip ${showExpired ? "on" : ""}`} aria-pressed={showExpired} onClick={() => setShowExpired((v) => !v)}>
          Include off-market
        </button>
        <select className="input" aria-label="Sort listings" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="score">Sort: Best score</option>
          <option value="gap">Sort: Most below estimate</option>
          <option value="drop">Sort: Biggest price drop</option>
          <option value="newest">Sort: Newest</option>
          <option value="price">Sort: Price ↑</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="state">No listings match these filters.</p>
      ) : (
        <>
          <div className="card-grid">
            {filtered.slice(0, shown).map((l) => (
              <ListingCard key={l.id} l={l} />
            ))}
          </div>
          {filtered.length > shown && (
            <div className="pager">
              Showing {formatNumber(shown)} of {formatNumber(filtered.length)}
              <button className="btn small" onClick={() => setShown((n) => n + PAGE)}>
                Show more
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function ListingCard({ l }: { l: Listing }) {
  const gap = l.investment.dvf_gap_pct;
  return (
    <Link to={`/listing/${l.id}`} className={`property-card ${l.expired ? "is-inactive" : ""}`} aria-label={l.title || l.address.district}>
      <div className="property-card-photo">
        <Img src={l.pictures[0] ?? ""} alt={l.title || "Apartment photo"} className="property-card-img" />
        {l.price_drops > 0 && <span className="listing-drop">↓ {Math.abs(l.price_change_pct)}%</span>}
        {l.dpe && <span className={`dpe-chip property-card-dpe dpe-${l.dpe.energy_class}`}>{l.dpe.energy_class}</span>}
        <span className="property-card-score" style={{ background: scoreColor(l.score.opportunity_score) }}>
          {l.score.opportunity_score}
        </span>
        {l.pictures.length > 1 && <span className="listing-photos">{l.pictures.length} photos</span>}
      </div>
      <div className="property-card-body">
        <div className="property-card-price">
          {formatEuro(l.price)}
          <span className="property-card-sold">
            {l.expired ? "off market" : `${l.days_on_market} d on market`}
          </span>
        </div>
        <div className="property-card-meta">
          {formatPerM2(l.price_per_m2)} · {l.surface_m2} m² · {l.rooms ?? NA} p
          {l.floor !== null ? ` · floor ${l.floor}` : ""} · {districtLabel(l.address.district)}
          {l.address.quartier ? ` · ${l.address.quartier}` : ""}
        </div>
        {l.dvf.estimate !== null && gap !== null && (
          <div className="property-card-estimate">
            DVF est. {formatEuro(l.dvf.estimate)} ·{" "}
            <span className={gap >= 0 ? "accent-good" : "accent-bad"}>
              {Math.abs(gap).toFixed(0)}% {gap >= 0 ? "below" : "above"}
            </span>
          </div>
        )}
        <div className="property-card-foot">
          <span className="property-card-yield" style={{ color: yieldColor(l.investment.net_yield) }}>
            {l.investment.net_yield === null ? "yield n/a" : `${l.investment.net_yield.toFixed(1)}% net`}
          </span>
          <span className="property-card-address" title={l.title}>
            {l.title}
          </span>
        </div>
      </div>
    </Link>
  );
}
