/**
 * Detail-page mini-map: the property, walking catchment circles and nearby
 * transport / parks / Vélib' markers. Leaflet + Plan IGN tiles (Géoplateforme, no key).
 * Default export for React.lazy.
 */

import { Circle, CircleMarker, MapContainer, TileLayer, Tooltip } from "react-leaflet";
import type { Poi } from "../types";

const POI_STYLE: Record<string, string> = {
  transport: "#2563eb",
  park: "#0e9488",
  velib: "#0891b2",
};

export default function MiniMap({ lat, lng, label, pois }: { lat: number; lng: number; label: string; pois: Poi[] }) {
  const center: [number, number] = [lat, lng];
  return (
    <MapContainer center={center} zoom={15} className="leaflet-mini" scrollWheelZoom={false}>
      <TileLayer
        attribution="&copy; IGN — Plan IGN"
        url="https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}"
        maxZoom={19}
      />
      <Circle center={center} radius={500} pathOptions={{ color: "#2563eb", weight: 1, fillOpacity: 0.05, dashArray: "4 4" }} />
      <Circle center={center} radius={150} pathOptions={{ color: "#2563eb", weight: 1, fillOpacity: 0.08 }} />

      {(pois ?? []).map((poi, i) => (
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
          {label}
        </Tooltip>
      </CircleMarker>
    </MapContainer>
  );
}
