/**
 * Energy performance (DPE) from ADEME open data — matched to the sale itself.
 *
 * A DPE is mandatory to sell a home, so the seller's certificate is usually in
 * ADEME's "DPE logements existants (depuis juillet 2021)" dataset. We fetch
 * every certificate registered at the property's BAN address and:
 *
 *  - "unit" match: an apartment certificate whose habitable surface matches the
 *    DVF surface (Carrez or bâtie, ±7 % / 2 m²). Certificates issued before the
 *    sale (the seller's, mandatory for the deed) win over later ones; then the
 *    closest surface, then the most recent. That is this apartment's DPE.
 *  - "building" fallback: no surface match, but certificates exist at the same
 *    address → we report their median class, clearly labelled as such.
 *  - no certificate at the address → null (shown as "no DPE on file").
 */

import { ENDPOINTS, fetchJson, type PipelineConfig } from "../shared/config.ts";
import { median, round } from "../shared/geo.ts";
import type { Dpe } from "../shared/types.ts";

interface AdemeLine {
  etiquette_dpe?: string;
  etiquette_ges?: string;
  type_batiment?: string;
  surface_habitable_logement?: number;
  date_etablissement_dpe?: string;
  cout_total_5_usages?: number;
  annee_construction?: number;
  periode_construction?: string;
}

interface AdemeResponse {
  results?: AdemeLine[];
}

const CLASSES = ["A", "B", "C", "D", "E", "F", "G"];
const isClass = (c?: string): c is string => !!c && CLASSES.includes(c);
const medianClass = (cs: string[]): string => CLASSES[Math.round(median(cs.map((c) => CLASSES.indexOf(c))))]!;

const FIELDS = [
  "etiquette_dpe", "etiquette_ges", "type_batiment", "surface_habitable_logement",
  "date_etablissement_dpe", "cout_total_5_usages", "annee_construction", "periode_construction",
].join(",");

/**
 * DPE for a sale, `null` when ADEME has no certificate at the address, or
 * `undefined` when the API was unreachable (retry on a later run).
 */
export async function lookupDpe(
  banId: string,
  surfaces: number[],
  saleDate: string,
  config: PipelineConfig,
): Promise<Dpe | null | undefined> {
  // A DPE dated up to ~3 months after the deed can still be the seller's.
  const cutoff = new Date(Date.parse(saleDate) + 90 * 86_400_000).toISOString().slice(0, 10);
  const url = `${ENDPOINTS.ademeDpe}?identifiant_ban_eq=${encodeURIComponent(banId)}&size=200&select=${FIELDS}`;
  const data = await fetchJson<AdemeResponse>(url, config);
  if (!data) return undefined;
  const certs = (data.results ?? []).filter((c) => isClass(c.etiquette_dpe));
  if (certs.length === 0) return null;

  const years = certs.map((c) => c.annee_construction).filter((y): y is number => !!y && y > 1500 && y < 2100);
  const periods = certs.map((c) => c.periode_construction).filter((p): p is string => !!p);
  const year_built = years.length ? Math.round(median(years)) : null;
  const period = periods.length ? mode(periods) : null;

  // Unit match on surface.
  let best: { c: AdemeLine; gap: number; pre: boolean } | null = null;
  for (const c of certs) {
    const s = c.surface_habitable_logement;
    if (c.type_batiment !== "appartement" || !s) continue;
    const gap = Math.min(...surfaces.map((ref) => Math.abs(s - ref) / Math.max(ref, 1)));
    const tolerance = Math.max(0.07, 2 / Math.max(...surfaces));
    if (gap > tolerance) continue;
    const pre = (c.date_etablissement_dpe ?? "9999") <= cutoff;
    const better =
      !best ||
      (pre && !best.pre) ||
      (pre === best.pre &&
        (gap < best.gap - 1e-9 ||
          (Math.abs(gap - best.gap) < 1e-9 && (c.date_etablissement_dpe ?? "") > (best.c.date_etablissement_dpe ?? ""))));
    if (better) best = { c, gap, pre };
  }
  if (best) {
    const c = best.c;
    return {
      energy_class: c.etiquette_dpe!,
      ghg_class: isClass(c.etiquette_ges) ? c.etiquette_ges : c.etiquette_dpe!,
      scope: "unit",
      certificates: certs.length,
      date: c.date_etablissement_dpe ?? null,
      surface_m2: c.surface_habitable_logement ? round(c.surface_habitable_logement, 1) : null,
      energy_cost_eur: c.cout_total_5_usages ? round(c.cout_total_5_usages) : null,
      year_built,
      period,
    };
  }

  const ghg = certs.map((c) => c.etiquette_ges).filter(isClass);
  return {
    energy_class: medianClass(certs.map((c) => c.etiquette_dpe!)),
    ghg_class: ghg.length ? medianClass(ghg) : medianClass(certs.map((c) => c.etiquette_dpe!)),
    scope: "building",
    certificates: certs.length,
    date: null,
    surface_m2: null,
    energy_cost_eur: null,
    year_built,
    period,
  };
}

function mode(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]![0];
}
