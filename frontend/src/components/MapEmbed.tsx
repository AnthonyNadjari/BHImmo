/**
 * OpenStreetMap embed (key-less iframe). Shows the property location with a
 * marker; links out to the full OSM map. No JS map library → no extra weight.
 */

interface Props {
  lat: number;
  lng: number;
  label?: string;
  zoomSpan?: number;
}

export function MapEmbed({ lat, lng, label, zoomSpan = 0.006 }: Props) {
  const bbox = [lng - zoomSpan, lat - zoomSpan / 1.6, lng + zoomSpan, lat + zoomSpan / 1.6];
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox.join(",")}&layer=mapnik&marker=${lat},${lng}`;
  const link = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;

  return (
    <div className="map-embed">
      <iframe
        title={label ?? "Map"}
        src={src}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <a href={link} target="_blank" rel="noreferrer" className="map-link">
        Open in OpenStreetMap ↗
      </a>
    </div>
  );
}
