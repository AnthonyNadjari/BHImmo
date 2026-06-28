/**
 * Detail-page mini-map: the property, walking catchment circles and nearby
 * transport / parks / Vélib' markers. Leaflet + Carto tiles (no key).
 * Default export for React.lazy.
 */

import { Circle, CircleMarker, MapContainer, TileLayer, Tooltip } from "react-leaflet";
import type { Property } from "../types";

const POI_STYLE: Record<string, string> = {
  transport: "#34357a",
  park: "#0f7a4d",
  velib: "#0e8f8f",
};

export default function MiniMap({ property: p }: { property: Property }) {
  const center: [number, number] = [p.address.lat, p.address.lng];
  return (
    <MapContainer center={center} zoom={15} className="leaflet-mini" scrollWheelZoom={false}>
      <TileLayer
        attribution="&copy; OpenStreetMap &copy; CARTO"
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      <Circle center={center} radius={500} pathOptions={{ color: "#34357a", weight: 1, fillOpacity: 0.04, dashArray: "4 4" }} />
      <Circle center={center} radius={150} pathOptions={{ color: "#34357a", weight: 1, fillOpacity: 0.06 }} />

      {(p.pois ?? []).map((poi, i) => (
        <CircleMarker
          key={i}
          center={[poi.lat, poi.lng]}
          radius={poi.type === "transport" ? 6 : 4.5}
          pathOptions={{ color: "#fff", weight: 1, fillColor: POI_STYLE[poi.type], fillOpacity: 0.9 }}
        >
          <Tooltip>{poi.label}</Tooltip>
        </CircleMarker>
      ))}

      {/* property */}
      <CircleMarker
        center={center}
        radius={9}
        pathOptions={{ color: "#fff", weight: 2, fillColor: "#c0392b", fillOpacity: 1 }}
      >
        <Tooltip permanent direction="top" offset={[0, -8]}>
          {p.address.normalized.split(",")[0]}
        </Tooltip>
      </CircleMarker>
    </MapContainer>
  );
}
