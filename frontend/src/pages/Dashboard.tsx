/**
 * PAGE 1 — Dashboard.
 * Sortable / filterable table of every tracked listing, with mini sparklines,
 * opportunity scores, badges, CSV export and a side-by-side comparison panel.
 */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAsync } from "../hooks/useAsync";
import { fetchIndex } from "../services/data";
import {
  districtLabel,
  formatEuro,
  formatPerM2,
  STATUS_LABEL,
} from "../services/format";
import { downloadCsv } from "../services/csv";
import { Sparkline } from "../components/Sparkline";
import { ScoreBar } from "../components/ScoreBar";
import { Badge } from "../components/Badge";
import type { IndexEntry } from "../types";

type SortKey =
  | "opportunity_score"
  | "current_price"
  | "price_per_m2"
  | "surface_m2"
  | "days_on_market"
  | "price_drops"
  | "district";

interface SortState {
  key: SortKey;
  dir: "asc" | "desc";
}

const MAX_COMPARE = 3;

export function Dashboard() {
  const { loading, error, data } = useAsync(fetchIndex, []);

  const [search, setSearch] = useState("");
  const [district, setDistrict] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"active" | "all">("active");
  const [onlyHighScore, setOnlyHighScore] = useState(false);
  const [onlyDrops, setOnlyDrops] = useState(false);
  const [onlyLongMarket, setOnlyLongMarket] = useState(false);
  const [sort, setSort] = useState<SortState>({ key: "opportunity_score", dir: "desc" });
  const [selected, setSelected] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);

  const entries = data?.properties ?? [];

  const districts = useMemo(() => {
    const set = new Set(entries.map((e) => e.district));
    return [...set].sort();
  }, [entries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = entries.filter((e) => {
      if (statusFilter === "active" && e.status !== "active") return false;
      if (district !== "all" && e.district !== district) return false;
      if (onlyHighScore && e.opportunity_score < 68) return false;
      if (onlyDrops && e.price_drops < 1) return false;
      if (onlyLongMarket && !e.long_time_on_market) return false;
      if (q && !e.address.toLowerCase().includes(q)) return false;
      return true;
    });

    const { key, dir } = sort;
    const factor = dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (typeof av === "string" && typeof bv === "string") {
        return av.localeCompare(bv) * factor;
      }
      return ((av as number) - (bv as number)) * factor;
    });
    return rows;
  }, [entries, search, district, statusFilter, onlyHighScore, onlyDrops, onlyLongMarket, sort]);

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

  if (loading) return <p className="state">Loading listings…</p>;
  if (error) return <p className="state error">Failed to load data: {error.message}</p>;

  const compareRows = entries.filter((e) => selected.includes(e.id));

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">
            {filtered.length} of {entries.length} listings ·{" "}
            {data && `updated ${new Date(data.generated_at).toLocaleString("fr-FR")}`}
          </p>
        </div>
        <button className="btn" onClick={() => downloadCsv(filtered)}>
          ⬇ Export CSV
        </button>
      </div>

      <div className="filters">
        <input
          className="input"
          placeholder="Search address…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input" value={district} onChange={(e) => setDistrict(e.target.value)}>
          <option value="all">All arrondissements</option>
          {districts.map((d) => (
            <option key={d} value={d}>
              {districtLabel(d)} ({d})
            </option>
          ))}
        </select>
        <select
          className="input"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "active" | "all")}
        >
          <option value="active">Active only</option>
          <option value="all">All statuses</option>
        </select>
        <button
          className={`chip ${onlyHighScore ? "on" : ""}`}
          onClick={() => setOnlyHighScore((v) => !v)}
        >
          🔥 High score
        </button>
        <button className={`chip ${onlyDrops ? "on" : ""}`} onClick={() => setOnlyDrops((v) => !v)}>
          ↓ Price drops
        </button>
        <button
          className={`chip ${onlyLongMarket ? "on" : ""}`}
          onClick={() => setOnlyLongMarket((v) => !v)}
        >
          ⏳ Long on market
        </button>
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th className="col-check"></th>
              <th>Address</th>
              <SortableTh label="Arr." k="district" sort={sort} onClick={toggleSort} />
              <SortableTh label="Price" k="current_price" sort={sort} onClick={toggleSort} />
              <SortableTh label="€/m²" k="price_per_m2" sort={sort} onClick={toggleSort} />
              <SortableTh label="Surface" k="surface_m2" sort={sort} onClick={toggleSort} />
              <SortableTh label="DOM" k="days_on_market" sort={sort} onClick={toggleSort} />
              <th>Trend</th>
              <SortableTh label="Score" k="opportunity_score" sort={sort} onClick={toggleSort} />
              <th>Signal</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id} className={e.status !== "active" ? "row-inactive" : ""}>
                <td className="col-check">
                  <input
                    type="checkbox"
                    checked={selected.includes(e.id)}
                    onChange={() => toggleSelect(e.id)}
                    aria-label="Select for comparison"
                  />
                </td>
                <td className="col-address">
                  <Link to={`/property/${e.id}`}>{e.address}</Link>
                  {e.status !== "active" && (
                    <span className="status-pill">{STATUS_LABEL[e.status]}</span>
                  )}
                </td>
                <td>{districtLabel(e.district)}</td>
                <td className="num">{formatEuro(e.current_price)}</td>
                <td className="num">{formatPerM2(e.price_per_m2)}</td>
                <td className="num">{e.surface_m2} m²</td>
                <td className="num">{e.days_on_market} d</td>
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
        {filtered.length === 0 && <p className="state">No listings match these filters.</p>}
      </div>

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
  return (
    <th className={`sortable ${active ? "active" : ""}`} onClick={() => onClick(k)}>
      {label}
      <span className="sort-caret">{active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}</span>
    </th>
  );
}

function ComparePanel({ rows }: { rows: IndexEntry[] }) {
  const metrics: Array<{ label: string; render: (e: IndexEntry) => string }> = [
    { label: "Arrondissement", render: (e) => districtLabel(e.district) },
    { label: "Price", render: (e) => formatEuro(e.current_price) },
    { label: "€/m²", render: (e) => formatPerM2(e.price_per_m2) },
    { label: "Surface", render: (e) => `${e.surface_m2} m²` },
    { label: "Rooms", render: (e) => String(e.rooms) },
    { label: "Opportunity score", render: (e) => String(e.opportunity_score) },
    { label: "Price drops", render: (e) => String(e.price_drops) },
    { label: "Total drop", render: (e) => `${e.total_drop_percent}%` },
    { label: "Days on market", render: (e) => `${e.days_on_market} d` },
    { label: "Status", render: (e) => STATUS_LABEL[e.status] ?? e.status },
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
