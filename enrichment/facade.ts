/**
 * Real building / street imagery for a property, from Mapillary — open,
 * crowd-sourced street-level photos (CC-BY-SA). We look up the images closest
 * to the property's coordinates and bake their public thumbnail URLs into the
 * dataset, so the cards and gallery show the REAL place, for free.
 *
 * The access token is read from `MLY_TOKEN` and used server-side only (it never
 * ships to the browser). When it's absent (or in mock mode) we return [] and
 * the caller falls back to representative imagery. Attribution: © Mapillary
 * contributors.
 */

import { fetchJson, type PipelineConfig } from "../shared/config.ts";
import { haversineMeters } from "../shared/geo.ts";

const MAPILLARY = "https://graph.mapillary.com/images";

interface MlyImage {
  id: string;
  thumb_1024_url?: string;
  geometry?: { coordinates?: [number, number] };
}
interface MlyResponse {
  data?: MlyImage[];
}

/**
 * Up to `limit` real street-level photos near (lat,lng), nearest first.
 * Returns [] when no token / mock mode / no coverage.
 */
export async function mapillaryImages(
  lat: number,
  lng: number,
  config: PipelineConfig,
  limit = 4,
): Promise<string[]> {
  const token = process.env.MLY_TOKEN;
  if (!token || config.mode === "mock") return [];

  // ~90 m bounding box around the address.
  const d = 0.0009;
  const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`;
  const url =
    `${MAPILLARY}?access_token=${token}` +
    `&fields=id,thumb_1024_url,geometry&bbox=${bbox}&limit=25`;

  const data = await fetchJson<MlyResponse>(url, config);
  const imgs = (data?.data ?? []).filter(
    (i) => i.thumb_1024_url && i.geometry?.coordinates,
  );
  imgs.sort((a, b) => {
    const [alng, alat] = a.geometry!.coordinates!;
    const [blng, blat] = b.geometry!.coordinates!;
    return haversineMeters(lat, lng, alat, alng) - haversineMeters(lat, lng, blat, blng);
  });
  return imgs.slice(0, limit).map((i) => i.thumb_1024_url!);
}
