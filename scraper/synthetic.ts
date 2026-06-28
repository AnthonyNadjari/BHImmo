/**
 * Deterministic synthetic listing universe.
 *
 * Real estate portals don't expose a free, scraping-friendly API, so — as the
 * spec allows — we *simulate* the market. The key property is determinism:
 * every listing is fully derived from its stable id, and its observed price is
 * a pure function of the date. That means the same listing reappears across
 * pipeline runs with a coherent, evolving price history, and re-running the
 * seeder reproduces byte-identical data.
 */

import { SeededRandom } from "../shared/prng.ts";
import { ARRONDISSEMENTS, STREETS_BY_DISTRICT } from "../shared/paris.ts";
import { clamp, round } from "../shared/geo.ts";
import type { RawListing } from "./types.ts";

/** Absolute anchor for the synthetic market clock. */
const EPOCH = Date.UTC(2025, 8, 1); // 2025-09-01
const DAY_MS = 86_400_000;
const UNIVERSE_SIZE = 90;

interface PriceDrop {
  /** Days after creation when the drop happens. */
  dayOffset: number;
  /** Fraction removed from the current price (0–1). */
  fraction: number;
}

interface SyntheticListing {
  externalId: string;
  district: string;
  street: string;
  number: number;
  surface_m2: number;
  rooms: number;
  floor: number;
  createdOffsetDays: number;
  lifespanDays: number;
  initialPrice: number;
  drops: PriceDrop[];
  fallbackLat: number;
  fallbackLng: number;
  /** True if the listing ends in a sale rather than a silent removal. */
  endsInSale: boolean;
}

/** Build the immutable universe once; pure function of the id seeds. */
function buildUniverse(): SyntheticListing[] {
  const listings: SyntheticListing[] = [];

  for (let i = 0; i < UNIVERSE_SIZE; i++) {
    const id = `lst-${String(i + 1).padStart(4, "0")}`;
    const rng = new SeededRandom(id);

    const arr = rng.pick(ARRONDISSEMENTS);
    const street = rng.pick(STREETS_BY_DISTRICT[arr.district]!);
    const number = rng.int(1, 180);

    // Surface scales with room count, with realistic Parisian compactness.
    const rooms = pickRooms(rng);
    const surface = round(
      clamp(rng.gaussian(rooms * 19 + 6, 6), 12, rooms * 30 + 25),
    );
    const floor = rng.int(0, 7);

    // Intrinsic value: a multiple of the arrondissement reference €/m².
    // Factor < 1 → priced under market (potential opportunity); > 1 → over.
    const valueFactor = clamp(rng.gaussian(1.0, 0.16), 0.66, 1.45);
    const initialPriceM2 = arr.refPriceM2 * valueFactor;
    const initialPrice = round(initialPriceM2 * surface, -2); // nearest 100 €

    const createdOffsetDays = rng.int(0, 300);
    const lifespanDays = rng.int(35, 220);

    // 0–3 scheduled price drops; under-priced listings drop less often.
    const dropCount = pickDropCount(rng, valueFactor);
    const drops: PriceDrop[] = [];
    let prevOffset = rng.int(20, 45);
    for (let d = 0; d < dropCount; d++) {
      drops.push({ dayOffset: prevOffset, fraction: rng.range(0.02, 0.07) });
      prevOffset += rng.int(25, 55);
    }

    // Jitter coordinates around the arrondissement centroid (~±900 m).
    const fallbackLat = arr.lat + rng.range(-0.008, 0.008);
    const fallbackLng = arr.lng + rng.range(-0.011, 0.011);

    listings.push({
      externalId: id,
      district: arr.district,
      street,
      number,
      surface_m2: surface,
      rooms,
      floor,
      createdOffsetDays,
      lifespanDays,
      initialPrice,
      drops,
      fallbackLat: round(fallbackLat, 6),
      fallbackLng: round(fallbackLng, 6),
      endsInSale: rng.chance(0.55),
    });
  }

  return listings;
}

function pickRooms(rng: SeededRandom): number {
  const r = rng.float();
  if (r < 0.28) return 1;
  if (r < 0.58) return 2;
  if (r < 0.82) return 3;
  if (r < 0.95) return 4;
  return 5;
}

function pickDropCount(rng: SeededRandom, valueFactor: number): number {
  // Over-priced listings are more likely to accumulate drops over time.
  const base = valueFactor > 1.1 ? 0.65 : valueFactor > 0.95 ? 0.45 : 0.3;
  if (!rng.chance(base)) return 0;
  if (!rng.chance(0.5)) return 1;
  if (!rng.chance(0.5)) return 2;
  return 3;
}

const UNIVERSE = buildUniverse();

/** Price observed for a listing `daysSinceCreated` days into its life. */
function priceAt(listing: SyntheticListing, daysSinceCreated: number): number {
  let price = listing.initialPrice;
  for (const drop of listing.drops) {
    if (daysSinceCreated >= drop.dayOffset) {
      price = price * (1 - drop.fraction);
    }
  }
  return round(price, -2);
}

function toISO(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Returns the listings that are "live" (visible on the portal) at `now`, with
 * their current observed price. Listings outside their active window are
 * omitted — the matching engine interprets their disappearance as sold/removed.
 */
export function liveListingsAt(now: Date): RawListing[] {
  const nowMs = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );

  const result: RawListing[] = [];
  for (const l of UNIVERSE) {
    const createdMs = EPOCH + l.createdOffsetDays * DAY_MS;
    const expiryMs = createdMs + l.lifespanDays * DAY_MS;
    if (nowMs < createdMs || nowMs > expiryMs) continue;

    const daysSinceCreated = Math.floor((nowMs - createdMs) / DAY_MS);
    const price = priceAt(l, daysSinceCreated);

    result.push({
      source: "synthetic",
      externalId: l.externalId,
      rawAddress: `${l.number} ${l.street}, ${l.district} Paris`,
      district: l.district,
      surface_m2: l.surface_m2,
      rooms: l.rooms,
      floor: l.floor,
      price,
      observedDate: toISO(nowMs),
      url: `https://example.invalid/listing/${l.externalId}`,
      fallbackLat: l.fallbackLat,
      fallbackLng: l.fallbackLng,
    });
  }
  return result;
}

/** Whether a previously-seen listing that has now disappeared was sold. */
export function listingEndedInSale(externalId: string): boolean {
  const l = UNIVERSE.find((x) => x.externalId === externalId);
  return l?.endsInSale ?? false;
}
