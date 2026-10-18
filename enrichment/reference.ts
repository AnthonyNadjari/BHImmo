/**
 * Paris-wide reference datasets, loaded ONCE per run and indexed in memory, so
 * per-property neighbourhood metrics are computed locally from real open data
 * (no per-property API call → it scales to thousands of properties).
 *
 *  - IDFM "emplacement-des-gares-idf"      → métro / RER / tram stations
 *  - Annuaire de l'éducation              → schools (écoles, collèges, lycées)
 *  - opendata.paris "velib…stations"      → Vélib' stations
 *  - opendata.paris "espaces_verts"       → parks, gardens, squares
 *  - opendata.paris "les-arbres"          → street trees (~220k)
 *  - OpenStreetMap (Overpass)             → food / health / culture amenities
 *  - opendata.paris "encadrement loyers"  → rent-control polygons (latest year)
 *  - opendata.paris "arrondissements"     → area + centroid
 *  - opendata.paris road-noise exposure   → residents above the Lden threshold
 *
 * A source that fails to load is reported as unavailable; properties then keep
 * the values computed from it on a previous run instead of inventing new ones.
 */

import { ENDPOINTS, fetchJson, fetchText, type PipelineConfig } from "../shared/config.ts";
import { PointIndex } from "../shared/geo.ts";
import { log } from "../shared/logger.ts";
import { ARRONDISSEMENTS } from "../shared/paris.ts";
import type { SourceStatus } from "../shared/types.ts";

export interface RefPoint {
  lat: number;
  lng: number;
  name: string;
  /** Optional detail, e.g. lines ("METRO 4 · RER B") or category. */
  meta?: string;
}

export interface AmenityPoint extends RefPoint {
  kind: "food" | "health" | "culture";
}

export interface RentZone {
  quartier: string;
  geometry: { type: string; coordinates: unknown };
  /** "<piece>|<epoque>" → { ref, min, max } (non meublé). */
  rents: Map<string, { ref: number; min: number; max: number }>;
}

export interface ArrondissementRef {
  area_km2: number;
  lat: number;
  lng: number;
}

export interface References {
  stations: PointIndex<RefPoint> | null;
  schools: PointIndex<RefPoint> | null;
  velib: PointIndex<RefPoint> | null;
  parks: PointIndex<RefPoint> | null;
  trees: PointIndex<{ lat: number; lng: number }> | null;
  amenities: PointIndex<AmenityPoint> | null;
  rent: { year: string; zones: RentZone[] } | null;
  arrondissements: Map<string, ArrondissementRef> | null;
  /** district → residents above the Lden road-noise threshold (+ year). */
  noise: { year: string; dbThreshold: number; exposed: Map<string, number> } | null;
  sources: SourceStatus[];
}

// Generous intra-muros bounding box (+ the two woods).
const inParis = (lat: number, lng: number) => lat >= 48.8 && lat <= 48.915 && lng >= 2.22 && lng <= 2.475;

type Row = Record<string, unknown>;

function geo(r: Row, field: string): { lat: number; lng: number } | null {
  const g = r[field] as { lat?: number; lon?: number } | undefined;
  return g && typeof g.lat === "number" && typeof g.lon === "number" ? { lat: g.lat, lng: g.lon } : null;
}

const SCHOOL_TYPES = new Set(["Ecole", "Collège", "Lycée"]);
// Destinations people actually use — not planters, verges or green walls.
const PARK_CATEGORIES = new Set([
  "Arboretum", "Bois", "Espace Vert", "Esplanade", "Foret urbaine", "Ile", "Jardin",
  "Jardin partage", "Jardinet", "Mail", "Parc", "Promenade", "Square",
]);

async function loadStations(config: PipelineConfig): Promise<RefPoint[] | null> {
  const rows = await fetchJson<Row[]>(`${ENDPOINTS.idfmStations}?select=nom_gares,res_com,geo_point_2d`, config);
  if (!Array.isArray(rows)) return null;
  // One row per (station, line): merge lines so a hub counts once.
  const byName = new Map<string, RefPoint & { lines: Set<string> }>();
  for (const r of rows) {
    const g = geo(r, "geo_point_2d");
    if (!g || !inParis(g.lat, g.lng)) continue;
    const name = String(r.nom_gares ?? "").trim();
    if (!name) continue;
    const s = byName.get(name) ?? byName.set(name, { ...g, name, lines: new Set() }).get(name)!;
    if (r.res_com) s.lines.add(String(r.res_com));
  }
  return [...byName.values()].map(({ lines, ...s }) => ({ ...s, meta: [...lines].sort().join(" · ") }));
}

async function loadSchools(config: PipelineConfig): Promise<RefPoint[] | null> {
  const where = encodeURIComponent(`code_departement="075" AND etat="OUVERT"`);
  const rows = await fetchJson<Row[]>(
    `${ENDPOINTS.schools}?select=nom_etablissement,type_etablissement,position&where=${where}`,
    config,
  );
  if (!Array.isArray(rows)) return null;
  return rows.flatMap((r) => {
    const g = geo(r, "position");
    return g && SCHOOL_TYPES.has(String(r.type_etablissement)) ? [{ ...g, name: String(r.nom_etablissement ?? "École") }] : [];
  });
}

async function loadVelib(config: PipelineConfig): Promise<RefPoint[] | null> {
  const rows = await fetchJson<Row[]>(`${ENDPOINTS.velib}?select=name,coordonnees_geo`, config);
  if (!Array.isArray(rows)) return null;
  return rows.flatMap((r) => {
    const g = geo(r, "coordonnees_geo");
    return g && inParis(g.lat, g.lng) ? [{ ...g, name: String(r.name ?? "Vélib'") }] : [];
  });
}

async function loadParks(config: PipelineConfig): Promise<RefPoint[] | null> {
  const rows = await fetchJson<Row[]>(`${ENDPOINTS.parks}?select=nom_ev,categorie,geom_x_y`, config);
  if (!Array.isArray(rows)) return null;
  return rows.flatMap((r) => {
    const g = geo(r, "geom_x_y");
    const cat = String(r.categorie ?? "");
    return g && PARK_CATEGORIES.has(cat) && inParis(g.lat, g.lng)
      ? [{ ...g, name: titleName(String(r.nom_ev ?? cat)), meta: cat }]
      : [];
  });
}

async function loadTrees(config: PipelineConfig): Promise<Array<{ lat: number; lng: number }> | null> {
  const csv = await fetchText(`${ENDPOINTS.trees}?select=geo_point_2d`, config, { timeoutMs: 180_000 });
  if (!csv) return null;
  const out: Array<{ lat: number; lng: number }> = [];
  for (const line of csv.split("\n")) {
    const m = /(-?\d+\.\d+),\s*(-?\d+\.\d+)/.exec(line);
    if (m) out.push({ lat: Number(m[1]), lng: Number(m[2]) });
  }
  return out.length > 1000 ? out : null;
}

const OSM_QUERY = `[out:csv(::lat,::lon,amenity,shop,tourism,name;false;"|")][timeout:180][bbox:48.815,2.224,48.903,2.47];
(
  nwr["amenity"~"^(restaurant|cafe|bar|pub|fast_food|marketplace|pharmacy|doctors|dentist|clinic|hospital|theatre|cinema|library|arts_centre)$"];
  nwr["shop"~"^(supermarket|convenience|bakery|butcher|greengrocer|deli|cheese|seafood|pastry|wine)$"];
  nwr["tourism"="museum"];
);
out center;`;

const FOOD = /^(restaurant|cafe|bar|pub|fast_food|marketplace|supermarket|convenience|bakery|butcher|greengrocer|deli|cheese|seafood|pastry|wine)$/;
const HEALTH = /^(pharmacy|doctors|dentist|clinic|hospital)$/;
const CULTURE = /^(theatre|cinema|library|arts_centre|museum)$/;

async function loadAmenities(config: PipelineConfig): Promise<AmenityPoint[] | null> {
  for (const url of ENDPOINTS.overpass) {
    const csv = await fetchText(url, config, {
      method: "POST",
      body: new URLSearchParams({ data: OSM_QUERY }),
      timeoutMs: 200_000,
      retries: 2,
    });
    if (!csv || csv.trimStart().startsWith("<")) continue; // HTML error page
    const out: AmenityPoint[] = [];
    for (const line of csv.split("\n")) {
      const [lat, lng, amenity, shop, tourism, name] = line.split("|");
      const tag = amenity || shop || tourism || "";
      const kind = FOOD.test(tag) ? "food" : HEALTH.test(tag) ? "health" : CULTURE.test(tag) ? "culture" : null;
      if (!kind || !lat || !lng) continue;
      out.push({ lat: Number(lat), lng: Number(lng), kind, name: name || tag });
    }
    if (out.length > 1000) return out;
  }
  return null;
}

async function loadRent(config: PipelineConfig): Promise<{ year: string; zones: RentZone[] } | null> {
  const years = await fetchJson<{ results?: Array<{ annee?: string }> }>(
    `${ENDPOINTS.rentControl}/records?select=annee&group_by=annee&order_by=annee%20desc&limit=1`,
    config,
  );
  const year = years?.results?.[0]?.annee;
  if (!year) return null;
  const where = encodeURIComponent(`annee="${year}" AND meuble_txt="non meublé"`);
  const rows = await fetchJson<Row[]>(
    `${ENDPOINTS.rentControl}/exports/json?select=id_quartier,nom_quartier,piece,epoque,ref,min,max,geo_shape&where=${where}`,
    config,
    { timeoutMs: 120_000 },
  );
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const zones = new Map<string, RentZone>();
  for (const r of rows) {
    const id = String(r.id_quartier);
    const shape = r.geo_shape as { geometry?: { type: string; coordinates: unknown } } | undefined;
    if (!shape?.geometry) continue;
    const z = zones.get(id) ?? zones.set(id, { quartier: String(r.nom_quartier ?? ""), geometry: shape.geometry, rents: new Map() }).get(id)!;
    z.rents.set(`${r.piece}|${r.epoque}`, { ref: Number(r.ref), min: Number(r.min), max: Number(r.max) });
  }
  return { year, zones: [...zones.values()] };
}

async function loadArrondissements(config: PipelineConfig): Promise<Map<string, ArrondissementRef> | null> {
  const rows = await fetchJson<Row[]>(`${ENDPOINTS.arrondissements}?select=c_ar,surface,geom_x_y`, config);
  if (!Array.isArray(rows) || rows.length < 20) return null;
  const out = new Map<string, ArrondissementRef>();
  for (const r of rows) {
    const g = geo(r, "geom_x_y");
    const district = `750${String(r.c_ar).padStart(2, "0")}`;
    if (g && Number(r.surface) > 0) out.set(district, { area_km2: Number(r.surface) / 1e6, ...g });
  }
  return out;
}

async function loadNoise(config: PipelineConfig): Promise<References["noise"]> {
  const rows = await fetchJson<Row[]>(ENDPOINTS.roadNoise, config);
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const latest = rows.reduce((a, b) => (String(b.annee) > String(a.annee) ? b : a));
  const exposed = new Map<string, number>();
  for (const a of ARRONDISSEMENTS) {
    const n = Number(a.district.slice(-2));
    // Arrondissements 1–4 are published together as "Paris Centre".
    const key = n <= 4 ? "lden_exposition_vr_pariscentre" : `lden_exposition_vr_${n}eme`;
    const v = Number(latest[key]);
    if (Number.isFinite(v)) exposed.set(a.district, v);
  }
  return exposed.size ? { year: String(latest.annee), dbThreshold: Number(latest.lden_reglementaire), exposed } : null;
}

/** "JARDIN DE BONNE" → "Jardin De Bonne". */
function titleName(s: string): string {
  return s.toLowerCase().replace(/(^|[\s'’-])\p{L}/gu, (c) => c.toUpperCase());
}

function status(id: string, label: string, url: string, records: number | null, period?: string): SourceStatus {
  return { id, label, url, status: records ? "ok" : "unavailable", records: records ?? 0, ...(period ? { period } : {}) };
}

/** Load every Paris-wide reference set concurrently. */
export async function loadReferences(config: PipelineConfig): Promise<References> {
  const [stations, schools, velib, parks, trees, amenities, rent, arrondissements, noise] = await Promise.all([
    loadStations(config),
    loadSchools(config),
    loadVelib(config),
    loadParks(config),
    loadTrees(config),
    loadAmenities(config),
    loadRent(config),
    loadArrondissements(config),
    loadNoise(config),
  ]);

  const idx = <T extends { lat: number; lng: number }>(pts: T[] | null) => (pts && pts.length ? new PointIndex(pts) : null);
  const refs: References = {
    stations: idx(stations),
    schools: idx(schools),
    velib: idx(velib),
    parks: idx(parks),
    trees: idx(trees),
    amenities: idx(amenities),
    rent,
    arrondissements,
    noise,
    sources: [
      status("idfm", "IDFM — gares et stations", "https://data.iledefrance-mobilites.fr/explore/dataset/emplacement-des-gares-idf/", stations?.length ?? null),
      status("schools", "Annuaire de l'éducation", "https://data.education.gouv.fr/explore/dataset/fr-en-annuaire-education/", schools?.length ?? null),
      status("velib", "Vélib' — stations", "https://opendata.paris.fr/explore/dataset/velib-emplacement-des-stations/", velib?.length ?? null),
      status("parks", "Espaces verts (Ville de Paris)", "https://opendata.paris.fr/explore/dataset/espaces_verts/", parks?.length ?? null),
      status("trees", "Les arbres (Ville de Paris)", "https://opendata.paris.fr/explore/dataset/les-arbres/", trees?.length ?? null),
      status("osm", "OpenStreetMap — commerces, santé, culture", "https://www.openstreetmap.org/copyright", amenities?.length ?? null),
      status("rent", "Encadrement des loyers", "https://opendata.paris.fr/explore/dataset/logement-encadrement-des-loyers/", rent?.zones.length ?? null, rent?.year),
      status("arrondissements", "Arrondissements (Ville de Paris)", "https://opendata.paris.fr/explore/dataset/arrondissements/", arrondissements?.size ?? null),
      status("noise", "Bruit routier — exposition (Ville de Paris)", "https://opendata.paris.fr/explore/dataset/bruit-exposition-des-parisien-ne-s-aux-depassements-des-seuils-nocturne-ou-journ/", noise?.exposed.size ?? null, noise?.year),
    ],
  };

  log.info(
    `References: ${stations?.length ?? "✗"} stations · ${schools?.length ?? "✗"} schools · ${velib?.length ?? "✗"} Vélib' · ` +
      `${parks?.length ?? "✗"} parks · ${trees?.length ?? "✗"} trees · ${amenities?.length ?? "✗"} OSM amenities · ` +
      `${rent ? `${rent.zones.length} rent zones (${rent.year})` : "✗ rent"} · ${noise ? `noise ${noise.year}` : "✗ noise"}`,
  );
  return refs;
}
