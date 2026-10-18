/**
 * Flood-risk lookup at the address, from the Géorisques API (key-less):
 *
 *  - Flood: TRI zoning (Territoires à Risque important d'Inondation). Paris is
 *    inside the "Métropole francilienne" TRI, whose maps cover the whole city,
 *    so "no zone" at a point means outside every mapped flood scenario.
 *      01For → high probability · 02Moy/03Mcc → medium (the 1910-type flood)
 *      04Fai → low probability (extreme scenario) · none → 0
 *
 * (Géorisques' clay shrink–swell endpoint answers nothing for Paris addresses,
 * so it is not queried.)
 *
 * Resolves to the risk, or `undefined` (API unreachable → retry on a later run).
 */

import { ENDPOINTS, fetchJson, type PipelineConfig } from "../shared/config.ts";
import type { RiskFact } from "../shared/types.ts";

interface TriResponse {
  results?: number;
  data?: Array<{ scenario?: { code?: string; libelle?: string }; libelle_tri?: string }>;
}

const TRI_LEVEL: Array<[RegExp, number]> = [
  [/^01/, 1],
  [/^0[23]/, 0.66],
  [/^04/, 0.33],
];

export async function lookupFlood(lat: number, lng: number, config: PipelineConfig): Promise<RiskFact | undefined> {
  const data = await fetchJson<TriResponse>(`${ENDPOINTS.georisquesTri}?latlon=${lng},${lat}`, config);
  if (!data || typeof data.results !== "number") return undefined;
  let best: { value: number; label: string } = { value: 0, label: "hors zone inondable cartographiée (TRI)" };
  for (const z of data.data ?? []) {
    const code = z.scenario?.code ?? "";
    const value = TRI_LEVEL.find(([re]) => re.test(code))?.[1] ?? 0;
    if (value > best.value) best = { value, label: z.scenario?.libelle ?? code };
  }
  return { ...best, scope: "point", source: "Géorisques — TRI" };
}
