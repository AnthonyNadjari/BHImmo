/**
 * Real imagery of a property's location from the IGN Géoplateforme WMS (free,
 * key-less, hot-linkable): the BD ORTHO® aerial photograph centred on the
 * address at two zoom levels, plus the Plan IGN street map. DVF publishes no
 * listing photos, so instead of stock pictures we show the actual building
 * from above. The marker is drawn by the UI at the image centre.
 */

import { ENDPOINTS } from "./config.ts";

const R = 6_378_137; // Web Mercator sphere radius (m)

/** WMS GetMap URL for a `groundWidthM`-wide view centred on lat/lng. */
function wms(layer: string, format: string, lat: number, lng: number, groundWidthM: number, w: number, h: number): string {
  const x = (R * lng * Math.PI) / 180;
  const y = R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  // Mercator metres are stretched by 1/cos(lat) relative to ground metres.
  const halfW = groundWidthM / Math.cos((lat * Math.PI) / 180) / 2;
  const halfH = (halfW * h) / w;
  const bbox = [x - halfW, y - halfH, x + halfW, y + halfH].map((v) => v.toFixed(1)).join(",");
  return (
    `${ENDPOINTS.ignWms}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=${layer}&STYLES=` +
    `&CRS=EPSG:3857&BBOX=${bbox}&WIDTH=${w}&HEIGHT=${h}&FORMAT=${encodeURIComponent(format)}`
  );
}

export interface ImageSet {
  images: string[];
  thumb: string;
  credit: string;
}

export const IGN_CREDIT = "© IGN — BD ORTHO® / Plan IGN";

export function aerialImageSet(lat: number, lng: number): ImageSet {
  return {
    images: [
      wms("ORTHOIMAGERY.ORTHOPHOTOS", "image/jpeg", lat, lng, 110, 1200, 750),
      wms("ORTHOIMAGERY.ORTHOPHOTOS", "image/jpeg", lat, lng, 380, 1200, 750),
      wms("GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2", "image/png", lat, lng, 380, 1200, 750),
    ],
    thumb: wms("ORTHOIMAGERY.ORTHOPHOTOS", "image/jpeg", lat, lng, 110, 480, 300),
    credit: IGN_CREDIT,
  };
}
