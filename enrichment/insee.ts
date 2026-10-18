/**
 * INSEE statistics per arrondissement, from the open Melodi API (key-less):
 *
 *  - DS_POPULATIONS_REFERENCE  → municipal population (latest census year)
 *  - DS_FILOSOFI_CC            → median standard of living (€/yr per
 *                                consumption unit) and poverty rate (%)
 *
 * Paris arrondissements are "arrondissements municipaux" (ARM-751xx). If the
 * API is unreachable the fields stay null — no static guesswork.
 */

import { ENDPOINTS, fetchJson, type PipelineConfig } from "../shared/config.ts";
import { log } from "../shared/logger.ts";
import { ARRONDISSEMENTS, districtFromInsee } from "../shared/paris.ts";
import type { SourceStatus } from "../shared/types.ts";

export interface InseeProfile {
  population: number | null;
  populationYear: string | null;
  income: number | null;
  povertyRate: number | null;
  filosofiYear: string | null;
}

interface MelodiResponse {
  observations?: Array<{
    dimensions: Record<string, string>;
    measures: { OBS_VALUE_NIVEAU?: { value?: number } };
  }>;
}

const GEO = ARRONDISSEMENTS.map((a) => `GEO=ARM-${a.insee}`).join("&");

/** Latest observation per arrondissement for one measure. */
async function melodi(
  dataset: string,
  filter: string,
  config: PipelineConfig,
): Promise<Map<string, { value: number; period: string }> | null> {
  const data = await fetchJson<MelodiResponse>(`${ENDPOINTS.melodi}/${dataset}?${GEO}&${filter}&maxResult=1000`, config);
  if (!data?.observations) return null;
  const out = new Map<string, { value: number; period: string }>();
  for (const o of data.observations) {
    const value = o.measures.OBS_VALUE_NIVEAU?.value;
    const insee = /ARM-(\d{5})$/.exec(o.dimensions.GEO ?? "")?.[1];
    const period = o.dimensions.TIME_PERIOD ?? "";
    if (typeof value !== "number" || !insee) continue;
    const district = districtFromInsee(insee);
    const prev = out.get(district);
    if (!prev || period > prev.period) out.set(district, { value, period });
  }
  return out.size ? out : null;
}

let PROFILES: Map<string, InseeProfile> = new Map();

export async function loadInsee(config: PipelineConfig): Promise<SourceStatus[]> {
  const [pop, income, poverty] = await Promise.all([
    melodi("DS_POPULATIONS_REFERENCE", "POPREF_MEASURE=PMUN", config),
    melodi("DS_FILOSOFI_CC", "FILOSOFI_MEASURE=MED_SL", config),
    melodi("DS_FILOSOFI_CC", "FILOSOFI_MEASURE=PR_MD60", config),
  ]);
  PROFILES = new Map(
    ARRONDISSEMENTS.map((a) => [
      a.district,
      {
        population: pop?.get(a.district)?.value ?? null,
        populationYear: pop?.get(a.district)?.period ?? null,
        income: income?.get(a.district)?.value ?? null,
        povertyRate: poverty?.get(a.district)?.value ?? null,
        filosofiYear: income?.get(a.district)?.period ?? null,
      },
    ]),
  );
  const popYear = pop ? [...pop.values()][0]!.period : undefined;
  const incYear = income ? [...income.values()][0]!.period : undefined;
  log.info(`INSEE: population ${popYear ?? "✗"} · FiLoSoFi ${incYear ?? "✗"}`);
  return [
    {
      id: "insee-pop", label: "INSEE — populations de référence", status: pop ? "ok" : "unavailable",
      url: "https://catalogue-donnees.insee.fr/fr/catalogue/recherche/DS_POPULATIONS_REFERENCE",
      records: pop?.size ?? 0, ...(popYear ? { period: popYear } : {}),
    },
    {
      id: "insee-filosofi", label: "INSEE — FiLoSoFi (niveau de vie, pauvreté)", status: income ? "ok" : "unavailable",
      url: "https://catalogue-donnees.insee.fr/fr/catalogue/recherche/DS_FILOSOFI_CC",
      records: income?.size ?? 0, ...(incYear ? { period: incYear } : {}),
    },
  ];
}

export function getInseeProfile(district: string): InseeProfile {
  return (
    PROFILES.get(district) ?? { population: null, populationYear: null, income: null, povertyRate: null, filosofiYear: null }
  );
}
