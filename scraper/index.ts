/** Ingestion module: real DVF sales → property universe + market context. */

export type { DvfTxn } from "./types.ts";
export {
  districtMarkets,
  loadDvf,
  lotHistory,
  selectUniverse,
  type DistrictMarket,
  type DvfData,
} from "./dvf-source.ts";
export {
  buildPriceIndex,
  marketChangePct,
  quarterlySeries,
  quarterOf,
  repeatPairs,
  repeatStats,
  type PriceIndex,
} from "./price-index.ts";
