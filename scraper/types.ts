import type { ISODate } from "../shared/types.ts";

/** One clean, single-apartment DVF sale. */
export interface DvfTxn {
  /** `id_mutation` — stable across vintages. */
  id: string;
  date: ISODate;
  /** Vintage (file year) the sale comes from. */
  year: string;
  price: number;
  /** Surface réelle bâtie, m². */
  surface: number;
  /** Loi Carrez surface of the apartment lot, m² (null if not declared). */
  carrez: number | null;
  rooms: number;
  lat: number;
  lng: number;
  /** Postcode-style district, e.g. "75004". */
  district: string;
  /** "12 Rue X, 75004 Paris". */
  address: string;
  ppm2: number;
  /** Cadastral parcel id. */
  parcel: string;
  /** Lot number of the apartment within the copropriété ("" if none). */
  lot: string;
}
