/**
 * Interactive opportunity map (Leaflet + free Carto tiles, no key).
 * Two layers, toggleable:
 *  - "Listings": ~1000 real transactions clustered (leaflet.markercluster),
 *    score-colored, with detail popups.
 *  - "Prices": median €/m² per arrondissement from the market model, as colored
 *    chips at each arrondissement centroid (cheaper → teal, pricier → rose).
 * Default export so it can be React.lazy-loaded.
 */

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "../mapquartier.css";
import { districtLabel, formatEuro, formatPerM2, scoreColor } from "../services/format";
import type { IndexEntry, MarketArrondissement } from "../types";

const PARIS: [number, number] = [48.8566, 2.3522];

function popupHtml(e: IndexEntry): string {
  const color = scoreColor(e.opportunity_score);
  return (
    `<div class="map-popup">` +
    `<a class="map-popup-thumb" href="#/property/${e.id}"><img class="map-popup-img" src="${e.image}" alt="" referrerpolicy="no-referrer" loading="lazy"/></a>` +
    `<a class="map-popup-title" href="#/property/${e.id}">${e.address}</a>` +
    `<div class="map-popup-meta">${districtLabel(e.district)} · ${formatEuro(e.current_price)} · ${formatPerM2(e.price_per_m2)}</div>` +
    `<div class="map-popup-foot">` +
    `<span class="map-popup-score" style="color:${color}">Score ${e.opportunity_score}</span>` +
    `<span style="color:#0e9488">${e.net_yield.toFixed(1)}% net</span>` +
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

/** Color for a €/m² relative to the city average (cheaper → teal, pricier → rose). */
function priceColor(ppm2: number, cityAvg: number): string {
  const r = ppm2 / cityAvg;
  if (r < 0.85) return "#0e9488"; // notably cheaper
  if (r < 0.98) return "#2563eb"; // a bit below
  if (r < 1.12) return "#4f46e5"; // around average
  return "#e11d48"; // notably pricier
}

function AreaPriceLayer({
  arrondissements,
  cityAvg,
}: {
  arrondissements: MarketArrondissement[];
  cityAvg: number;
}) {
  const map = useMap();
  useEffect(() => {
    const group = L.layerGroup();
    for (const a of arrondissements) {
      if (!a.lat || !a.lng) continue;
      const color = priceColor(a.median_price_m2, cityAvg);
      const k = (a.median_price_m2 / 1000).toFixed(1);
      const icon = L.divIcon({
        className: "",
        html:
          `<div class="area-price" style="--c:${color}">` +
          `<b>${districtLabel(a.district)}</b>${k}k €/m²</div>`,
        iconSize: [0, 0],
      });
      const marker = L.marker([a.lat, a.lng], { icon, interactive: true });
      marker.bindTooltip(
        `${a.name} (${districtLabel(a.district)}) · median ${formatPerM2(a.median_price_m2)} · DVF ${formatPerM2(a.dvf_avg_price_m2)} · ${a.trend_1y_percent}%/yr`,
      );
      group.addLayer(marker);
    }
    map.addLayer(group);
    return () => {
      map.removeLayer(group);
    };
  }, [map, arrondissements, cityAvg]);
  return null;
}

export default function PropertyMap({
  entries,
  arrondissements = [],
  cityAvg = 11695,
}: {
  entries: IndexEntry[];
  arrondissements?: MarketArrondissement[];
  cityAvg?: number;
}) {
  const [mode, setMode] = useState<"listings" | "prices">("listings");
  const hasAreas = arrondissements.length > 0;

  return (
    <div className="map-shell">
      {hasAreas && (
        <div className="map-modes" role="group" aria-label="Map layer">
          <button className={mode === "listings" ? "on" : ""} onClick={() => setMode("listings")}>
            Listings
          </button>
          <button className={mode === "prices" ? "on" : ""} onClick={() => setMode("prices")}>
            €/m² by area
          </button>
        </div>
      )}
      <MapContainer center={PARIS} zoom={12} className="leaflet-map" scrollWheelZoom>
        <TileLayer
          attribution="&copy; OpenStreetMap &copy; CARTO"
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        {mode === "listings" ? (
          <ClusterLayer entries={entries} />
        ) : (
          <AreaPriceLayer arrondissements={arrondissements} cityAvg={cityAvg} />
        )}
      </MapContainer>
    </div>
  );
}
