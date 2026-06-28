/**
 * Address geocoding via the Base Adresse Nationale (BAN).
 *
 * Endpoint: https://api-adresse.data.gouv.fr/search/?q=...&limit=1
 * Free, key-less, French government open data.
 *
 * When BAN is unavailable (mock mode, network failure, no Paris match) we fall
 * back to the deterministic coordinate hint carried by the listing.
 */

import { ENDPOINTS, fetchJson, type PipelineConfig } from "../shared/config.ts";
import { round } from "../shared/geo.ts";
import type { NormalizedListing } from "../scraper/types.ts";

export interface GeocodeResult {
  normalized: string;
  lat: number;
  lng: number;
  district: string;
  source: "ban" | "fallback";
}

interface BanResponse {
  features: Array<{
    geometry: { coordinates: [number, number] };
    properties: {
      label: string;
      postcode?: string;
      citycode?: string;
      city?: string;
    };
  }>;
}

export async function geocode(
  listing: NormalizedListing,
  config: PipelineConfig,
): Promise<GeocodeResult> {
  const url = `${ENDPOINTS.ban}?q=${encodeURIComponent(listing.rawAddress)}&limit=1`;
  const data = await fetchJson<BanResponse>(url, config);

  const feature = data?.features?.[0];
  if (feature && feature.geometry?.coordinates) {
    const [lng, lat] = feature.geometry.coordinates;
    const postcode = feature.properties.postcode ?? listing.district;
    // Only trust BAN if it resolved to a Paris (75xxx) address.
    if (/^750\d{2}$/.test(postcode)) {
      return {
        normalized: feature.properties.label,
        lat: round(lat, 6),
        lng: round(lng, 6),
        district: postcode,
        source: "ban",
      };
    }
  }

  return {
    normalized: listing.rawAddress,
    lat: listing.fallbackLat,
    lng: listing.fallbackLng,
    district: listing.district,
    source: "fallback",
  };
}
