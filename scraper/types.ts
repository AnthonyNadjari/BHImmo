import type { ISODate } from "../shared/types.ts";

/** A listing exactly as returned by a source (synthetic or real scraper). */
export interface RawListing {
  /** Source system identifier, e.g. "synthetic" or "seloger". */
  source: string;
  /** Stable per-source listing id (used by the matching engine). */
  externalId: string;
  rawAddress: string;
  district: string;
  surface_m2: number;
  rooms: number;
  floor: number;
  price: number;
  observedDate: ISODate;
  url?: string;
  /** Deterministic coordinate hint used when geocoding is unavailable. */
  fallbackLat: number;
  fallbackLng: number;
}

/** A validated, type-clean listing ready for matching + enrichment. */
export interface NormalizedListing extends RawListing {
  price_per_m2: number;
}
