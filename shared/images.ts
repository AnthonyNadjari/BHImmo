/**
 * Deterministic listing imagery.
 *
 * Synthetic listings have no real photos, so each property id is mapped to a
 * stable gallery drawn from a curated pool of real interior/apartment photos
 * hosted on the Unsplash CDN (free, hot-linkable, fast). The mapping is a pure
 * function of the id, so the gallery is consistent across pipeline runs and
 * the dataset stays deterministic. The frontend additionally falls back to a
 * seeded picsum image if any URL ever fails to load.
 */

import { SeededRandom } from "./prng.ts";

/**
 * Curated Unsplash photo ids — APARTMENT INTERIORS only (living rooms,
 * kitchens, bedrooms). Deliberately excludes houses/villas/pools/exteriors,
 * which look absurd for a Paris flat. Representative imagery: DVF carries no
 * per-listing photos.
 */
const POOL: string[] = [
  "1522708323590-d24dbb6b0267", // living room
  "1493809842364-78817add7ffb", // living room / sofa
  "1502672260266-1c1ef2d93688", // bright minimalist interior
  "1505691938895-1758d7feb511", // living room
  "1560448204-e02f11c3d0e2", // modern living room
  "1554995207-c18c203602cb", // living room
  "1484154218962-a197022b5858", // white kitchen
  "1556912173-3bb406ef7e77", // kitchen
  "1493663284031-b7e3aefcae8e", // kitchen / dining
  "1502005097973-6a7082348e28", // bedroom
  "1540518614846-7eded433c457", // interior decor
  "1567496898669-ee935f5f647a", // interior
];

function unsplash(id: string, width: number, height: number, quality = 62): string {
  // Serve at a defined aspect ratio so the UI's object-fit:cover shows the
  // whole framed photo instead of an awkward crop.
  return `https://images.unsplash.com/photo-${id}?w=${width}&h=${height}&q=${quality}&auto=format&fit=crop&crop=entropy`;
}

export interface ImageSet {
  images: string[];
  thumb: string;
}

/** Deterministic gallery (5 photos) + thumbnail for a property id. */
export function imageSet(id: string, count = 5): ImageSet {
  const rng = new SeededRandom(`img:${id}`);
  const pool = [...POOL];
  // Fisher–Yates shuffle seeded by the id.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  const picks = pool.slice(0, count);
  return {
    // 16:10 landscape — matches the gallery hero and the card-grid thumbnails.
    images: picks.map((p) => unsplash(p, 1200, 750, 66)),
    thumb: unsplash(picks[0]!, 480, 300, 55),
  };
}
