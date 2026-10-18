/**
 * DVF — the backbone: real Paris apartment sales.
 *
 * DVF (Demandes de Valeurs Foncières) is the official open dataset of French
 * property transactions (DGFiP / Etalab). We read the geocoded department
 * files published on data.gouv.fr (free, key-less, stable URLs):
 *
 *   https://files.data.gouv.fr/geo-dvf/latest/csv/<year>/departements/75.csv.gz
 *
 * The latest vintages are discovered from the folder listing, so the pipeline
 * picks up each new semi-annual release on its own. From the same real data we
 * derive:
 *   - the property universe (most recent sales per arrondissement),
 *   - comparable sales around each property (±12 months, ≤ 500 m),
 *   - resale history of the same lot (same parcel + lot number),
 *   - per-arrondissement market statistics (median €/m², YoY trend, volume).
 *
 * No listing-portal scraping. If DVF can't be read the run fails loudly and the
 * last committed dataset stays online — nothing is ever made up.
 */

import { gunzipSync } from "node:zlib";
import { ENDPOINTS, fetchBuffer, fetchText, type PipelineConfig } from "../shared/config.ts";
import { coefficientOfVariation, median, PointIndex, round } from "../shared/geo.ts";
import { log } from "../shared/logger.ts";
import { districtFromInsee } from "../shared/paris.ts";
import type { DvfCoverage } from "../shared/types.ts";
import type { DvfTxn } from "./types.ts";

const DAY_MS = 86_400_000;

export interface DvfData {
  sales: DvfTxn[];
  index: PointIndex<DvfTxn>;
  vintages: string[];
  coverage: DvfCoverage;
  /** All sales of a lot ("parcel|lot"), oldest first. */
  byLot: Map<string, DvfTxn[]>;
}

/** Years available under geo-dvf/latest/csv/, ascending. */
async function discoverVintages(config: PipelineConfig): Promise<string[]> {
  const html = await fetchText(`${ENDPOINTS.dvf}/`, config);
  const years = [...new Set([...(html ?? "").matchAll(/csv\/(\d{4})\//g)].map((m) => m[1]!))].sort();
  if (years.length === 0) throw new Error("DVF: could not list the available vintages");
  return years;
}

/** Split one CSV line (geo-dvf rarely quotes, but stay correct when it does). */
function splitCsv(line: string): string[] {
  if (!line.includes('"')) return line.split(",");
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

/** "BD DU PALAIS" → "Bd Du Palais". */
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\p{L}/gu, (c) => c.toUpperCase())
    .trim();
}

/** Parse one department CSV into clean single-apartment sales (Paris only). */
function parseCsv(csv: string, year: string): DvfTxn[] {
  const lines = csv.split("\n");
  const header = splitCsv(lines[0] ?? "");
  const col = (name: string) => header.indexOf(name);
  const I = {
    id: col("id_mutation"), date: col("date_mutation"), nature: col("nature_mutation"),
    price: col("valeur_fonciere"), num: col("adresse_numero"), suf: col("adresse_suffixe"),
    voie: col("adresse_nom_voie"), cp: col("code_postal"), commune: col("code_commune"),
    parcel: col("id_parcelle"), lot: col("lot1_numero"), carrez: col("lot1_surface_carrez"),
    type: col("type_local"), surf: col("surface_reelle_bati"), rooms: col("nombre_pieces_principales"),
    lon: col("longitude"), lat: col("latitude"),
  };
  if (I.id < 0 || I.price < 0 || I.type < 0 || I.commune < 0) {
    throw new Error(`DVF ${year}: unexpected CSV header`);
  }

  // Group rows by mutation: one sale can span several lots (flat + cellar…).
  const groups = new Map<string, string[][]>();
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const row = splitCsv(lines[i]!);
    if (row.length < header.length || !row[I.commune]!.startsWith("751")) continue;
    const mid = row[I.id]!;
    (groups.get(mid) ?? groups.set(mid, []).get(mid)!).push(row);
  }

  const txns: DvfTxn[] = [];
  for (const [mid, rows] of groups) {
    const apts = rows.filter((r) => r[I.type] === "Appartement" && r[I.nature] === "Vente");
    // Keep only a single, unambiguous apartment sale: the price must map to one
    // home, optionally with its cellar / parking ("Dépendance"). Sales bundling
    // a shop, office or other home would distort €/m², so they are excluded.
    if (apts.length !== 1) continue;
    const r = apts[0]!;
    if (rows.some((x) => x !== r && x[I.type] !== "Dépendance")) continue;

    const price = Number(r[I.price]);
    const surface = Number(r[I.surf]);
    const lat = Number(r[I.lat]);
    const lng = Number(r[I.lon]);
    if (!Number.isFinite(price) || price <= 0) continue;
    if (!Number.isFinite(surface) || surface < 9) continue;
    if (!r[I.lat] || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const ppm2 = price / surface;
    if (ppm2 < 2000 || ppm2 > 40000) continue; // obvious data-entry errors

    const district = districtFromInsee(r[I.commune]!);
    const num = (r[I.num] ?? "").trim();
    const suf = (r[I.suf] ?? "").trim();
    const voie = titleCase(r[I.voie] ?? "");
    const cp = (r[I.cp] ?? "").trim() || district;
    const street = `${num}${suf ? " " + suf : ""} ${voie}`.replace(/\s+/g, " ").trim();
    const carrez = Number((r[I.carrez] ?? "").replace(",", "."));

    txns.push({
      id: mid,
      date: (r[I.date] ?? "").slice(0, 10),
      year,
      price: round(price),
      surface: round(surface, 1),
      carrez: Number.isFinite(carrez) && carrez > 0 ? round(carrez, 1) : null,
      rooms: Math.max(1, Math.round(Number(r[I.rooms])) || 1),
      lat: round(lat, 6),
      lng: round(lng, 6),
      district,
      address: `${street}, ${cp} Paris`,
      ppm2: round(ppm2),
      parcel: r[I.parcel] ?? "",
      lot: (r[I.lot] ?? "").trim(),
    });
  }
  return txns;
}

/**
 * Drop atypical sales (viager, nue-propriété, family transfers, mispriced
 * lots) that trade far from their arrondissement's median that year — they
 * would show up as fake "discounts". The bounds are relative to the real
 * median, not to any hard-coded reference.
 */
function dropAtypical(sales: DvfTxn[]): DvfTxn[] {
  const groups = new Map<string, number[]>();
  for (const s of sales) {
    const k = `${s.district}|${s.year}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(s.ppm2);
  }
  const medians = new Map([...groups].map(([k, v]) => [k, median(v)]));
  return sales.filter((s) => {
    const m = medians.get(`${s.district}|${s.year}`)!;
    return s.ppm2 >= 0.6 * m && s.ppm2 <= 2.2 * m;
  });
}

let CACHE: DvfData | null = null;

/** Load (and cache) every clean Paris apartment sale of the latest vintages. */
export async function loadDvf(config: PipelineConfig): Promise<DvfData> {
  if (CACHE) return CACHE;
  const available = await discoverVintages(config);
  const vintages = available.slice(-Math.max(2, config.dvfYears));

  let raw: DvfTxn[] = [];
  for (const year of vintages) {
    const gz = await fetchBuffer(`${ENDPOINTS.dvf}/${year}/departements/75.csv.gz`, config, { timeoutMs: 120_000 });
    if (!gz) throw new Error(`DVF ${year}: download failed`);
    const txns = parseCsv(gunzipSync(gz).toString("utf8"), year);
    log.info(`DVF ${year}: ${txns.length} single-apartment sales`);
    raw = raw.concat(txns);
  }
  const sales = dropAtypical(raw).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  const byLot = new Map<string, DvfTxn[]>();
  for (const s of sales) {
    if (!s.parcel || !s.lot) continue;
    const k = `${s.parcel}|${s.lot}`;
    (byLot.get(k) ?? byLot.set(k, []).get(k)!).push(s);
  }

  CACHE = {
    sales,
    index: new PointIndex(sales),
    vintages,
    byLot,
    coverage: {
      vintages,
      first_sale: sales[0]?.date ?? "",
      last_sale: sales[sales.length - 1]?.date ?? "",
      sales: sales.length,
    },
  };
  log.ok(`DVF: ${sales.length} clean apartment sales (${vintages[0]}–${vintages[vintages.length - 1]}, up to ${CACHE.coverage.last_sale})`);
  return CACHE;
}

/** The property universe: the most recent `perArr` sales per arrondissement. */
export function selectUniverse(dvf: DvfData, perArr: number): DvfTxn[] {
  const latest = dvf.vintages[dvf.vintages.length - 1]!;
  const byDistrict = new Map<string, DvfTxn[]>();
  for (const s of dvf.sales) {
    if (s.year !== latest) continue;
    (byDistrict.get(s.district) ?? byDistrict.set(s.district, []).get(s.district)!).push(s);
  }
  const out: DvfTxn[] = [];
  for (const [, list] of [...byDistrict].sort(([a], [b]) => a.localeCompare(b))) {
    list.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
    out.push(...list.slice(0, perArr));
  }
  return out;
}

export interface Comparable {
  txn: DvfTxn;
  distance_m: number;
}

/**
 * Real comparable sales: other DVF apartment sales within `radius` m and
 * ±`windowDays` of the subject's sale date, nearest first.
 */
export function comparables(dvf: DvfData, subject: DvfTxn, radius = 500, windowDays = 365): Comparable[] {
  const t = Date.parse(subject.date);
  return dvf.index
    .within(subject.lat, subject.lng, radius)
    .filter(({ p }) => p.id !== subject.id && Math.abs(Date.parse(p.date) - t) <= windowDays * DAY_MS)
    .map(({ p, d }) => ({ txn: p, distance_m: round(d) }));
}

/**
 * Every sale of the same lot (parcel + lot number) with a consistent surface,
 * oldest first — a genuine resale history, not a simulated one.
 */
export function lotHistory(dvf: DvfData, subject: DvfTxn): DvfTxn[] {
  if (!subject.parcel || !subject.lot) return [subject];
  const same = (dvf.byLot.get(`${subject.parcel}|${subject.lot}`) ?? []).filter(
    (s) => s.date <= subject.date && Math.abs(s.surface - subject.surface) <= Math.max(2, 0.05 * subject.surface),
  );
  // Collapse duplicate publications of one deed (same date & price).
  const seen = new Set<string>();
  const out = same.filter((s) => {
    const k = `${s.date}|${s.price}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return out.length ? out : [subject];
}

export interface DistrictMarket {
  district: string;
  latestYear: string;
  salesLatest: number;
  medianLatest: number;
  medianPrev: number | null;
  trendPct: number | null;
  volatility: number;
  /** Centroid of the arrondissement's sales (fallback map position). */
  lat: number;
  lng: number;
}

/** Per-arrondissement DVF statistics for the latest vs previous vintage. */
export function districtMarkets(dvf: DvfData): {
  byDistrict: Map<string, DistrictMarket>;
  cityMedian: number;
  cityTrend: number | null;
  latestYear: string;
} {
  const latest = dvf.vintages[dvf.vintages.length - 1]!;
  const prev = dvf.vintages[dvf.vintages.length - 2];
  const cur = new Map<string, DvfTxn[]>();
  const old = new Map<string, number[]>();
  for (const s of dvf.sales) {
    if (s.year === latest) (cur.get(s.district) ?? cur.set(s.district, []).get(s.district)!).push(s);
    else if (s.year === prev) (old.get(s.district) ?? old.set(s.district, []).get(s.district)!).push(s.ppm2);
  }

  const byDistrict = new Map<string, DistrictMarket>();
  for (const [district, list] of cur) {
    const ppm2 = list.map((s) => s.ppm2);
    const m = median(ppm2);
    const p = old.get(district);
    const mp = p && p.length >= 20 ? median(p) : null;
    byDistrict.set(district, {
      district,
      latestYear: latest,
      salesLatest: list.length,
      medianLatest: round(m),
      medianPrev: mp === null ? null : round(mp),
      trendPct: mp ? round(((m - mp) / mp) * 100, 1) : null,
      volatility: round(coefficientOfVariation(ppm2), 3),
      lat: round(list.reduce((a, s) => a + s.lat, 0) / list.length, 5),
      lng: round(list.reduce((a, s) => a + s.lng, 0) / list.length, 5),
    });
  }

  const cityCur = dvf.sales.filter((s) => s.year === latest).map((s) => s.ppm2);
  const cityPrev = dvf.sales.filter((s) => s.year === prev).map((s) => s.ppm2);
  const cm = median(cityCur);
  const cp = cityPrev.length ? median(cityPrev) : 0;
  return {
    byDistrict,
    cityMedian: round(cm),
    cityTrend: cp ? round(((cm - cp) / cp) * 100, 1) : null,
    latestYear: latest,
  };
}
