/**
 * Paris-wide reference datasets, loaded ONCE per run and cached in memory, so
 * per-property enrichment is computed locally (real open data, no per-property
 * API calls → it scales to thousands of properties).
 *
 * Sources (free, key-less Opendatasoft):
 *  - IDFM "emplacement-des-gares-idf"  → métro/RER/tram stations
 *  - data.education "annuaire-education" → schools
 *  - opendata.paris "velib…temps-reel"  → Vélib' stations
 *  - opendata.paris "espaces_verts"     → parks / green spaces
 *
 * In `mock` mode nothing is fetched and callers keep their deterministic
 * fallbacks, so offline/CI runs still produce a complete dataset.
 */

import { ENDPOINTS, fetchJson, type PipelineConfig } from "../shared/config.ts";
import { haversineMeters } from "../shared/geo.ts";
import { log } from "../shared/logger.ts";

export interface RefPoint {
  lat: number;
  lng: number;
  name: string;
  /** Optional label, e.g. line ("RER D") or category. */
  meta?: string;
}

// Generous intra-muros bounding box (the IDFM set covers all Île-de-France).
const BBOX = { latMin: 48.8, latMax: 48.91, lngMin: 2.22, lngMax: 2.47 };
const inParis = (lat: number, lng: number) =>
  lat >= BBOX.latMin && lat <= BBOX.latMax && lng >= BBOX.lngMin && lng <= BBOX.lngMax;

let stations: RefPoint[] = [];
let schools: RefPoint[] = [];
let velibStations: RefPoint[] = [];
let parks: RefPoint[] = [];
let loaded = false;

interface OdsRecords {
  results?: Array<Record<string, unknown>>;
}

/** Page through an Opendatasoft v2.1 records endpoint (100/page). */
async function fetchOdsAll(
  endpoint: string,
  params: string,
  config: PipelineConfig,
  maxPages: number,
): Promise<Array<Record<string, unknown>>> {
  const out: Array<Record<string, unknown>> = [];
  for (let page = 0; page < maxPages; page++) {
    const url = `${endpoint}?limit=100&offset=${page * 100}${params}`;
    const data = await fetchJson<OdsRecords>(url, config);
    const rows = data?.results;
    if (!rows || rows.length === 0) break;
    out.push(...rows);
    if (rows.length < 100) break;
  }
  return out;
}

function geo(r: Record<string, unknown>, field: string): { lat: number; lng: number } | null {
  const g = r[field] as { lat?: number; lon?: number } | undefined;
  return g && typeof g.lat === "number" && typeof g.lon === "number"
    ? { lat: g.lat, lng: g.lon }
    : null;
}

/** Load (once) all reference point datasets for Paris. */
export async function loadReferences(config: PipelineConfig): Promise<void> {
  if (loaded) return;
  loaded = true;
  if (config.mode === "mock") return;

  const codes = Array.from({ length: 20 }, (_, i) => `"750${String(i + 1).padStart(2, "0")}"`).join(",");
  const [st, sc, vl, pk] = await Promise.all([
    fetchOdsAll(ENDPOINTS.idfmStations, "&select=nom_gares,geo_point_2d,mode,res_com", config, 14),
    fetchOdsAll(
      ENDPOINTS.education,
      `&select=nom_etablissement,position&where=${encodeURIComponent(`code_postal in (${codes})`)}`,
      config,
      20,
    ),
    fetchOdsAll(ENDPOINTS.velib, "&select=name,coordonnees_geo", config, 18),
    fetchOdsAll(ENDPOINTS.espacesVerts, "&select=nom_ev,geom_x_y,categorie", config, 22),
  ]);

  stations = st
    .map((r): RefPoint | null => {
      const g = geo(r, "geo_point_2d");
      return g && inParis(g.lat, g.lng)
        ? { ...g, name: String(r.nom_gares ?? "Station"), meta: String(r.res_com ?? r.mode ?? "") }
        : null;
    })
    .filter((x): x is RefPoint => x !== null);
  schools = sc
    .map((r): RefPoint | null => {
      const g = geo(r, "position");
      return g ? { ...g, name: String(r.nom_etablissement ?? "École") } : null;
    })
    .filter((x): x is RefPoint => x !== null);
  velibStations = vl
    .map((r): RefPoint | null => {
      const g = geo(r, "coordonnees_geo");
      return g ? { ...g, name: String(r.name ?? "Vélib'") } : null;
    })
    .filter((x): x is RefPoint => x !== null);
  // Drop micro-greenery (planters, grass strips, green walls) — keep real
  // parks / gardens / squares / promenades that read as destinations.
  const micro = /plate-?bande|jardini[eè]re|talus|mur|d[eé]cor|arbre|terre-?plein|\bbac\b|d[eé]laiss|accompagnement/i;
  parks = pk
    .map((r): RefPoint | null => {
      const cat = String(r.categorie ?? "");
      if (micro.test(cat)) return null;
      const g = geo(r, "geom_x_y") ?? geo(r, "geo_point_2d");
      return g && inParis(g.lat, g.lng)
        ? { ...g, name: String(r.nom_ev ?? "Espace vert"), meta: cat }
        : null;
    })
    .filter((x): x is RefPoint => x !== null);

  log.info(
    `References: ${stations.length} stations · ${schools.length} schools · ${velibStations.length} Vélib' · ${parks.length} parks`,
  );
}

/** True once at least the core reference sets loaded (live/hybrid, online). */
export const hasReferences = () => stations.length > 0 || schools.length > 0;

function within(points: RefPoint[], lat: number, lng: number, radius: number): number {
  let n = 0;
  for (const p of points) if (haversineMeters(lat, lng, p.lat, p.lng) <= radius) n++;
  return n;
}

function nearest(points: RefPoint[], lat: number, lng: number, radius: number, limit: number): RefPoint[] {
  return points
    .map((p) => ({ p, d: haversineMeters(lat, lng, p.lat, p.lng) }))
    .filter((x) => x.d <= radius)
    .sort((a, b) => a.d - b.d)
    .slice(0, limit)
    .map((x) => x.p);
}

export const refStations = () => stations;
export const refSchoolCount = (lat: number, lng: number, radius: number) => within(schools, lat, lng, radius);
export const refVelibCount = (lat: number, lng: number, radius: number) => within(velibStations, lat, lng, radius);
export const nearestStations = (lat: number, lng: number, radius: number, limit: number) =>
  nearest(stations, lat, lng, radius, limit);
export const nearestVelib = (lat: number, lng: number, radius: number, limit: number) =>
  nearest(velibStations, lat, lng, radius, limit);
export const nearestParks = (lat: number, lng: number, radius: number, limit: number) =>
  nearest(parks, lat, lng, radius, limit);
