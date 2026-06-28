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
}

export function getInseeProfile(district: string): InseeProfile {
  const arr = ARRONDISSEMENT_BY_CODE.get(district);
  return {
    district,
    name: arr?.name ?? "Paris",
    refPriceM2: arr?.refPriceM2 ?? 10500,
    density: DENSITY[district] ?? 25000,
  };
}
