/**
 * Frontend view of the dataset schema. Mirrors `/shared/types.ts` (the
 * pipeline's source of truth). Kept as a standalone copy so the frontend has
 * no build-time dependency on the pipeline package.
 */

export type PropertyStatus = "active" | "sold" | "removed";
export type Badge = "opportunity" | "watch" | "overvalued";

export interface PriceHistoryPoint {
  date: string;
  price: number;
  source: string;
}

export interface ComparableSale {
  price: number;
  date: string;
  distance_m: number;
}

export interface Property {
  id: string;
  address: {
    raw: string;
    normalized: string;
    lat: number;
    lng: number;
    district: string;
  };
  characteristics: { surface_m2: number; rooms: number; floor: number };
  pricing: { current_price: number; price_per_m2: number; initial_price: number };
  timeline: { first_seen: string; last_seen: string; days_on_market: number };
  price_history: PriceHistoryPoint[];
  status: PropertyStatus;
  dvf: {
    avg_price_m2_100m: number;
    avg_price_m2_500m: number;
    comparable_sales: ComparableSale[];
  };
  risks: { flood: number; clay: number; noise: number };
  transport_score: number;
  neighborhood: {
    walk_score: number;
    schools_500m: number;
    income: number;
    velib_400m: number;
    trees_150m: number;
    amenities: { food: number; health: number; green: number; culture: number };
  };
  images: string[];
  thumb: string;
  dpe?: { energy_class: string; ghg_class: string };
  score: {
    opportunity_score: number;
    price_score: number;
    market_gap_score: number;
    liquidity_score: number;
  };
  signals: {
    price_drops: number;
    total_drop_percent: number;
    long_time_on_market: boolean;
    explanations: string[];
  };
  source: string;
  url?: string;
}

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
  spark: number[];
  badge: Badge;
  image: string;
  walk_score: number;
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
  density: number;
  avg_price_m2: number;
  median_price_m2: number;
  dvf_avg_price_m2: number;
  trend_1y_percent: number;
  volatility: number;
  avg_opportunity_score: number;
  median_income: number;
  avg_walk_score: number;
}

export interface MarketFile {
  generated_at: string;
  city_avg_price_m2: number;
  arrondissements: MarketArrondissement[];
}
