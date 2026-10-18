/**
 * PAGE 1 — Dashboard.
 * Sortable / filterable view of the most recent real Paris apartment sales
 * (DVF), with deal scores, badges, CSV export and a side-by-side comparison.
 */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAsync } from "../hooks/useAsync";
import { fetchIndex } from "../services/data";
import {
  districtLabel,
  formatDate,
  formatEuro,
  formatPct,
  formatPerM2,
  NA,
} from "../services/format";
import { downloadCsv } from "../services/csv";
import { Sparkline } from "../components/Sparkline";
import { ScoreBar } from "../components/ScoreBar";
import { Badge } from "../components/Badge";
import { Img, LocationPin } from "../components/Img";
import { Icon } from "../components/Icon";
import { PropertyCard } from "../components/PropertyCard";
import { YieldCell } from "../components/YieldBadge";
import { DataFreshness } from "../components/DataFreshness";
import { ErrorState, TableSkeleton } from "../components/States";
import { mean, median } from "../services/stats";
import type { IndexEntry } from "../types";

type SortKey =
  | "address"
  | "opportunity_score"
  | "price"
  | "price_per_m2"
  | "net_yield"
  | "surface_m2"
  | "sale_date"
  | "dvf_gap_pct"
  | "district";

interface SortState {
  key: SortKey;
  dir: "asc" | "desc";
}

const MAX_COMPARE = 3;
const MAX_CARDS = 60;

type ViewMode = "cards" | "table";

export function Dashboard() {
  const { loading, error, data, reload } = useAsync(fetchIndex, []);

  const [search, setSearch] = useState("");
  const [district, setDistrict] = useState("all");
  const [onlyHighScore, setOnlyHighScore] = useState(false);
  const [onlyBelowDvf, setOnlyBelowDvf] = useState(false);
  const [onlyResold, setOnlyResold] = useState(false);
  const [maxPrice, setMaxPrice] = useState(0); // 0 = any
  const [minRooms, setMinRooms] = useState(0);
  const [minYield, setMinYield] = useState(0);
  const [sort, setSort] = useState<SortState>({ key: "opportunity_score", dir: "desc" });
  const [selected, setSelected] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [view, setView] = useState<ViewMode>("cards");

  const entries = data?.properties ?? [];
  const ids = useMemo(() => entries.map((e) => e.id), [entries]);

  const districts = useMemo(() => {
    const set = new Set(entries.map((e) => e.district));
    return [...set].sort();
  }, [entries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = entries.filter((e) => {
      if (district !== "all" && e.district !== district) return false;
      if (onlyHighScore && e.opportunity_score < 68) return false;
      if (onlyBelowDvf && !(e.dvf_gap_pct !== null && e.dvf_gap_pct >= 10)) return false;
      if (onlyResold && e.resale_change_pct === null) return false;
      if (maxPrice && e.price > maxPrice) return false;
      if (minRooms && e.rooms < minRooms) return false;
      if (minYield && (e.net_yield === null || e.net_yield < minYield)) return false;
      if (q && !e.address.toLowerCase().includes(q)) return false;
      return true;
    });

    const { key, dir } = sort;
    const factor = dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      // Unknown values (no rent data, no comparables) always sort last.
      if (av === null || bv === null) return av === bv ? 0 : av === null ? 1 : -1;
      if (typeof av === "string" && typeof bv === "string") {
        return av.localeCompare(bv) * factor;
      }
      return ((av as number) - (bv as number)) * factor;
    });
    return rows;
  }, [entries, search, district, onlyHighScore, onlyBelowDvf, onlyResold, maxPrice, minRooms, minYield, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "district" ? "asc" : "desc" },
    );

  const toggleSelect = (id: string) =>
    setSelected((cur) =>
      cur.includes(id)
        ? cur.filter((x) => x !== id)
        : cur.length < MAX_COMPARE
          ? [...cur, id]
          : cur,
    );

  if (loading && !data)
    return (
      <section>
        <div className="page-head">
          <h1>Dashboard</h1>
        </div>
        <TableSkeleton rows={9} cols={8} />
      </section>
    );
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const compareRows = entries.filter((e) => selected.includes(e.id));

  const yields = entries.map((e) => e.net_yield).filter((y): y is number => y !== null);
  const kpis = [
    { label: "Real sales", value: String(entries.length), rail: "primary" },
    { label: "Opportunities", value: String(entries.filter((e) => e.opportunity_score >= 68).length), rail: "good" },
    { label: "Median €/m²", value: formatPerM2(Math.round(median(entries.map((e) => e.price_per_m2)))), rail: "" },
    { label: "Median net yield", value: yields.length ? `${median(yields).toFixed(1)}%` : NA, rail: "warn" },
    { label: "Avg score", value: String(Math.round(mean(entries.map((e) => e.opportunity_score)))), rail: "primary" },
  ];

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="muted" aria-live="polite">
            Showing <strong>{filtered.length}</strong> of {entries.length} real apartment sales
            {data?.dvf && <> · DVF through {formatDate(data.dvf.last_sale)}</>}
          </p>
        </div>
        <div className="head-actions">
          <DataFreshness generatedAt={data?.generated_at} dvfThrough={data?.dvf.last_sale} currentIds={ids} />
          <button className="btn" onClick={() => downloadCsv(filtered)}>
            <Icon name="download" size={15} /> Export CSV
          </button>
        </div>
      </div>

      <div className="kpi-strip">
        {kpis.map((k) => (
          <div className={`kpi ${k.rail ? `kpi-${k.rail}` : ""}`} key={k.label}>
            <span className="kpi-label">{k.label}</span>
            <span className={`kpi-value ${k.rail === "good" ? "accent-good" : ""}`}>{k.value}</span>
          </div>
        ))}
      </div>

      <div className="filters">
        <input
          className="input"
          placeholder="Search address…"
          aria-label="Search by address"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input"
          aria-label="Filter by arrondissement"
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
        >
          <option value="all">All arrondissements</option>
          {districts.map((d) => (
            <option key={d} value={d}>
              {districtLabel(d)} ({d})
            </option>
          ))}
        </select>
        <select
          className="input"
          aria-label="Maximum budget"
          value={maxPrice}
          onChange={(e) => setMaxPrice(Number(e.target.value))}
        >
          <option value="0">Any budget</option>
          <option value="300000">≤ 300 k€</option>
          <option value="500000">≤ 500 k€</option>
          <option value="750000">≤ 750 k€</option>
          <option value="1000000">≤ 1 M€</option>
        </select>
        <select
          className="input"
          aria-label="Minimum rooms"
          value={minRooms}
          onChange={(e) => setMinRooms(Number(e.target.value))}
        >
          <option value="0">Any size</option>
          <option value="1">1+ room</option>
          <option value="2">2+ rooms</option>
          <option value="3">3+ rooms</option>
          <option value="4">4+ rooms</option>
        </select>
        <select
          className="input"
          aria-label="Minimum net yield"
          value={minYield}
          onChange={(e) => setMinYield(Number(e.target.value))}
        >
          <option value="0">Any yield</option>
          <option value="3">≥ 3% net</option>
          <option value="4">≥ 4% net</option>
          <option value="5">≥ 5% net</option>
        </select>
        <button
          className={`chip ${onlyHighScore ? "on" : ""}`}
          aria-pressed={onlyHighScore}
          onClick={() => setOnlyHighScore((v) => !v)}
        >
          <Icon name="star" size={13} /> High score
        </button>
        <button
          className={`chip ${onlyBelowDvf ? "on" : ""}`}
          aria-pressed={onlyBelowDvf}
          onClick={() => setOnlyBelowDvf((v) => !v)}
          title="Sold at least 10% below the local DVF average"
        >
          <Icon name="arrow-down" size={13} /> ≥10% below DVF
        </button>
        <button
          className={`chip ${onlyResold ? "on" : ""}`}
          aria-pressed={onlyResold}
          onClick={() => setOnlyResold((v) => !v)}
          title="An earlier DVF sale of the same lot exists"
        >
          <Icon name="clock" size={13} /> Resold
        </button>
        <select
          className="input"
          aria-label="Sort sales"
          value={`${sort.key}:${sort.dir}`}
          onChange={(e) => {
            const [key, dir] = e.target.value.split(":") as [SortKey, "asc" | "desc"];
            setSort({ key, dir });
          }}
        >
          <option value="opportunity_score:desc">Sort: Best score</option>
          <option value="net_yield:desc">Sort: Highest yield</option>
          <option value="dvf_gap_pct:desc">Sort: Biggest DVF discount</option>
          <option value="sale_date:desc">Sort: Most recent sale</option>
          <option value="price:asc">Sort: Price ↑</option>
          <option value="price:desc">Sort: Price ↓</option>
          <option value="price_per_m2:asc">Sort: €/m² ↑</option>
          <option value="surface_m2:desc">Sort: Surface ↓</option>
        </select>
        <div className="view-toggle" role="group" aria-label="View mode">
          <button
            type="button"
            className={view === "cards" ? "on" : ""}
            aria-pressed={view === "cards"}
            onClick={() => setView("cards")}
          >
            ▦ Cards
          </button>
          <button
            type="button"
            className={view === "table" ? "on" : ""}
            aria-pressed={view === "table"}
            onClick={() => setView("table")}
          >
            ≣ Table
          </button>
        </div>
      </div>

      {view === "cards" ? (
        <>
          {filtered.length === 0 ? (
            <p className="state" role="status">
              No sales match these filters.
            </p>
          ) : (
            <>
              <div className="card-grid">
                {filtered.slice(0, MAX_CARDS).map((e) => (
                  <PropertyCard key={e.id} entry={e} />
                ))}
              </div>
              {filtered.length > MAX_CARDS && (
                <p className="card-grid-note" role="status">
                  Showing {MAX_CARDS} of {filtered.length} — refine filters or switch to Table.
                </p>
              )}
            </>
          )}
        </>
      ) : (
        <div className="table-scroll">
        <table className="data-table listings-table">
          <thead>
            <tr>
              <th className="col-check"></th>
              <th className="col-thumb"></th>
              <SortableTh label="Address" k="address" sort={sort} onClick={toggleSort} />
              <SortableTh label="Arr." k="district" sort={sort} onClick={toggleSort} />
              <SortableTh label="Sold" k="sale_date" sort={sort} onClick={toggleSort} />
              <SortableTh label="Price" k="price" sort={sort} onClick={toggleSort} />
              <SortableTh label="€/m²" k="price_per_m2" sort={sort} onClick={toggleSort} />
              <SortableTh label="vs DVF" k="dvf_gap_pct" sort={sort} onClick={toggleSort} />
              <SortableTh label="Net yield" k="net_yield" sort={sort} onClick={toggleSort} />
              <SortableTh label="Surface" k="surface_m2" sort={sort} onClick={toggleSort} />
              <th>DPE</th>
              <th>History</th>
              <SortableTh label="Score" k="opportunity_score" sort={sort} onClick={toggleSort} />
              <th>Signal</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id}>
                <td className="col-check">
                  <input
                    type="checkbox"
                    checked={selected.includes(e.id)}
                    onChange={() => toggleSelect(e.id)}
                    aria-label="Select for comparison"
                  />
                </td>
                <td className="col-thumb">
                  <Link to={`/property/${e.id}`} className="thumb-link" aria-label={e.address}>
                    <Img src={e.image} alt="" className="row-thumb" />
                    <LocationPin src={e.image} />
                  </Link>
                </td>
                <td className="col-address">
                  <Link to={`/property/${e.id}`}>{e.address}</Link>
                </td>
                <td>{districtLabel(e.district)}</td>
                <td className="num">{formatDate(e.sale_date)}</td>
                <td className="num">{formatEuro(e.price)}</td>
                <td className="num">{formatPerM2(e.price_per_m2)}</td>
                <td className="num" title="Gap vs the local DVF average (+ = cheaper)">
                  {e.dvf_gap_pct === null ? NA : `${e.dvf_gap_pct > 0 ? "−" : "+"}${Math.abs(e.dvf_gap_pct).toFixed(1)}%`}
                </td>
                <td className="num"><YieldCell net={e.net_yield} /></td>
                <td className="num">{e.surface_m2} m²</td>
                <td>
                  {e.dpe_energy && (
                    <span className={`dpe-chip dpe-${e.dpe_energy}`}>{e.dpe_energy}</span>
                  )}
                </td>
                <td>
                  <Sparkline values={e.spark} />
                </td>
                <td>
                  <ScoreBar score={e.opportunity_score} />
                </td>
                <td>
                  <Badge badge={e.badge} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="state" role="status">
            No sales match these filters.
          </p>
        )}
      </div>
      )}

      {selected.length > 0 && (
        <div className="compare-bar">
          <span>{selected.length} selected</span>
          <button className="btn small" onClick={() => setShowCompare((v) => !v)}>
            {showCompare ? "Hide comparison" : "Compare"}
          </button>
          <button className="btn small ghost" onClick={() => setSelected([])}>
            Clear
          </button>
        </div>
      )}

      {showCompare && compareRows.length > 0 && <ComparePanel rows={compareRows} />}
    </section>
  );
}

function SortableTh({
  label,
  k,
  sort,
  onClick,
}: {
  label: string;
  k: SortKey;
  sort: SortState;
  onClick: (k: SortKey) => void;
}) {
  const active = sort.key === k;
  const ariaSort = active ? (sort.dir === "asc" ? "ascending" : "descending") : "none";
  return (
    <th className={`sortable ${active ? "active" : ""}`} aria-sort={ariaSort}>
      <button type="button" className="th-sort" onClick={() => onClick(k)}>
        {label}
        <span className="sort-caret">{active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
}

function ComparePanel({ rows }: { rows: IndexEntry[] }) {
  const metrics: Array<{ label: string; render: (e: IndexEntry) => string }> = [
    { label: "Arrondissement", render: (e) => districtLabel(e.district) },
    { label: "Sale date", render: (e) => formatDate(e.sale_date) },
    { label: "Price", render: (e) => formatEuro(e.price) },
    { label: "€/m²", render: (e) => formatPerM2(e.price_per_m2) },
    { label: "Gap vs local DVF", render: (e) => (e.dvf_gap_pct === null ? NA : `${e.dvf_gap_pct}%`) },
    { label: "Surface", render: (e) => `${e.surface_m2} m²` },
    { label: "Rooms", render: (e) => String(e.rooms) },
    { label: "Opportunity score", render: (e) => String(e.opportunity_score) },
    { label: "Net yield", render: (e) => formatPct(e.net_yield) },
    { label: "DPE", render: (e) => (e.dpe_energy ? `${e.dpe_energy}${e.dpe_scope === "building" ? " (building)" : ""}` : NA) },
    { label: "Resale change", render: (e) => formatPct(e.resale_change_pct) },
  ];

  return (
    <div className="compare-panel">
      <h2>Comparison</h2>
      <table className="compare-table">
        <thead>
          <tr>
            <th></th>
            {rows.map((e) => (
              <th key={e.id}>
                <Link to={`/property/${e.id}`}>{e.address}</Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {metrics.map((m) => (
            <tr key={m.label}>
              <td className="metric-label">{m.label}</td>
              {rows.map((e) => (
                <td key={e.id} className="num">
                  {m.render(e)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
