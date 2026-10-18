/**
 * Paris intra-muros arrondissements: postcode, INSEE commune code and official
 * name. Everything quantitative (prices, trends, population, income, centroids)
 * is loaded from open data at run time — see `scraper/dvf-source.ts` and
 * `enrichment/reference.ts`.
 */

export interface Arrondissement {
  /** Postcode, e.g. "75011". */
  district: string;
  /** INSEE arrondissement-municipal code, e.g. "75111". */
  insee: string;
  /** Official name. */
  name: string;
}

const NAMES = [
  "Louvre", "Bourse", "Temple", "Hôtel-de-Ville", "Panthéon", "Luxembourg", "Palais-Bourbon",
  "Élysée", "Opéra", "Entrepôt", "Popincourt", "Reuilly", "Gobelins", "Observatoire",
  "Vaugirard", "Passy", "Batignolles-Monceau", "Buttes-Montmartre", "Buttes-Chaumont", "Ménilmontant",
];

export const ARRONDISSEMENTS: Arrondissement[] = NAMES.map((name, i) => {
  const n = String(i + 1).padStart(2, "0");
  return { district: `750${n}`, insee: `751${n}`, name };
});

export const ARRONDISSEMENT_BY_CODE: Map<string, Arrondissement> = new Map(
  ARRONDISSEMENTS.map((a) => [a.district, a]),
);

/** "75111" (INSEE) → "75011" (postcode). */
export const districtFromInsee = (insee: string): string => `750${insee.slice(3)}`;
