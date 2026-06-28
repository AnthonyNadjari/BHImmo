/**
 * Listing normalization: validate, coerce types, drop malformed records and
 * compute derived fields (price/m²). A real scraper would also strip HTML,
 * canonicalize units, etc.; the structure is here for that to grow into.
 */

import { round } from "../shared/geo.ts";
import { log } from "../shared/logger.ts";
import type { NormalizedListing, RawListing } from "./types.ts";

function isValid(l: RawListing): boolean {
  return (
    typeof l.externalId === "string" &&
    l.externalId.length > 0 &&
    Number.isFinite(l.surface_m2) &&
    l.surface_m2 > 0 &&
    Number.isFinite(l.price) &&
    l.price > 0 &&
    /^750\d{2}$/.test(l.district)
  );
}

export function normalizeListings(raw: RawListing[]): NormalizedListing[] {
  const out: NormalizedListing[] = [];
  let dropped = 0;

  for (const l of raw) {
    if (!isValid(l)) {
      dropped++;
      continue;
    }
    out.push({
      ...l,
      rawAddress: l.rawAddress.trim().replace(/\s+/g, " "),
      surface_m2: round(l.surface_m2, 1),
      price: round(l.price),
      price_per_m2: round(l.price / l.surface_m2),
    });
  }

  if (dropped > 0) log.warn(`Dropped ${dropped} malformed listing(s)`);
  return out;
}
