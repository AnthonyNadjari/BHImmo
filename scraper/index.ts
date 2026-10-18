/** Ingestion module: real DVF sales → property universe + market context. */

export type { DvfTxn } from "./types.ts";
export {
  comparables,
  districtMarkets,
  loadDvf,
  lotHistory,
  selectUniverse,
  type Comparable,
  type DistrictMarket,
  type DvfData,
} from "./dvf-source.ts";
