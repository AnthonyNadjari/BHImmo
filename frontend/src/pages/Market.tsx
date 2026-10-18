/**
 * Market model page. Per-arrondissement aggregates from market.json — DVF
 * median €/m², year-over-year trend and volume computed from ALL the
 * arrondissement's apartment sales, INSEE population and income, road-noise
 * exposure — plus the provenance of every data source used by this run.
 */

import { useAsync } from "../hooks/useAsync";
import { fetchMarket } from "../services/data";
import { DataFreshness } from "../components/DataFreshness";
import { Empty, ErrorState, Loading } from "../components/States";
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

export function Market() {
  const { loading, error, data, reload } = useAsync(fetchMarket, []);

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

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Arr.</th>
              <th>Name</th>
              <th title={`Clean single-apartment DVF sales in ${year}`}>Sales {year}</th>
              <th title={`Median €/m² of all DVF apartment sales in ${year}`}>Median €/m²</th>
              <th title={`DVF median €/m² ${year} vs ${prevYear}`}>YoY</th>
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
