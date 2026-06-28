/**
 * Interactive opportunity map (Leaflet + free Carto tiles, no key).
 * Active listings as score-colored markers; click a marker for details.
 * Default export so it can be React.lazy-loaded (keeps Leaflet off the
 * dashboard's initial bundle).
 */

import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import { Link } from "react-router-dom";
import { Img } from "./Img";
import { districtLabel, formatEuro, formatPerM2, scoreColor } from "../services/format";
import type { IndexEntry } from "../types";

const PARIS: [number, number] = [48.8566, 2.3522];

export default function PropertyMap({ entries }: { entries: IndexEntry[] }) {
  // Best-scoring drawn last (on top).
  const sorted = [...entries].sort((a, b) => a.opportunity_score - b.opportunity_score);

  return (
    <MapContainer center={PARIS} zoom={12} className="leaflet-map" scrollWheelZoom>
      <TileLayer
        attribution='&copy; OpenStreetMap &copy; CARTO'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      {sorted.map((e) => (
        <CircleMarker
          key={e.id}
          center={[e.lat, e.lng]}
          radius={5 + (e.opportunity_score / 100) * 7}
          pathOptions={{
            color: "rgba(226,236,248,0.6)",
            weight: 1,
            fillColor: scoreColor(e.opportunity_score),
            fillOpacity: 0.9,
          }}
        >
          <Popup>
            <div className="map-popup">
              <Link to={`/property/${e.id}`} className="map-popup-thumb">
                <Img src={e.image} seed={e.id} alt="" className="map-popup-img" />
              </Link>
              <Link to={`/property/${e.id}`} className="map-popup-title">
                {e.address}
              </Link>
              <div className="map-popup-meta">
                {districtLabel(e.district)} · {formatEuro(e.current_price)} · {formatPerM2(e.price_per_m2)}
              </div>
              <div className="map-popup-foot">
                <span className="map-popup-score" style={{ color: scoreColor(e.opportunity_score) }}>
                  Score {e.opportunity_score}
                </span>
                <span style={{ color: "#2dd4bf" }}>{e.net_yield.toFixed(1)}% net</span>
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
