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

export interface Amenities {
  /** Food & daily shopping POIs within ~500 m (shops, groceries, bakeries). */
  food: number;
  /** Health POIs within ~500 m (pharmacies, doctors, clinics). */
  health: number;
  /** Green spaces within ~500 m (parks, gardens). */
  green: number;
  /** Culture & leisure within ~500 m (cinemas, theatres, libraries, museums). */
  culture: number;
}

export interface Neighborhood {
  /** Composite walkability / amenity-richness score, 0–100. */
  walk_score: number;
  /** Schools within ~500 m (data.education.gouv.fr). */
  schools_500m: number;
  /** Median disposable household income, € / year (INSEE FiLoSoFi). */
  income: number;
  /** Vélib' bike-share stations within ~400 m (opendata.paris.fr). */
  velib_400m: number;
  /** Street trees within ~150 m — green-canopy proxy (opendata.paris.fr). */
  trees_150m: number;
  amenities: Amenities;
}

export interface Score {
  /** Headline deal score, 0–100. */
  opportunity_score: number;
  /** Cheapness vs. DVF + €/m² percentile, 0–100. */
  value_score: number;
  /** Rental-yield strength, 0–100. */
  yield_score: number;
  /** Negotiation leverage (drops + time on market), 0–100. */
  negotiation_score: number;
  /** Resale liquidity, 0–100. */
  liquidity_score: number;
  /** Neighbourhood gentrification momentum, 0–100. */
  gentrification_score: number;
}

export interface Rent {
  /** Reference rent €/m²/month. */
  ref_m2: number;
  /** Legal ceiling (majoré) €/m²/month — achievable market rent. */
  max_m2: number;
  min_m2: number;
  /** Estimated monthly rent for this unit, €. */
  monthly_est: number;
  quartier: string;
}

export interface Investment {
  /** Gross rental yield, %. */
  gross_yield: number;
  /** Net rental yield (after costs & acquisition fees), %. */
  net_yield: number;
  /** €/m² percentile within the arrondissement (0 = cheapest). */
  ppm2_percentile: number;
  /** Estimated total negotiation margin, %. */
  negotiation_margin_pct: number;
  /** DPE regulatory health 0–100 (100 = A, 10 = G). */
  dpe_risk_score: number;
  /** Renovation-arbitrage opportunity on an F/G priced well below market. */
  value_add_flag: boolean;
}

export interface Poi {
  type: "transport" | "park" | "velib";
  lat: number;
  lng: number;
  label: string;
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

  /** Walkability, schools, income & amenities for the surrounding area. */
  neighborhood: Neighborhood;

  /** Rental reference + estimated rent. */
  rent: Rent;
  /** Derived investment metrics. */
  investment: Investment;
  /** Nearby points of interest for the detail mini-map. */
  pois: Poi[];

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
  /** Walkability score 0–100 (surfaced for sorting/filtering). */
  walk_score: number;
  /** Gross rental yield, % (sortable). */
  gross_yield: number;
  /** Net rental yield, %. */
  net_yield: number;
  /** €/m² percentile within arrondissement. */
  ppm2_percentile: number;
  /** DPE energy class A–G (promoted for the dashboard chip). */
  dpe_energy?: string;
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
  /** Median disposable household income €/yr (INSEE FiLoSoFi). */
  median_income: number;
  /** Average walkability score of active listings, 0–100. */
  avg_walk_score: number;
  /** Median gross rental yield of active listings, %. */
  median_yield: number;
  /** Resident-safety index 0–100. */
  safety_index: number;
}

export interface MarketFile {
  generated_at: string;
  city_avg_price_m2: number;
  /** City-wide median 1-year price trend (gentrification baseline). */
  city_median_trend: number;
  arrondissements: MarketArrondissement[];
}

export interface PropertiesFile {
  generated_at: string;
  count: number;
  properties: Property[];
}
