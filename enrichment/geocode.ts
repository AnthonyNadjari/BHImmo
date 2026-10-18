/**
 * Address matching via the Base Adresse Nationale (IGN Géoplateforme
 * geocoder, legacy api-adresse.data.gouv.fr as a fallback).
 *
 * DVF already carries real coordinates (Etalab geocoding of the parcel), so
 * geocoding is only used to get the canonical BAN label + interoperability key
 * — the key that links the sale to its ADEME energy certificates. A match is
 * kept only for a house-number hit in the same arrondissement.
 */

import { ENDPOINTS, fetchJson, type PipelineConfig } from "../shared/config.ts";
import { round } from "../shared/geo.ts";

export interface GeocodeResult {
  normalized: string;
  lat: number;
  lng: number;
  ban_id: string;
}

interface BanResponse {
  features?: Array<{
    geometry: { coordinates: [number, number] };
    properties: { label: string; id?: string; type?: string; score?: number; postcode?: string };
  }>;
}

interface BanReverse {
  features?: Array<{ properties: { label?: string; type?: string; distance?: number } }>;
}

/**
 * Nearest BAN house-number address to a point (reverse geocoding), with its
 * distance in metres; `null` when none within 60 m, `undefined` when every
 * geocoder was unreachable.
 */
export async function reverseGeocode(lat: number, lng: number, config: PipelineConfig): Promise<string | null | undefined> {
  for (const base of ENDPOINTS.geocoder) {
    const url = `${base.replace(/search\/?$/, "reverse")}?lon=${lng}&lat=${lat}&limit=1&index=address`;
    const data = await fetchJson<BanReverse>(url, config);
    if (!data) continue;
    const p = data.features?.[0]?.properties;
    if (!p?.label || p.type !== "housenumber" || (p.distance ?? 0) > 60) return null;
    return p.label;
  }
  return undefined;
}

/**
 * Returns the BAN match, `null` when the address has no reliable match, or
 * `undefined` when every geocoder was unreachable (retry on a later run).
 */
export async function geocode(
  address: string,
  district: string,
  config: PipelineConfig,
): Promise<GeocodeResult | null | undefined> {
  for (const base of ENDPOINTS.geocoder) {
    const data = await fetchJson<BanResponse>(`${base}?q=${encodeURIComponent(address)}&limit=1`, config);
    if (!data) continue;
    const f = data.features?.[0];
    const p = f?.properties;
    if (!f || !p || p.type !== "housenumber" || (p.score ?? 0) < 0.6 || p.postcode !== district || !p.id) return null;
    const [lng, lat] = f.geometry.coordinates;
    return { normalized: p.label, lat: round(lat, 6), lng: round(lng, 6), ban_id: p.id };
  }
  return undefined;
}
