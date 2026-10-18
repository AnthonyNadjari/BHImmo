/**
 * Market model page — how Paris prices actually moved, from every DVF
 * apartment sale: the quarterly median €/m² (Paris vs one arrondissement),
 * repeat sales of the same lot (a quality-adjusted trend), per-arrondissement
 * and per-quartier tables, INSEE / noise context — plus the provenance of every
 * data source used by this run.
 */

import { useMemo, useState } from "react";
import { useAsync } from "../hooks/useAsync";
import { fetchMarket } from "../services/data";
import { DataFreshness } from "../components/DataFreshness";
import { Empty, ErrorState, Loading } from "../components/States";
import { LineChart } from "../components/LineChart";
import { Sparkline } from "../components/Sparkline";
import type { MarketQuartier } from "../types";
import {
  districtLabel,
  formatDate,
  formatIncome,
  formatNumber,
  formatPercent,
  formatPerM2,
  NA,
  scoreColor,
} from "../services/format";

type QSort = "trend_pct" | "median_price_m2" | "sales_12m";

export function Market() {
  const { loading, error, data, reload } = useAsync(fetchMarket, []);
  const [compare, setCompare] = useState("75011");
  const [qSort, setQSort] = useState<{ key: QSort; dir: 1 | -1 }>({ key: "trend_pct", dir: -1 });

  const quartiers = useMemo(() => {
    const list = [...(data?.quartiers ?? [])];
    const { key, dir } = qSort;
    return list.sort((a: MarketQuartier, b: MarketQuartier) => {
      const av = a[key];
      const bv = b[key];
      if (av === null || bv === null) return av === bv ? 0 : av === null ? 1 : -1;
      return (av - bv) * dir;
    });
  }, [data, qSort]);

  if (loading && !data) return <Loading label="Loading market model…" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data || data.arrondissements.length === 0)
    return <Empty>No market data available yet.</Empty>;

  const rows = [...data.arrondissements].sort(
    (a, b) => b.avg_opportunity_score - a.avg_opportunity_score,
  );
  const maxVol = Math.max(...rows.map((r) => r.volatility), 0.001);
  const year = data.latest_year;
  const prevYear = String(Number(year) - 1);

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Market model</h1>
          <p className="muted">
            Paris DVF median {formatPerM2(data.city_median_price_m2)} in {year}
            {data.city_trend_1y !== null && <> ({formatPercent(data.city_trend_1y)} vs {prevYear})</>} ·{" "}
            {formatNumber(data.dvf.sales)} apartment sales {data.dvf.vintages[0]}–{year}
          </p>
        </div>
        <DataFreshness generatedAt={data.generated_at} dvfThrough={data.dvf.last_sale} />
      </div>

      <div className="card">
        <div className="card-head-row">
          <h2>Price per m² since {data.dvf.vintages[0]}</h2>
          <select className="input" aria-label="Compare with an arrondissement" value={compare} onChange={(e) => setCompare(e.target.value)}>
            {data.arrondissements.map((a) => (
              <option key={a.district} value={a.district}>
                vs {districtLabel(a.district)} — {a.name}
              </option>
            ))}
          </select>
        </div>
        <LineChart
          series={[
            { id: "paris", label: "Paris", color: "var(--series-1)", points: data.paris_index },
            ...data.arrondissements
              .filter((a) => a.district === compare)
              .map((a) => ({ id: a.district, label: `${districtLabel(a.district)} arr.`, color: "var(--series-2)", points: a.index })),
          ]}
          height={260}
          ariaLabel="Quarterly median price per m² of apartment sales, Paris and the selected arrondissement"
        />
        <p className="data-note">
          Quarterly median €/m² of every clean single-apartment DVF sale. Hover for the number of sales per quarter.
          {data.paris_repeat_sales && (
            <>
              {" "}
              <strong>Repeat sales</strong> (same apartment sold twice, held ≥ 1 year, {formatNumber(data.paris_repeat_sales.pairs)} pairs):
              median {formatPercent(data.paris_repeat_sales.median_annual_pct)}/yr, {data.paris_repeat_sales.share_gain_pct}% resold above
              their previous price — includes any renovation done between the two sales.
            </>
          )}
        </p>
      </div>

      <h2 style={{ marginTop: 28 }}>Arrondissements</h2>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Arr.</th>
              <th>Name</th>
              <th title={`Clean single-apartment DVF sales in ${year}`}>Sales {year}</th>
              <th title={`Median €/m² of all DVF apartment sales in ${year}`}>Median €/m²</th>
              <th title={`DVF median €/m² ${year} vs ${prevYear}`}>YoY</th>
              <th title="Quarterly median €/m² since the first DVF vintage">Since {data.dvf.vintages[0]}</th>
              <th title="Median annualised change of the same apartments sold twice (≥ 1 year apart)">Repeat sales</th>
              <th title="Coefficient of variation of DVF €/m²">Volatility</th>
              <th title="INSEE municipal population / Ville de Paris area">Density</th>
              <th title="INSEE FiLoSoFi — median standard of living">Income</th>
              <th title="Share of residents above the road-noise Lden threshold">Road noise</th>
              <th>Walk</th>
              <th title="Median gross yield of the sales shown, at the legal rent ceiling">Yield</th>
              <th>Avg score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.district}>
                <td>{districtLabel(r.district)}</td>
                <td>{r.name}</td>
                <td className="num">{formatNumber(r.sales_latest_year)}</td>
                <td className="num">{formatPerM2(r.median_price_m2)}</td>
                <td
                  className="num"
                  style={{
                    color:
                      r.trend_1y_percent === null ? undefined : r.trend_1y_percent < 0 ? "var(--danger)" : "var(--success)",
                  }}
                  title={r.prev_median_price_m2 ? `${prevYear}: ${formatPerM2(r.prev_median_price_m2)}` : undefined}
                >
                  {r.trend_1y_percent === null ? NA : formatPercent(r.trend_1y_percent)}
                </td>
                <td>
                  <Sparkline values={r.index.map((p) => p.median)} label={`median €/m² since ${data.dvf.vintages[0]}`} />
                </td>
                <td className="num" title={r.repeat_sales ? `${r.repeat_sales.pairs} pairs` : undefined}>
                  {r.repeat_sales ? `${formatPercent(r.repeat_sales.median_annual_pct)}/yr` : NA}
                </td>
                <td className="num">
                  <div className="vol-cell">
                    <div className="vol-track">
                      <div className="vol-fill" style={{ width: `${(r.volatility / maxVol) * 100}%` }} />
                    </div>
                    {r.volatility.toFixed(3)}
                  </div>
                </td>
                <td className="num">{r.density === null ? NA : `${formatNumber(r.density)}/km²`}</td>
                <td className="num">{r.median_income === null ? NA : formatIncome(r.median_income)}</td>
                <td className="num">{r.noise_exposed_pct === null ? NA : `${r.noise_exposed_pct}%`}</td>
                <td className="num">{r.avg_walk_score ?? NA}</td>
                <td className="num">{r.median_yield === null ? NA : `${r.median_yield.toFixed(1)}%`}</td>
                <td className="num">
                  <span className="score-pill" style={{ background: scoreColor(r.avg_opportunity_score) }}>
                    {r.avg_opportunity_score}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="data-note">
        Paris Centre (1er–4e) is published as one area for road noise. Score, walk and yield columns describe the{" "}
        {rows.reduce((s, r) => s + r.listing_count, 0)} sales shown; prices and trends use every DVF apartment sale.
      </p>

      {quartiers.length > 0 && (
        <>
          <h2 style={{ marginTop: 28 }}>Quartiers</h2>
          <p className="muted">
            The 80 quartiers administratifs: median €/m² of the last 4 quarters of DVF sales vs the 4 before (≥ 10 sales
            each), and the 2-room pre-1946 reference rent.
          </p>
          <div className="table-scroll">
            <table className="data-table compact">
              <thead>
                <tr>
                  <th>Quartier</th>
                  <th>Arr.</th>
                  <QTh label="Median €/m²" k="median_price_m2" sort={qSort} onSort={setQSort} />
                  <QTh label="12-month change" k="trend_pct" sort={qSort} onSort={setQSort} />
                  <QTh label="Sales (12 m)" k="sales_12m" sort={qSort} onSort={setQSort} />
                  <th title="Encadrement des loyers — reference rent, 2 rooms, pre-1946, unfurnished">Ref. rent</th>
                </tr>
              </thead>
              <tbody>
                {quartiers.map((q) => (
                  <tr key={q.id}>
                    <td>{q.name}</td>
                    <td>{districtLabel(q.district)}</td>
                    <td className="num">{q.median_price_m2 === null ? NA : formatPerM2(q.median_price_m2)}</td>
                    <td
                      className="num"
                      style={{ color: q.trend_pct === null ? undefined : q.trend_pct < 0 ? "var(--danger)" : "var(--success)" }}
                    >
                      {q.trend_pct === null ? NA : formatPercent(q.trend_pct)}
                    </td>
                    <td className="num">{formatNumber(q.sales_12m)}</td>
                    <td className="num">{q.rent_ref_m2 === null ? NA : `${q.rent_ref_m2} €/m²`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2 style={{ marginTop: 28 }}>Sources</h2>
      <p className="muted">
        Every number in this app comes from these open datasets. DVF covers sales from{" "}
        {formatDate(data.dvf.first_sale)} to {formatDate(data.dvf.last_sale)}; when a source is unavailable the
        affected fields stay empty or keep their last real value.
      </p>
      <div className="table-scroll">
        <table className="data-table compact">
          <thead>
            <tr>
              <th>Source</th>
              <th>Status</th>
              <th>Records</th>
              <th>Period</th>
            </tr>
          </thead>
          <tbody>
            {data.sources.map((s) => (
              <tr key={s.id}>
                <td>
                  <a href={s.url} target="_blank" rel="noreferrer noopener">
                    {s.label} ↗
                  </a>
                </td>
                <td>
                  <span className={`source-status ${s.status}`}>
                    {s.status === "ok" ? "loaded" : s.status === "stale" ? "last run's values" : "unavailable"}
                  </span>
                </td>
                <td className="num">{formatNumber(s.records)}</td>
                <td>{s.period ?? NA}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function QTh({
  label,
  k,
  sort,
  onSort,
}: {
  label: string;
  k: QSort;
  sort: { key: QSort; dir: 1 | -1 };
  onSort: (s: { key: QSort; dir: 1 | -1 }) => void;
}) {
  const active = sort.key === k;
  return (
    <th className={`sortable ${active ? "active" : ""}`} aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" className="th-sort" onClick={() => onSort({ key: k, dir: active ? (sort.dir === 1 ? -1 : 1) : -1 })}>
        {label}
        <span className="sort-caret">{active ? (sort.dir === 1 ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
}
