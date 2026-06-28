/**
 * Canonical data model for Paris Real Estate Radar.
 *
 * This mirrors the strict schema from the product spec. Dates are stored as
 * ISO-8601 strings (`YYYY-MM-DD`) so the dataset is plain, diff-friendly JSON
 * that the static frontend can consume without any deserialization step.
 */

export type ISODate = string;

export type PropertyStatus = "active" | "sold" | "removed";

export interface Address {
  /** Address exactly as it appeared on the source listing. */
  raw: string;
  /** Cleaned / canonical address (BAN `label` when geocoding succeeds). */
  normalized: string;
  lat: number;
  lng: number;
  /** Paris arrondissement, e.g. "75011". */
  district: string;
}

export interface Characteristics {
  surface_m2: number;
  rooms: number;
  /** Floor number (0 = ground floor / rez-de-chaussée). */
  floor: number;
}

export interface Pricing {
  current_price: number;
  price_per_m2: number;
  /** Price the first time the listing was seen. */
  initial_price: number;
}

export interface Timeline {
  first_seen: ISODate;
  last_seen: ISODate;
  days_on_market: number;
}

export interface PriceHistoryPoint {
  date: ISODate;
  price: number;
  /** Where the price observation came from (e.g. "seloger", "synthetic"). */
  source: string;
}

export interface ComparableSale {
  price: number;
  date: ISODate;
  distance_m: number;
}

export interface DvfStats {
  /** Mean transaction €/m² within a 100 m radius (DVF, last ~3 years). */
  avg_price_m2_100m: number;
  /** Mean transaction €/m² within a 500 m radius. */
  avg_price_m2_500m: number;
  comparable_sales: ComparableSale[];
}

export interface Risks {
  /** Flood exposure 0–1 (Géorisques). */
  flood: number;
  /** Clay shrink-swell exposure 0–1 (Géorisques `rga`). */
  clay: number;
  /** Environmental noise exposure 0–1. */
  noise: number;
}

export interface Score {
  /** Headline opportunity score, 0–100. */
  opportunity_score: number;
  /** Sub-score: how cheap vs. DVF, 0–100. */
  price_score: number;
  /** Sub-score: gap vs. local market, 0–100. */
  market_gap_score: number;
  /** Sub-score: how easily it should resell, 0–100. */
  liquidity_score: number;
}

export interface Signals {
  /** Number of distinct price drops observed in the history. */
  price_drops: number;
  /** Total percentage drop from the initial price (positive = cheaper now). */
  total_drop_percent: number;
  long_time_on_market: boolean;
  /** Human-readable, explainable bullet points shown in the UI. */
  explanations: string[];
}

export interface Property {
  id: string;

  address: Address;
  characteristics: Characteristics;
  pricing: Pricing;
  timeline: Timeline;

  price_history: PriceHistoryPoint[];

  status: PropertyStatus;

  dvf: DvfStats;
  risks: Risks;

  /** Composite public-transport accessibility, 0–100. */
  transport_score: number;

  /** Listing photo gallery (deterministic, hot-linkable URLs). */
  images: string[];
  /** Small thumbnail URL for compact UI (dashboard rows, cards). */
  thumb: string;

  /** Optional energy performance (ADEME/DPE), letters A–G. */
  dpe?: {
    energy_class: string;
    ghg_class: string;
  };

  score: Score;
  signals: Signals;

  /** Listing source identifier (e.g. "synthetic", "seloger"). */
  source: string;
  /** Permalink to the original listing when available. */
  url?: string;
}

/* ------------------------------------------------------------------ */
/* Derived / aggregate datasets exported by the pipeline.             */
/* ------------------------------------------------------------------ */

/** Lightweight per-property record used by the dashboard table. */
export interface IndexEntry {
  id: string;
  address: string;
  district: string;
  lat: number;
  lng: number;
  surface_m2: number;
  rooms: number;
  current_price: number;
  price_per_m2: number;
  opportunity_score: number;
  price_drops: number;
  total_drop_percent: number;
  days_on_market: number;
  long_time_on_market: boolean;
  status: PropertyStatus;
  /** Compact price series for the dashboard sparkline. */
  spark: number[];
  badge: "opportunity" | "watch" | "overvalued";
  /** Thumbnail URL for the dashboard row. */
  image: string;
}

export interface IndexFile {
  generated_at: string;
  count: number;
  properties: IndexEntry[];
}

export interface MarketArrondissement {
  district: string;
  name: string;
  listing_count: number;
  /** INSEE population density (inhabitants / km²). */
  density: number;
  avg_price_m2: number;
  median_price_m2: number;
  /** DVF reference €/m² for the arrondissement. */
  dvf_avg_price_m2: number;
  /** 1-year price trend in %, derived from price history + DVF reference. */
  trend_1y_percent: number;
  /** Coefficient of variation of €/m² (relative volatility, 0–1+). */
  volatility: number;
  avg_opportunity_score: number;
}

export interface MarketFile {
  generated_at: string;
  city_avg_price_m2: number;
  arrondissements: MarketArrondissement[];
}

export interface PropertiesFile {
  generated_at: string;
  count: number;
  properties: Property[];
}
