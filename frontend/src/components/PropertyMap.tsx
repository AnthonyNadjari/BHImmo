/**
 * Interactive opportunity map (Leaflet + Plan IGN tiles from the Géoplateforme, no key).
 * Two layers, toggleable:
 *  - "Sales": the real DVF transactions clustered (leaflet.markercluster),
 *    score-colored, with detail popups.
 *  - "€/m² by quartier" / "12-month change": choropleths of the 80 quartiers
 *    administratifs (official polygons) from every DVF sale — a sequential
 *    blue ramp for price level, a diverging red ↔ blue ramp (gray = flat) for
 *    the change. Hover a quartier for its figures.
 * Default export so it can be React.lazy-loaded.
 */

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "../mapquartier.css";
import { districtLabel, escapeHtml, formatEuro, formatMonth, formatPerM2, scoreColor } from "../services/format";
import { thumbFor } from "../services/imagery";
import type { IndexEntry, MarketQuartier } from "../types";
import type { QuartierGeoJson } from "../services/data";

const PARIS: [number, number] = [48.8566, 2.3522];

function popupHtml(e: IndexEntry): string {
  const color = scoreColor(e.opportunity_score);
  return (
    `<div class="map-popup">` +
    `<a class="map-popup-thumb" href="#/property/${e.id}"><img class="map-popup-img" src="${thumbFor(e)}" alt="" referrerpolicy="no-referrer" loading="lazy"/></a>` +
    `<a class="map-popup-title" href="#/property/${e.id}">${escapeHtml(e.address)}</a>` +
    `<div class="map-popup-meta">${districtLabel(e.district)} · ${formatEuro(e.price)} · ${formatPerM2(e.price_per_m2)} · sold ${formatMonth(e.sale_date)}</div>` +
    `<div class="map-popup-foot">` +
    `<span class="map-popup-score" style="color:${color}">Score ${e.opportunity_score}</span>` +
    (e.net_yield === null ? "" : `<span style="color:#0e9488">${e.net_yield.toFixed(1)}% net</span>`) +
    `</div></div>`
  );
}

function ClusterLayer({ entries }: { entries: IndexEntry[] }) {
  const map = useMap();
  useEffect(() => {
    const cluster = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 55,
      showCoverageOnHover: false,
      iconCreateFunction: (c) => {
        const n = c.getChildCount();
        const size = n < 10 ? 34 : n < 100 ? 40 : 48;
        return L.divIcon({
          html: `<span>${n}</span>`,
          className: "prer-cluster",
          iconSize: L.point(size, size),
        });
      },
    });
    for (const e of entries) {
      const m = L.circleMarker([e.lat, e.lng], {
        radius: 5 + (e.opportunity_score / 100) * 7,
        color: "#ffffff",
        weight: 1.5,
        fillColor: scoreColor(e.opportunity_score),
        fillOpacity: 0.92,
      });
      m.bindPopup(popupHtml(e), { minWidth: 180 });
      cluster.addLayer(m);
    }
    map.addLayer(cluster);
    return () => {
      map.removeLayer(cluster);
    };
  }, [map, entries]);
  return null;
}

/** Sequential blue ramp (light → dark) for €/m² level. */
const SEQ = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"];
/** Diverging ramp: falls (red arm) ← gray (flat) → rises (blue arm). */
const DIV = ["#b8302f", "#e8776c", "#f6c4bd", "#f0efec", "#b7d3f6", "#6da7ec", "#256abf"];
const DIV_BREAKS = [-4, -1.5, -0.5, 0.5, 1.5, 4];
const NO_DATA = "#e2e4ea";

type Choro = "price" | "trend";

function quantileBreaks(values: number[], bins: number): number[] {
  const v = [...values].sort((a, b) => a - b);
  return Array.from({ length: bins - 1 }, (_, i) => v[Math.floor(((i + 1) / bins) * v.length)]!);
}
const binOf = (v: number, breaks: number[]) => breaks.filter((b) => v >= b).length;

function ChoroplethLayer({ geo, stats, mode, breaks }: { geo: QuartierGeoJson; stats: Map<string, MarketQuartier>; mode: Choro; breaks: number[] }) {
  const map = useMap();
  useEffect(() => {
    const layer = L.geoJSON(geo as GeoJSON.FeatureCollection, {
      style: (f) => {
        const q = stats.get(String(f?.properties?.id));
        const v = mode === "price" ? q?.median_price_m2 : q?.trend_pct;
        const fill = v === null || v === undefined ? NO_DATA : mode === "price" ? SEQ[binOf(v, breaks)]! : DIV[binOf(v, DIV_BREAKS)]!;
        return { fillColor: fill, fillOpacity: 0.78, color: "#ffffff", weight: 1.5 };
      },
      onEachFeature: (f, l) => {
        const q = stats.get(String(f.properties?.id));
        const name = escapeHtml(String(f.properties?.name ?? ""));
        const lines = q
          ? [
              `<b>${name}</b> · ${districtLabel(q.district)}`,
              q.median_price_m2 === null ? "Too few sales" : `Median ${formatPerM2(q.median_price_m2)} (${q.sales_12m} sales, 12 months)`,
              q.trend_pct === null ? "" : `12-month change ${q.trend_pct > 0 ? "+" : ""}${q.trend_pct}%`,
            ]
          : [`<b>${name}</b>`];
        l.bindTooltip(lines.filter(Boolean).join("<br/>"), { sticky: true });
        l.on("mouseover", () => (l as L.Path).setStyle({ weight: 3, color: "#0b0b0b" }));
        l.on("mouseout", () => (l as L.Path).setStyle({ weight: 1.5, color: "#ffffff" }));
      },
    });
    map.addLayer(layer);
    return () => {
      map.removeLayer(layer);
    };
  }, [map, geo, stats, mode, breaks]);
  return null;
}

function ChoroLegend({ mode, breaks }: { mode: Choro; breaks: number[] }) {
  const colors = mode === "price" ? SEQ : DIV;
  const cuts = mode === "price" ? breaks.map((b) => `${(b / 1000).toFixed(1)}k`) : DIV_BREAKS.map((b) => `${b > 0 ? "+" : ""}${b}%`);
  // One label per bin: "< a", "a – b", …, "≥ z".
  const labels = colors.map((_, i) => (i === 0 ? `< ${cuts[0]}` : i === cuts.length ? `≥ ${cuts[i - 1]}` : `${cuts[i - 1]} – ${cuts[i]}`));
  return (
    <div className="choro-legend" aria-label="Map legend">
      <span className="cap">{mode === "price" ? "Median €/m², last 12 months:" : "Change vs previous 12 months:"}</span>
      {colors.map((c, i) => (
        <span key={c} className="choro-item">
          <span className="swatch" style={{ background: c }} />
          {labels[i]}
        </span>
      ))}
      <span className="choro-item">
        <span className="swatch" style={{ background: NO_DATA }} /> too few sales
      </span>
    </div>
  );
}

function ScoreLegend() {
  return (
    <div className="scatter-legend">
      <span><i style={{ background: scoreColor(80) }} /> Score ≥ 68</span>
      <span><i style={{ background: scoreColor(55) }} /> 50–67</span>
      <span><i style={{ background: scoreColor(46) }} /> 45–49</span>
      <span><i style={{ background: scoreColor(30) }} /> &lt; 45</span>
    </div>
  );
}

export default function PropertyMap({
  entries,
  quartiers = [],
  geo,
}: {
  entries: IndexEntry[];
  quartiers?: MarketQuartier[];
  /** Quartier polygons; the choropleth layers are hidden without them. */
  geo?: QuartierGeoJson;
}) {
  const [mode, setMode] = useState<"sales" | Choro>("sales");
  const hasAreas = quartiers.length > 0 && !!geo;
  const stats = useMemo(() => new Map(quartiers.map((q) => [q.id, q])), [quartiers]);
  const breaks = useMemo(
    () => quantileBreaks(quartiers.map((q) => q.median_price_m2).filter((v): v is number => v !== null), SEQ.length),
    [quartiers],
  );

  return (
    <div className="map-shell">
      {hasAreas && (
        <div className="map-modes" role="group" aria-label="Map layer">
          <button className={mode === "sales" ? "on" : ""} onClick={() => setMode("sales")}>
            Sales
          </button>
          <button className={mode === "price" ? "on" : ""} onClick={() => setMode("price")}>
            €/m² by quartier
          </button>
          <button className={mode === "trend" ? "on" : ""} onClick={() => setMode("trend")}>
            12-month change
          </button>
        </div>
      )}
      <MapContainer center={PARIS} zoom={12} className="leaflet-map" scrollWheelZoom>
        <TileLayer
          attribution="&copy; IGN — Plan IGN"
          url="https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}"
          maxZoom={19}
        />
        {mode === "sales" ? (
          <ClusterLayer entries={entries} />
        ) : (
          <ChoroplethLayer geo={geo!} stats={stats} mode={mode} breaks={breaks} />
        )}
      </MapContainer>
      {mode === "sales" ? <ScoreLegend /> : <ChoroLegend mode={mode} breaks={breaks} />}
    </div>
  );
}
