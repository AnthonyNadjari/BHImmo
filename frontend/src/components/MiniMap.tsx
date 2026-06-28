/**
 * Detail-page mini-map: the property, walking catchment circles and nearby
 * transport / parks / Vélib' markers. Leaflet + Carto tiles (no key).
 * Default export for React.lazy.
 */

import { Circle, CircleMarker, MapContainer, TileLayer, Tooltip } from "react-leaflet";
import type { Property } from "../types";

const POI_STYLE: Record<string, string> = {
  transport: "#2563eb",
  park: "#0e9488",
  velib: "#0891b2",
};

export default function MiniMap({ property: p }: { property: Property }) {
  const center: [number, number] = [p.address.lat, p.address.lng];
  return (
    <MapContainer center={center} zoom={15} className="leaflet-mini" scrollWheelZoom={false}>
      <TileLayer
        attribution="&copy; OpenStreetMap &copy; CARTO"
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      <Circle center={center} radius={500} pathOptions={{ color: "#2563eb", weight: 1, fillOpacity: 0.05, dashArray: "4 4" }} />
      <Circle center={center} radius={150} pathOptions={{ color: "#2563eb", weight: 1, fillOpacity: 0.08 }} />

      {(p.pois ?? []).map((poi, i) => (
        <CircleMarker
          key={i}
          center={[poi.lat, poi.lng]}
          radius={poi.type === "transport" ? 6 : 4.5}
          pathOptions={{ color: "#ffffff", weight: 1.5, fillColor: POI_STYLE[poi.type], fillOpacity: 0.95 }}
        >
          <Tooltip>{poi.label}</Tooltip>
        </CircleMarker>
      ))}

      {/* property */}
      <CircleMarker
        center={center}
        radius={9}
        pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#e11d48", fillOpacity: 1 }}
      >
        <Tooltip permanent direction="top" offset={[0, -8]}>
          {p.address.normalized.split(",")[0]}
        </Tooltip>
      </CircleMarker>
    </MapContainer>
  );
}
