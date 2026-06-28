/**
 * Static INSEE-style reference profile per arrondissement.
 *
 * The spec lists INSEE as an *optional static import*. Rather than hit a live
 * endpoint for slow-moving census data, we embed a small reference table
 * (approximate 2021 population density, hab/km²) alongside the DVF-anchored
 * reference price. This is used for context/enrichment and can be surfaced in
 * the market model.
 */

import { ARRONDISSEMENT_BY_CODE } from "../shared/paris.ts";

/**
 * Approximate median disposable household income per consumption unit (€/year),
 * INSEE FiLoSoFi 2021 order of magnitude. A strong neighbourhood-wealth signal
 * for investors (gentrification / resale demand).
 */
const MEDIAN_INCOME: Record<string, number> = {
  "75001": 36000,
  "75002": 34000,
  "75003": 35000,
  "75004": 38000,
  "75005": 37000,
  "75006": 43000,
  "75007": 47000,
  "75008": 45000,
  "75009": 34000,
  "75010": 29000,
  "75011": 30000,
  "75012": 31000,
  "75013": 27000,
  "75014": 32000,
  "75015": 33000,
  "75016": 44000,
  "75017": 35000,
  "75018": 26000,
  "75019": 23000,
  "75020": 25000,
};

/**
 * Loyer de référence (median rent €/m²/month) per arrondissement — Paris
 * "encadrement des loyers" order of magnitude. The legal ceiling ("majoré") is
 * ≈ ref × 1.2 and is the realistically achievable rent. Live pipeline refines
 * this per quartier via opendata.paris.fr; this static table is the fallback.
 */
const LOYER_REF_M2: Record<string, number> = {
  "75001": 30.5, "75002": 30.0, "75003": 30.5, "75004": 31.0, "75005": 30.0,
  "75006": 32.0, "75007": 31.0, "75008": 29.5, "75009": 29.0, "75010": 28.0,
  "75011": 28.5, "75012": 27.0, "75013": 26.5, "75014": 28.0, "75015": 28.5,
  "75016": 28.5, "75017": 28.5, "75018": 27.0, "75019": 25.5, "75020": 26.0,
};

/**
 * Resident-safety index 0–100 (higher = safer), an order-of-magnitude proxy
 * derived from SSMSI burglary+violence rates. Live pipeline can refine per
 * arrondissement; central/tourist + north-east areas score a bit lower.
 */
const SAFETY_INDEX: Record<string, number> = {
  "75001": 62, "75002": 66, "75003": 72, "75004": 70, "75005": 78,
  "75006": 82, "75007": 84, "75008": 64, "75009": 68, "75010": 55,
  "75011": 66, "75012": 72, "75013": 67, "75014": 75, "75015": 80,
  "75016": 85, "75017": 73, "75018": 52, "75019": 54, "75020": 60,
};

/** Approximate population density per arrondissement (inhabitants / km²). */
const DENSITY: Record<string, number> = {
  "75001": 8600,
  "75002": 21000,
  "75003": 30000,
  "75004": 17000,
  "75005": 24000,
  "75006": 21000,
  "75007": 14000,
  "75008": 9800,
  "75009": 30000,
  "75010": 31000,
  "75011": 40000,
  "75012": 14000,
  "75013": 25000,
  "75014": 25000,
  "75015": 28000,
  "75016": 11000,
  "75017": 30000,
  "75018": 32000,
  "75019": 27000,
  "75020": 32000,
};

export interface InseeProfile {
  district: string;
  name: string;
  refPriceM2: number;
  density: number;
  /** Median disposable household income, € / year. */
  income: number;
  /** Median rent reference, € / m² / month. */
  loyerRefM2: number;
  /** Resident-safety index, 0–100 (higher = safer). */
  safety: number;
}

export function getInseeProfile(district: string): InseeProfile {
  const arr = ARRONDISSEMENT_BY_CODE.get(district);
  return {
    district,
    name: arr?.name ?? "Paris",
    refPriceM2: arr?.refPriceM2 ?? 10500,
    density: DENSITY[district] ?? 25000,
    income: MEDIAN_INCOME[district] ?? 30000,
    loyerRefM2: LOYER_REF_M2[district] ?? 27,
    safety: SAFETY_INDEX[district] ?? 65,
  };
}
