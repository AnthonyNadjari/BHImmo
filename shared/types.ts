/**
 * Canonical data model for BHImmo (Paris Real Estate Radar).
 *
 * Every record is a REAL Paris apartment sale from DVF (Etalab), enriched with
 * French open data. Nothing is synthesized: when a source has no answer for a
 * property the field is `null` and the UI says so. Dates are ISO-8601 strings
 * (`YYYY-MM-DD`) so the dataset stays plain, diff-friendly JSON.
 */

export type ISODate = string;

export interface Address {
  /** Address as published in DVF (number + street + postcode). */
  raw: string;
  /** BAN label when the geocoder matched the address, else the DVF address. */
  normalized: string;
  lat: number;
  lng: number;
  /** Paris arrondissement postcode, e.g. "75011". */
  district: string;
  /** BAN interoperability key (e.g. "75101_6188_00037"), null if unmatched. */
  ban_id: string | null;
}

export interface Characteristics {
  /** Surface réelle bâtie declared in DVF, m². */
  surface_m2: number;
  /** Loi Carrez surface of the main lot when declared in DVF, m². */
  carrez_m2: number | null;
  /** Nombre de pièces principales (DVF). */
  rooms: number;
}

export interface Sale {
  date: ISODate;
  price: number;
  price_per_m2: number;
  /** DVF `id_mutation`. */
  mutation_id: string;
  /** Cadastral parcel (DVF `id_parcelle`). */
  parcel: string;
}

export interface PriceHistoryPoint {
  date: ISODate;
  price: number;
  /** Always "dvf": earlier sales of the same lot found in DVF. */
  source: string;
}

export interface ComparableSale {
  price: number;
  date: ISODate;
  distance_m: number;
  surface_m2: number;
  price_per_m2: number;
}

export interface DvfStats {
  /** Mean €/m² of DVF apartment sales within 100 m (±12 months), null if none. */
  avg_price_m2_100m: number | null;
  /** Mean €/m² of DVF apartment sales within 500 m (±12 months), null if none. */
  avg_price_m2_500m: number | null;
  count_100m: number;
  count_500m: number;
  /** Date window the comparables were drawn from. */
  window_from: ISODate;
  window_to: ISODate;
  /** Closest comparable sales (max 8). */
  comparable_sales: ComparableSale[];
}

/** One risk fact, straight from its source's own classification. */
export interface RiskFact {
  /** Severity 0–1 derived from the source's classes (for meters & scoring). */
  value: number;
  /** Source wording, e.g. "aléa de moyenne probabilité". */
  label: string;
  /** "point" = looked up at the address; "arrondissement" = area statistic. */
  scope: "point" | "arrondissement";
  source: string;
}

export interface Risks {
  /** Géorisques TRI flood zoning at the address. */
  flood: RiskFact | null;
  /** Géorisques RGA clay shrink–swell exposure at the address. */
  clay: RiskFact | null;
  /** Share of residents above the road-noise Lden threshold (Ville de Paris). */
  noise: RiskFact | null;
}

export interface Transport {
  /** Composite accessibility 0–100 from real IDFM station locations. */
  score: number;
  nearest_name: string;
  nearest_m: number;
  /** Rail/métro/tram stations (IDFM) within 600 m. */
  stations_600m: number;
}

export interface Amenities {
  /** Restaurants, cafés, bars, food shops within 500 m (OpenStreetMap). */
  food: number;
  /** Pharmacies, doctors, dentists, clinics within 500 m (OpenStreetMap). */
  health: number;
  /** Museums, theatres, cinemas, libraries, arts centres within 500 m (OSM). */
  culture: number;
}

export interface Neighborhood {
  /** Composite 0–100 over the components that are available (null if none). */
  walk_score: number | null;
  /** Schools within 500 m (Annuaire de l'éducation). */
  schools_500m: number | null;
  /** Vélib' stations within 400 m (opendata.paris.fr). */
  velib_400m: number | null;
  /** Street trees within 150 m (opendata.paris.fr "les arbres"). */
  trees_150m: number | null;
  /** Parks / gardens / squares within 500 m (opendata.paris.fr). */
  parks_500m: number | null;
  amenities: Amenities | null;
  /** Median standard of living €/yr of the arrondissement (INSEE FiLoSoFi). */
  income: number | null;
  /** Poverty rate % of the arrondissement (INSEE FiLoSoFi). */
  poverty_rate: number | null;
}

export interface Rent {
  /** Reference rent €/m²/month (encadrement des loyers). */
  ref_m2: number;
  /** Legal ceiling (loyer de référence majoré) €/m²/month. */
  max_m2: number;
  min_m2: number;
  /** Ceiling × surface: the legal maximum monthly rent, €. */
  monthly_est: number;
  quartier: string;
  /** Rent-control year applied (e.g. "2025"). */
  year: string;
  /** Construction era used to pick the reference rent. */
  epoque: string;
  /** "dpe" = derived from the building's DPE; "assumed" = no data, pre-1946. */
  epoque_source: "dpe" | "assumed";
}

export interface Dpe {
  energy_class: string;
  ghg_class: string;
  /**
   * "unit": an ADEME certificate at this BAN address whose surface matches the
   * sale; "building": median class of the certificates at the same address.
   */
  scope: "unit" | "building";
  /** Number of ADEME certificates found at the address. */
  certificates: number;
  /** Certificate date (unit scope only). */
  date: ISODate | null;
  /** Certificate surface (unit scope only). */
  surface_m2: number | null;
  /** Estimated annual energy bill from the certificate, € (unit scope only). */
  energy_cost_eur: number | null;
  /** Construction year reported by the certificates, when present. */
  year_built: number | null;
  /** Construction period reported by the certificates. */
  period: string | null;
}

export interface Investment {
  /** Gross yield at the legal rent ceiling, % (null without rent data). */
  gross_yield: number | null;
  /** Net yield after notary fees & charges assumptions, % (null without rent). */
  net_yield: number | null;
  /** €/m² percentile within the arrondissement's sales (0 = cheapest). */
  ppm2_percentile: number;
  /** % below (+) / above (−) the local DVF reference, null without comps. */
  dvf_gap_pct: number | null;
  /** DPE regulatory health 0–100 (100 = A, 10 = G), null without DPE. */
  dpe_risk_score: number | null;
  /** F/G bought far enough below market to pay for the renovation. */
  value_add_flag: boolean;
}

export interface Score {
  /** Headline deal score 0–100 (weighted over the available components). */
  opportunity_score: number;
  /** Cheapness vs. DVF comparables + arrondissement percentile. */
  value_score: number | null;
  /** Rental yield strength at the legal rent ceiling. */
  yield_score: number | null;
  /** Resale liquidity (transport, walkability, size, local sale volume). */
  liquidity_score: number | null;
  /** Arrondissement momentum (DVF trend) + income/price gap (INSEE). */
  gentrification_score: number | null;
}

export interface Resale {
  previous_date: ISODate;
  previous_price: number;
  change_pct: number;
  years: number;
}

export interface Signals {
  /** Previous DVF sale of the same lot, when one exists. */
  resale: Resale | null;
  /** Human-readable, explainable bullet points shown in the UI. */
  explanations: string[];
}

export interface Poi {
  type: "transport" | "park" | "velib";
  lat: number;
  lng: number;
  label: string;
}

/** When each per-address remote lookup last completed (even with no match). */
export interface Lookups {
  ban?: ISODate;
  dpe?: ISODate;
  flood?: ISODate;
  clay?: ISODate;
}

export interface Property {
  id: string;
  address: Address;
  characteristics: Characteristics;
  sale: Sale;
  /** Every DVF sale of this lot, oldest first (the last one is `sale`). */
  price_history: PriceHistoryPoint[];
  dvf: DvfStats;
  risks: Risks;
  transport: Transport | null;
  neighborhood: Neighborhood;
  rent: Rent | null;
  investment: Investment;
  pois: Poi[];
  /** Real imagery of the location (IGN aerial photos, Mapillary if enabled). */
  images: string[];
  thumb: string;
  image_credit: string;
  dpe: Dpe | null;
  score: Score;
  signals: Signals;
  source: "dvf";
  url: string;
  lookups: Lookups;
}

/* ------------------------------------------------------------------ */
/* Derived / aggregate datasets exported by the pipeline.             */
/* ------------------------------------------------------------------ */

export type Badge = "opportunity" | "watch" | "overvalued";

/** Lightweight per-property record used by the dashboard. */
export interface IndexEntry {
  id: string;
  address: string;
  district: string;
  lat: number;
  lng: number;
  surface_m2: number;
  rooms: number;
  price: number;
  price_per_m2: number;
  sale_date: ISODate;
  opportunity_score: number;
  badge: Badge;
  image: string;
  walk_score: number | null;
  gross_yield: number | null;
  net_yield: number | null;
  ppm2_percentile: number;
  dvf_gap_pct: number | null;
  dpe_energy: string | null;
  dpe_scope: "unit" | "building" | null;
  resale_change_pct: number | null;
  /** Sale prices of this lot over time (sparkline). */
  spark: number[];
}

/** Provenance of one source for this run. */
export interface SourceStatus {
  id: string;
  label: string;
  url: string;
  /** "ok" = loaded this run; "stale" = kept from a previous run; "unavailable". */
  status: "ok" | "stale" | "unavailable";
  records: number;
  /** Vintage / reference period of the data, when known. */
  period?: string;
}

export interface DvfCoverage {
  vintages: string[];
  first_sale: ISODate;
  last_sale: ISODate;
  /** Clean single-apartment sales parsed across all vintages. */
  sales: number;
}

export interface IndexFile {
  generated_at: string;
  dvf: DvfCoverage;
  count: number;
  properties: IndexEntry[];
}

export interface MarketArrondissement {
  district: string;
  name: string;
  lat: number;
  lng: number;
  /** Properties of this arrondissement in the dataset. */
  listing_count: number;
  /** Clean DVF apartment sales in the latest vintage. */
  sales_latest_year: number;
  population: number | null;
  area_km2: number | null;
  density: number | null;
  /** Mean €/m² of the dataset's properties. */
  avg_price_m2: number;
  /** Median €/m² of all DVF apartment sales in the latest vintage. */
  median_price_m2: number;
  /** Median €/m² of DVF apartment sales in the previous vintage. */
  prev_median_price_m2: number | null;
  /** Year-over-year change of the DVF median €/m², %. */
  trend_1y_percent: number | null;
  /** Coefficient of variation of DVF €/m² in the latest vintage. */
  volatility: number;
  avg_opportunity_score: number;
  median_income: number | null;
  poverty_rate: number | null;
  avg_walk_score: number | null;
  median_yield: number | null;
  /** % of residents above the road-noise Lden threshold (Ville de Paris). */
  noise_exposed_pct: number | null;
}

export interface MarketFile {
  generated_at: string;
  dvf: DvfCoverage;
  latest_year: string;
  /** Median €/m² of all Paris apartment sales in the latest vintage. */
  city_median_price_m2: number;
  /** City-wide YoY change of the DVF median €/m², %. */
  city_trend_1y: number | null;
  sources: SourceStatus[];
  arrondissements: MarketArrondissement[];
}

export interface PropertiesFile {
  generated_at: string;
  count: number;
  properties: Property[];
}
