/**
 * Interactive opportunity map (Leaflet + free Carto tiles, no key).
 * At ~1000 listings the markers are clustered (leaflet.markercluster) so the
 * city view stays legible and zooms down to individual score-colored points.
 * Default export so it can be React.lazy-loaded (keeps Leaflet off the
 * dashboard's initial bundle).
 */

import { useEffect } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { districtLabel, formatEuro, formatPerM2, scoreColor } from "../services/format";
import type { IndexEntry } from "../types";

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
      const r = 5 + (e.opportunity_score / 100) * 7;
      const m = L.circleMarker([e.lat, e.lng], {
        radius: r,
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

export default function PropertyMap({ entries }: { entries: IndexEntry[] }) {
  return (
    <MapContainer center={PARIS} zoom={12} className="leaflet-map" scrollWheelZoom>
      <TileLayer
        attribution="&copy; OpenStreetMap &copy; CARTO"
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      <ClusterLayer entries={entries} />
    </MapContainer>
  );
}
