/**
 * Market model page. Per-arrondissement aggregates from market.json:
 * average / median €/m², DVF reference, 1-year trend, volatility and the
 * average opportunity score.
 */

import { useAsync } from "../hooks/useAsync";
import { fetchMarket } from "../services/data";
import { districtLabel, formatPercent, formatPerM2, scoreColor } from "../services/format";

export function Market() {
  const { loading, error, data } = useAsync(fetchMarket, []);

  if (loading) return <p className="state">Loading market model…</p>;
  if (error) return <p className="state error">Failed to load: {error.message}</p>;
  if (!data) return null;

  const rows = [...data.arrondissements].sort(
    (a, b) => b.avg_opportunity_score - a.avg_opportunity_score,
  );
  const maxVol = Math.max(...rows.map((r) => r.volatility), 0.001);

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Market model</h1>
          <p className="muted">
            City average {formatPerM2(data.city_avg_price_m2)} ·{" "}
            {rows.length} arrondissements with active listings
          </p>
        </div>
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Arr.</th>
              <th>Name</th>
              <th>Listings</th>
              <th>Avg €/m²</th>
              <th>Median €/m²</th>
              <th>DVF €/m²</th>
              <th>Trend 1Y</th>
              <th>Volatility</th>
              <th>Avg score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.district}>
                <td>{districtLabel(r.district)}</td>
                <td>{r.name}</td>
                <td className="num">{r.listing_count}</td>
                <td className="num">{formatPerM2(r.avg_price_m2)}</td>
                <td className="num">{formatPerM2(r.median_price_m2)}</td>
                <td className="num">{formatPerM2(r.dvf_avg_price_m2)}</td>
                <td className="num" style={{ color: r.trend_1y_percent < 0 ? "#b03a3a" : "#1a8a4a" }}>
                  {formatPercent(r.trend_1y_percent)}
                </td>
                <td className="num">
                  <div className="vol-cell">
                    <div className="vol-track">
                      <div
                        className="vol-fill"
                        style={{ width: `${(r.volatility / maxVol) * 100}%` }}
                      />
                    </div>
                    {r.volatility.toFixed(3)}
                  </div>
                </td>
                <td className="num">
                  <span
                    className="score-pill"
                    style={{ background: scoreColor(r.avg_opportunity_score) }}
                  >
                    {r.avg_opportunity_score}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
