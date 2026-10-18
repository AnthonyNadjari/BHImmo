/**
 * Real imagery of a sale's location, built from its coordinates: the IGN BD
 * ORTHO® aerial photograph (two zoom levels) and the Plan IGN map, served by
 * the Géoplateforme WMS (free, key-less, hot-linkable). DVF publishes no
 * listing photos, so instead of stock pictures we show the actual building
 * from above — the UI pins the address at the image centre. Street-level
 * photos (Mapillary from the pipeline, or Street View with a key) come first
 * when available.
 */

import { hasStreetView, streetViewGallery, streetViewThumb } from "./facade";
import type { IndexEntry, Property } from "../types";

const WMS = "https://data.geopf.fr/wms-r";
const R = 6_378_137; // Web Mercator sphere radius (m)

export const IGN_CREDIT = "© IGN — BD ORTHO® / Plan IGN";

/** WMS GetMap URL for a `groundWidthM`-wide view centred on lat/lng. */
function wms(layer: string, format: string, lat: number, lng: number, groundWidthM: number, w: number, h: number): string {
  const x = (R * lng * Math.PI) / 180;
  const y = R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  // Mercator metres are stretched by 1/cos(lat) relative to ground metres.
  const halfW = groundWidthM / Math.cos((lat * Math.PI) / 180) / 2;
  const halfH = (halfW * h) / w;
  const bbox = [x - halfW, y - halfH, x + halfW, y + halfH].map((v) => v.toFixed(1)).join(",");
  return (
    `${WMS}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=${layer}&STYLES=` +
    `&CRS=EPSG:3857&BBOX=${bbox}&WIDTH=${w}&HEIGHT=${h}&FORMAT=${encodeURIComponent(format)}`
  );
}

/** Thumbnail for a dashboard row / card. */
export function thumbFor(e: Pick<IndexEntry, "lat" | "lng">): string {
  return (hasStreetView() && streetViewThumb(e.lat, e.lng)) || wms("ORTHOIMAGERY.ORTHOPHOTOS", "image/jpeg", e.lat, e.lng, 110, 480, 300);
}

/** Full gallery for the detail page, with its credit line. */
export function galleryFor(p: Property): { images: string[]; credit: string } {
  const { lat, lng } = p.address;
  const street = [...(p.street_images ?? []), ...(hasStreetView() ? streetViewGallery(lat, lng) : [])];
  const aerial = [
    wms("ORTHOIMAGERY.ORTHOPHOTOS", "image/jpeg", lat, lng, 110, 1200, 750),
    wms("ORTHOIMAGERY.ORTHOPHOTOS", "image/jpeg", lat, lng, 380, 1200, 750),
    wms("GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2", "image/png", lat, lng, 380, 1200, 750),
  ];
  const credits = [
    p.street_images?.length ? "© Mapillary contributors" : "",
    hasStreetView() ? "Google Street View" : "",
    IGN_CREDIT,
  ].filter(Boolean);
  return { images: [...street, ...aerial], credit: credits.join(" · ") };
}
