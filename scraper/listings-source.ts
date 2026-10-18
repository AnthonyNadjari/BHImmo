/**
 * Listings currently on the market, with their interior photos — from the
 * Stream.estate API (the data behind the Melo aggregator: 1 500+ French
 * sources, deduplicated, licensed access with an API key).
 *
 *   GET https://api.stream.estate/documents/properties
 *       ?includedDepartments[]=/departments/75&propertyTypes[]=0&transactionType=0
 *   header X-API-KEY: <STREAM_ESTATE_API_KEY>
 *
 * Each property groups the adverts of one apartment across sites; adverts carry
 * their photos and an event log (every price change with its % variation).
 *
 * Billing is per item returned, so the fetch is incremental (only properties
 * updated since the last run) and capped by PRER_LISTINGS_MAX per run. No key
 * → no listings: the source is reported as not configured, nothing is made up.
 * Listing portals are NOT scraped (their databases are legally protected and
 * the photos belong to the agencies).
 */

import { fetchJson, type PipelineConfig } from "../shared/config.ts";
import { log } from "../shared/logger.ts";

const API = "https://api.stream.estate/documents/properties";
const PAGE_SIZE = 30; // API maximum

export interface SeEvent {
  createdAt?: string;
  fieldName?: string;
  fieldNewValue?: string;
  fieldOldValue?: string;
  percentVariation?: number;
}

export interface SeAdvert {
  url?: string;
  price?: number;
  createdAt?: string;
  floor?: number;
  constructionYear?: number;
  condominiumFees?: number;
  energy?: { category?: string };
  greenHouseGas?: { category?: string };
  publisher?: { name?: string; type?: number };
  pictures?: string[];
  events?: SeEvent[];
}

export interface SeProperty {
  uuid: string;
  title?: string;
  description?: string;
  city?: { zipcode?: string; insee?: string };
  locations?: { lat?: number; lon?: number };
  price?: number;
  surface?: number;
  room?: number;
  bedroom?: number;
  floor?: number;
  pictures?: string[];
  createdAt?: string;
  updatedAt?: string;
  expired?: boolean;
  expiredAt?: string;
  adverts?: SeAdvert[];
}

interface SeCollection {
  "hydra:member"?: SeProperty[];
  "hydra:totalItems"?: number;
}

export const hasListingsKey = (): boolean => !!process.env.STREAM_ESTATE_API_KEY;

/**
 * Paris apartments for sale, at most `max` items. First run (`since` null):
 * the most recently updated active listings. Later runs: everything updated
 * after `since`, OLDEST FIRST, so a capped run resumes where it stopped (the
 * caller advances the cursor to the last `updatedAt` it received). Null when
 * no API key is configured or the API is unreachable.
 */
export async function fetchParisListings(
  config: PipelineConfig,
  since: string | null,
  max: number,
): Promise<SeProperty[] | null> {
  const key = process.env.STREAM_ESTATE_API_KEY;
  if (!key) return null;

  const base = new URLSearchParams();
  base.append("includedDepartments[]", "/departments/75");
  base.append("propertyTypes[]", "0");
  base.set("transactionType", "0");
  base.set("withLocation", "true");
  base.set("itemsPerPage", String(PAGE_SIZE));
  // First load: active listings only. Later: everything updated since the
  // cursor, expirations included (so listings that went off the market are seen).
  if (since) {
    base.set("fromUpdatedAt", since);
    base.set("order[updatedAt]", "asc");
  } else {
    base.set("expired", "false");
    base.set("order[updatedAt]", "desc");
  }

  const out: SeProperty[] = [];
  for (let page = 1; out.length < max; page++) {
    base.set("page", String(page));
    const data = await fetchJson<SeCollection>(`${API}?${base}`, config, { headers: { "X-API-KEY": key } });
    if (!data) {
      if (page === 1) return null;
      break; // keep what we have; the rest comes next run
    }
    const rows = data["hydra:member"] ?? [];
    out.push(...rows.slice(0, max - out.length));
    if (page === 1) log.info(`Stream.estate: ${data["hydra:totalItems"] ?? "?"} matching properties${since ? ` updated since ${since}` : ""}`);
    if (rows.length < PAGE_SIZE) break;
  }
  return out;
}
