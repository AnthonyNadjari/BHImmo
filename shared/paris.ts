/**
 * Static reference data for Paris intra-muros.
 *
 * - Arrondissement centroids + DVF-style reference €/m² (calibrated to ~2024
 *   market levels). This doubles as our static INSEE-like reference dataset.
 * - A curated set of métro/RER stations (approximate WGS84 coordinates) used
 *   to compute a transport score offline / as Overpass fallback.
 * - Sample street names for generating realistic synthetic listings.
 *
 * Everything here is public knowledge; coordinates are approximate but good
 * enough for proximity scoring.
 */

export interface Arrondissement {
  /** INSEE-style postal code, e.g. "75011". */
  district: string;
  name: string;
  lat: number;
  lng: number;
  /** Reference transaction price €/m² (DVF-anchored baseline). */
  refPriceM2: number;
  /** Baseline annual trend used when DVF history is unavailable, in %. */
  baseTrend1y: number;
}

export const ARRONDISSEMENTS: Arrondissement[] = [
  { district: "75001", name: "Louvre", lat: 48.8625, lng: 2.336, refPriceM2: 13500, baseTrend1y: -1.2 },
  { district: "75002", name: "Bourse", lat: 48.868, lng: 2.3417, refPriceM2: 12200, baseTrend1y: -0.8 },
  { district: "75003", name: "Temple", lat: 48.863, lng: 2.362, refPriceM2: 13000, baseTrend1y: -1.0 },
  { district: "75004", name: "Hôtel-de-Ville", lat: 48.855, lng: 2.357, refPriceM2: 13800, baseTrend1y: -1.4 },
  { district: "75005", name: "Panthéon", lat: 48.8448, lng: 2.35, refPriceM2: 13200, baseTrend1y: -0.9 },
  { district: "75006", name: "Luxembourg", lat: 48.849, lng: 2.333, refPriceM2: 15500, baseTrend1y: -0.6 },
  { district: "75007", name: "Palais-Bourbon", lat: 48.857, lng: 2.312, refPriceM2: 15000, baseTrend1y: -0.7 },
  { district: "75008", name: "Élysée", lat: 48.872, lng: 2.312, refPriceM2: 12500, baseTrend1y: -1.1 },
  { district: "75009", name: "Opéra", lat: 48.877, lng: 2.338, refPriceM2: 11500, baseTrend1y: -1.3 },
  { district: "75010", name: "Entrepôt", lat: 48.876, lng: 2.359, refPriceM2: 10500, baseTrend1y: -1.6 },
  { district: "75011", name: "Popincourt", lat: 48.859, lng: 2.379, refPriceM2: 10800, baseTrend1y: -1.5 },
  { district: "75012", name: "Reuilly", lat: 48.84, lng: 2.388, refPriceM2: 10200, baseTrend1y: -1.7 },
  { district: "75013", name: "Gobelins", lat: 48.829, lng: 2.355, refPriceM2: 9700, baseTrend1y: -1.9 },
  { district: "75014", name: "Observatoire", lat: 48.833, lng: 2.326, refPriceM2: 10600, baseTrend1y: -1.4 },
  { district: "75015", name: "Vaugirard", lat: 48.842, lng: 2.297, refPriceM2: 10800, baseTrend1y: -1.3 },
  { district: "75016", name: "Passy", lat: 48.86, lng: 2.262, refPriceM2: 11800, baseTrend1y: -1.0 },
  { district: "75017", name: "Batignolles-Monceau", lat: 48.887, lng: 2.307, refPriceM2: 11200, baseTrend1y: -1.2 },
  { district: "75018", name: "Buttes-Montmartre", lat: 48.892, lng: 2.344, refPriceM2: 9800, baseTrend1y: -2.0 },
  { district: "75019", name: "Buttes-Chaumont", lat: 48.887, lng: 2.382, refPriceM2: 8900, baseTrend1y: -2.2 },
  { district: "75020", name: "Ménilmontant", lat: 48.864, lng: 2.398, refPriceM2: 9400, baseTrend1y: -2.1 },
];

export const ARRONDISSEMENT_BY_CODE: Map<string, Arrondissement> = new Map(
  ARRONDISSEMENTS.map((a) => [a.district, a]),
);

export const CITY_AVG_PRICE_M2 = Math.round(
  ARRONDISSEMENTS.reduce((s, a) => s + a.refPriceM2, 0) / ARRONDISSEMENTS.length,
);

export interface Station {
  name: string;
  lat: number;
  lng: number;
}

/** Curated métro/RER stations (approximate coordinates). */
export const STATIONS: Station[] = [
  { name: "Châtelet", lat: 48.8585, lng: 2.347 },
  { name: "Palais Royal", lat: 48.8629, lng: 2.3367 },
  { name: "Tuileries", lat: 48.8645, lng: 2.3293 },
  { name: "Bourse", lat: 48.8688, lng: 2.3408 },
  { name: "Grands Boulevards", lat: 48.8714, lng: 2.343 },
  { name: "Arts et Métiers", lat: 48.8654, lng: 2.3562 },
  { name: "République", lat: 48.8675, lng: 2.3635 },
  { name: "Hôtel de Ville", lat: 48.8573, lng: 2.3514 },
  { name: "Saint-Paul", lat: 48.8553, lng: 2.3608 },
  { name: "Bastille", lat: 48.8533, lng: 2.369 },
  { name: "Jussieu", lat: 48.8463, lng: 2.3547 },
  { name: "Place Monge", lat: 48.843, lng: 2.352 },
  { name: "Saint-Michel", lat: 48.8534, lng: 2.344 },
  { name: "Odéon", lat: 48.8519, lng: 2.339 },
  { name: "Saint-Germain-des-Prés", lat: 48.8537, lng: 2.3338 },
  { name: "Montparnasse", lat: 48.844, lng: 2.321 },
  { name: "Invalides", lat: 48.8615, lng: 2.3145 },
  { name: "École Militaire", lat: 48.8546, lng: 2.305 },
  { name: "Sèvres-Babylone", lat: 48.8514, lng: 2.3266 },
  { name: "Franklin Roosevelt", lat: 48.8689, lng: 2.3097 },
  { name: "Saint-Lazare", lat: 48.8755, lng: 2.3253 },
  { name: "Concorde", lat: 48.8656, lng: 2.3212 },
  { name: "Opéra", lat: 48.8709, lng: 2.3324 },
  { name: "Pigalle", lat: 48.882, lng: 2.3375 },
  { name: "Chaussée d'Antin", lat: 48.8728, lng: 2.334 },
  { name: "Gare du Nord", lat: 48.8801, lng: 2.3553 },
  { name: "Gare de l'Est", lat: 48.8765, lng: 2.359 },
  { name: "Jacques Bonsergent", lat: 48.8709, lng: 2.3608 },
  { name: "Oberkampf", lat: 48.8649, lng: 2.368 },
  { name: "Voltaire", lat: 48.8578, lng: 2.38 },
  { name: "Nation", lat: 48.8484, lng: 2.3958 },
  { name: "Père Lachaise", lat: 48.8629, lng: 2.3877 },
  { name: "Gare de Lyon", lat: 48.8443, lng: 2.3735 },
  { name: "Bercy", lat: 48.8401, lng: 2.3793 },
  { name: "Daumesnil", lat: 48.8393, lng: 2.3958 },
  { name: "Reuilly-Diderot", lat: 48.8473, lng: 2.3863 },
  { name: "Place d'Italie", lat: 48.8316, lng: 2.3556 },
  { name: "Tolbiac", lat: 48.826, lng: 2.3573 },
  { name: "Bibliothèque", lat: 48.8299, lng: 2.3766 },
  { name: "Corvisart", lat: 48.8298, lng: 2.3496 },
  { name: "Denfert-Rochereau", lat: 48.8339, lng: 2.3324 },
  { name: "Alésia", lat: 48.8281, lng: 2.327 },
  { name: "Pernety", lat: 48.834, lng: 2.318 },
  { name: "Convention", lat: 48.8377, lng: 2.2972 },
  { name: "Pasteur", lat: 48.8424, lng: 2.3128 },
  { name: "La Motte-Picquet", lat: 48.8488, lng: 2.2982 },
  { name: "Balard", lat: 48.8363, lng: 2.2785 },
  { name: "Trocadéro", lat: 48.8631, lng: 2.2877 },
  { name: "Passy", lat: 48.8577, lng: 2.2855 },
  { name: "La Muette", lat: 48.8581, lng: 2.274 },
  { name: "Auteuil", lat: 48.8475, lng: 2.2647 },
  { name: "Charles de Gaulle — Étoile", lat: 48.874, lng: 2.295 },
  { name: "Place de Clichy", lat: 48.8835, lng: 2.3274 },
  { name: "Villiers", lat: 48.8814, lng: 2.3168 },
  { name: "Pereire", lat: 48.8849, lng: 2.2997 },
  { name: "Ternes", lat: 48.8783, lng: 2.298 },
  { name: "Abbesses", lat: 48.8844, lng: 2.3383 },
  { name: "Barbès-Rochechouart", lat: 48.8835, lng: 2.3494 },
  { name: "Jules Joffrin", lat: 48.8925, lng: 2.3442 },
  { name: "Porte de Clignancourt", lat: 48.8975, lng: 2.3447 },
  { name: "Jaurès", lat: 48.8826, lng: 2.3702 },
  { name: "Stalingrad", lat: 48.8841, lng: 2.3669 },
  { name: "Buttes Chaumont", lat: 48.8783, lng: 2.381 },
  { name: "Ourcq", lat: 48.8869, lng: 2.3865 },
  { name: "Place des Fêtes", lat: 48.8765, lng: 2.3925 },
  { name: "Gambetta", lat: 48.8651, lng: 2.3987 },
  { name: "Ménilmontant", lat: 48.8692, lng: 2.3835 },
  { name: "Pyrénées", lat: 48.8736, lng: 2.3866 },
  { name: "Alexandre Dumas", lat: 48.8556, lng: 2.395 },
];

/**
 * Real Paris streets grouped by the arrondissement they actually belong to, so
 * synthetic addresses stay internally consistent (street ↔ district).
 */
export const STREETS_BY_DISTRICT: Record<string, string[]> = {
  "75001": ["rue de Rivoli", "rue Saint-Honoré", "rue du Louvre", "rue de l'Arbre Sec"],
  "75002": ["rue Montorgueil", "rue Réaumur", "rue d'Aboukir", "rue Saint-Augustin"],
  "75003": ["rue de Turbigo", "rue de Bretagne", "rue des Archives", "rue Charlot"],
  "75004": ["rue Saint-Antoine", "rue des Rosiers", "rue de Rivoli", "rue Vieille du Temple"],
  "75005": ["rue Monge", "rue Mouffetard", "rue des Écoles", "boulevard Saint-Germain"],
  "75006": ["rue de Rennes", "rue de Sèvres", "rue Bonaparte", "rue de Vaugirard"],
  "75007": ["rue Cler", "rue Saint-Dominique", "rue du Bac", "avenue Bosquet"],
  "75008": ["rue de la Boétie", "rue de Courcelles", "avenue de Friedland", "rue de Lisbonne"],
  "75009": ["rue des Martyrs", "rue La Fayette", "rue de Maubeuge", "rue Saint-Lazare"],
  "75010": ["rue du Faubourg Saint-Denis", "quai de Valmy", "rue des Vinaigriers", "rue de Lancry"],
  "75011": ["boulevard Voltaire", "rue Oberkampf", "rue de la Roquette", "rue de Charonne"],
  "75012": ["rue de Charenton", "avenue Daumesnil", "rue Crozatier", "rue de Reuilly"],
  "75013": ["rue de Tolbiac", "boulevard Auguste Blanqui", "rue Bobillot", "avenue d'Italie"],
  "75014": ["rue d'Alésia", "avenue du Maine", "rue Didot", "rue Raymond Losserand"],
  "75015": ["rue de la Convention", "rue Lecourbe", "rue de Vaugirard", "rue du Commerce"],
  "75016": ["avenue Mozart", "rue de Passy", "rue de la Pompe", "boulevard Exelmans"],
  "75017": ["rue de Lévis", "avenue de Clichy", "rue de Tocqueville", "rue des Batignolles"],
  "75018": ["rue Ordener", "rue Marcadet", "rue des Abbesses", "rue Custine"],
  "75019": ["avenue Jean Jaurès", "rue de Belleville", "rue de Crimée", "avenue Secrétan"],
  "75020": ["rue des Pyrénées", "boulevard de Ménilmontant", "rue de Bagnolet", "rue des Gâtines"],
};
