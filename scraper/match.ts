/**
 * Matching engine (Step 4): reconcile freshly-fetched listings against the
 * existing property dataset.
 *
 * Identity is stable: a property id is derived from `source` + `externalId`,
 * so the same listing always maps to the same property across runs. This pure
 * function classifies each listing as new or re-seen and flags previously
 * active properties that have disappeared from the market.
 */

import type { Property } from "../shared/types.ts";
import type { NormalizedListing } from "./types.ts";

export function propertyId(listing: NormalizedListing): string {
  return `${listing.source}-${listing.externalId}`;
}

export interface MatchPlan {
  /** Listings with no matching property → create. */
  toCreate: NormalizedListing[];
  /** Listings matched to an existing property → update. */
  toUpdate: Array<{ property: Property; listing: NormalizedListing }>;
  /** Active properties absent from the current fetch → mark sold/removed. */
  disappeared: Property[];
}

export function matchListings(
  listings: NormalizedListing[],
  existing: Property[],
): MatchPlan {
  const byId = new Map(existing.map((p) => [p.id, p]));
  const seenIds = new Set<string>();

  const toCreate: NormalizedListing[] = [];
  const toUpdate: MatchPlan["toUpdate"] = [];

  for (const listing of listings) {
    const id = propertyId(listing);
    seenIds.add(id);
    const property = byId.get(id);
    if (property) toUpdate.push({ property, listing });
    else toCreate.push(listing);
  }

  const disappeared = existing.filter(
    (p) => p.status === "active" && !seenIds.has(p.id),
  );

  return { toCreate, toUpdate, disappeared };
}
