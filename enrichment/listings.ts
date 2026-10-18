/**
 * Listings on the market (Stream.estate) → `Listing` records, valued with the
 * same real-data engine as the DVF sales:
 *
 *  - asking price vs. what similar-size DVF sales nearby imply (latest 12
 *    months of DVF, restated at the latest DVF quarter),
 *  - the asking-price history from the adverts' events (real price drops),
 *    days on market, legal rent ceiling → yield, IDFM transport,
 *  - the same deal score, so listings and past sales are comparable.
 *
 * Records are merged with the previous run (the fetch is incremental) and
 * re-valued every run; listings off the market for > 90 days are dropped.
 */

import { join } from "node:path";
import { DATA_DIR, type PipelineConfig } from "../shared/config.ts";
import { round } from "../shared/geo.ts";
import { log } from "../shared/logger.ts";
import type { Listing, ListingPricePoint, ListingsFile, SourceStatus } from "../shared/types.ts";
import { fetchParisListings, hasListingsKey, type SeProperty } from "../scraper/listings-source.ts";
import type { DistrictMarket, DvfData, DvfTxn, PriceIndex } from "../scraper/index.ts";
import { computeScore, gentrificationByDistrict } from "../scoring/score.ts";
import { enrichDvf } from "./dvf.ts";
import { getInseeProfile } from "./insee.ts";
import { enrichNeighborhood } from "./neighborhood.ts";
import { findQuartier, type References } from "./reference.ts";
import { enrichRent } from "./rent.ts";
import { enrichTransport } from "./transport.ts";

export const LISTINGS_FILE = "listings.json";
const DAY_MS = 86_400_000;
const KEEP_EXPIRED_DAYS = 90;

const day = (iso?: string) => (iso ?? "").slice(0, 10);

/** Paris postcode → arrondissement ("75116" is the 16e). */
function districtOf(zip?: string): string | null {
  if (!zip) return null;
  if (zip === "75116") return "75016";
  return /^750(0[1-9]|1\d|20)$/.test(zip) ? zip : null;
}

/** Asking-price history from the adverts' "price" events, oldest first. */
function priceHistory(p: SeProperty, price: number, listedAt: string): ListingPricePoint[] {
  const events = (p.adverts ?? [])
    .flatMap((a) => a.events ?? [])
    .filter((e) => e.fieldName === "price" && e.createdAt && Number(e.fieldNewValue) > 0)
    .sort((a, b) => a.createdAt!.localeCompare(b.createdAt!));
  const points: ListingPricePoint[] = [];
  const first = Number(events[0]?.fieldOldValue);
  points.push({ date: listedAt, price: Number.isFinite(first) && first > 0 ? round(first) : price });
  for (const e of events) points.push({ date: day(e.createdAt), price: round(Number(e.fieldNewValue)) });
  if (points[points.length - 1]!.price !== price) points.push({ date: day(p.updatedAt) || listedAt, price });
  // Collapse repeats (several adverts reporting the same change).
  return points.filter((pt, i) => i === 0 || pt.price !== points[i - 1]!.price);
}

/** Map one provider record; null when it lacks what the valuation needs. */
function toListing(p: SeProperty, now: Date): Omit<Listing, "dvf" | "rent" | "transport" | "investment" | "score" | "explanations" | "address"> & {
  address: Omit<Listing["address"], "quartier">;
} | null {
  const district = districtOf(p.city?.zipcode);
  const lat = p.locations?.lat;
  const lng = p.locations?.lon;
  const price = Number(p.price);
  const surface = Number(p.surface);
  if (!district || typeof lat !== "number" || typeof lng !== "number" || !(price > 0) || !(surface >= 9)) return null;

  const adverts = p.adverts ?? [];
  const listedAt = day(p.createdAt) || day(adverts.map((a) => a.createdAt ?? "").sort()[0]);
  const history = priceHistory(p, round(price), listedAt);
  let drops = 0;
  for (let i = 1; i < history.length; i++) if (history[i]!.price < history[i - 1]!.price) drops++;
  const end = p.expired && p.expiredAt ? Date.parse(p.expiredAt) : now.getTime();
  const withEnergy = adverts.find((a) => a.energy?.category && /^[A-G]$/.test(a.energy.category));
  const pub = adverts.find((a) => a.publisher?.name)?.publisher;
  const pictures = [...new Set(p.pictures?.length ? p.pictures : adverts.flatMap((a) => a.pictures ?? []))].slice(0, 20);

  return {
    id: `se-${p.uuid}`,
    title: (p.title ?? "").trim(),
    description: (p.description ?? "").replace(/\s+/g, " ").trim().slice(0, 1500),
    urls: [...new Set(adverts.map((a) => a.url).filter((u): u is string => !!u))].slice(0, 5),
    publisher: pub?.name ?? null,
    publisher_type: pub?.type === 1 ? "agency" : pub?.type === 0 ? "individual" : null,
    address: { lat: round(lat, 6), lng: round(lng, 6), district },
    surface_m2: round(surface, 1),
    rooms: p.room ?? null,
    bedrooms: p.bedroom ?? null,
    floor: p.floor ?? adverts.find((a) => typeof a.floor === "number")?.floor ?? null,
    construction_year: adverts.find((a) => a.constructionYear)?.constructionYear ?? null,
    condo_fees: adverts.find((a) => a.condominiumFees)?.condominiumFees ?? null,
    price: round(price),
    price_per_m2: round(price / surface),
    pictures,
    listed_at: listedAt,
    updated_at: day(p.updatedAt) || listedAt,
    days_on_market: Math.max(0, Math.floor((end - Date.parse(listedAt)) / DAY_MS)),
    expired: !!p.expired,
    expired_at: p.expired ? day(p.expiredAt) || null : null,
    price_history: history,
    price_drops: drops,
    price_change_pct: round(((round(price) - history[0]!.price) / history[0]!.price) * 100, 1),
    dpe: withEnergy
      ? {
          energy_class: withEnergy.energy!.category!,
          ghg_class: /^[A-G]$/.test(withEnergy.greenHouseGas?.category ?? "") ? withEnergy.greenHouseGas!.category! : null,
        }
      : null,
    fetched_at: now.toISOString(),
  };
}

export interface ListingsContext {
  dvf: DvfData;
  index: PriceIndex;
  refs: References;
  markets: Map<string, DistrictMarket>;
  cityTrend: number | null;
  latestYear: string;
  districtPpm2: Map<string, number[]>;
}

const fr = (n: number) => n.toLocaleString("fr-FR");

/** Value, score and explain every listing in place. */
function valueListings(listings: Listing[], ctx: ListingsContext): void {
  const markets = [...ctx.markets.values()];
  const gent = gentrificationByDistrict(
    markets.map((m) => ({ district: m.district, trend: m.trendPct, medianPpm2: m.medianLatest, income: getInseeProfile(m.district).income })),
    ctx.cityTrend,
  );
  const medians = markets.map((m) => m.medianLatest);
  const rank = (values: number[], v: number) => (values.filter((x) => x < v).length / Math.max(1, values.length - 1)) * 100;
  const lastSale = ctx.dvf.coverage.last_sale;

  for (const l of listings) {
    const { lat, lng } = l.address;
    // Value against the latest 12 months of DVF (no DVF exists for "today").
    const subject = { id: l.id, date: lastSale, lat, lng, surface: l.surface_m2 } as DvfTxn;
    l.dvf = enrichDvf(ctx.dvf, subject, ctx.index);
    if (ctx.refs.rent) l.address.quartier = findQuartier(ctx.refs, lat, lng)?.quartier ?? null;
    const built = l.construction_year ? { year_built: l.construction_year, period: null, source: "advert" as const } : null;
    if (ctx.refs.rent) l.rent = enrichRent(lat, lng, l.rooms ?? 1, l.surface_m2, built, ctx.refs);
    if (ctx.refs.stations) l.transport = enrichTransport(lat, lng, ctx.refs);
  }
  const volumes = listings.map((l) => l.dvf.count_500m);

  for (const l of listings) {
    const market = ctx.markets.get(l.address.district);
    const out = computeScore({
      price: l.price,
      price_per_m2: l.price_per_m2,
      surface_m2: l.surface_m2,
      dvf: l.dvf,
      transport_score: l.transport?.score ?? null,
      walk_score: enrichNeighborhood(l.address.lat, l.address.lng, l.address.district, ctx.refs).walk_score,
      rent_max_m2: l.rent?.max_m2 ?? null,
      rent_surface_m2: l.surface_m2,
      energy_class: l.dpe?.energy_class ?? null,
      districtPpm2: ctx.districtPpm2.get(l.address.district) ?? [],
      demand: market ? rank(medians, market.medianLatest) : null,
      volume: rank(volumes, l.dvf.count_500m),
      gentrification: gent.get(l.address.district) ?? null,
    });
    l.score = out.score;
    l.investment = out.investment;

    const lines: string[] = [];
    const gap = out.investment.dvf_gap_pct;
    const b = l.dvf.reference_basis;
    if (gap !== null && out.dvfReference && b) {
      const what = `${b.comps} ${b.size_min !== null ? "similar-size " : ""}DVF sales ≤ ${b.radius_m} m (up to ${lastSale.slice(0, 7)})`;
      lines.push(
        gap >= 0
          ? `Asking ${gap}% below what ${what} imply (${fr(out.dvfReference)} €/m²)`
          : `Asking ${Math.abs(gap)}% above what ${what} imply (${fr(out.dvfReference)} €/m²)`,
      );
    } else lines.push("Too few DVF sales nearby to value it");
    if (l.price_drops > 0) lines.push(`${l.price_drops} price drop${l.price_drops > 1 ? "s" : ""} (${l.price_change_pct}% since listed)`);
    lines.push(l.expired ? `Off the market after ${l.days_on_market} days` : `On the market for ${l.days_on_market} days`);
    if (out.investment.net_yield !== null && l.rent) {
      lines.push(`${out.investment.net_yield.toFixed(1)}% net yield at the legal rent ceiling (${l.rent.max_m2} €/m²)`);
    }
    if (l.dpe) lines.push(`DPE ${l.dpe.energy_class} (advert)${"FG".includes(l.dpe.energy_class) ? " — rental restrictions apply" : ""}`);
    if (l.transport && l.transport.nearest_m <= 300) lines.push(`${l.transport.nearest_name} at ${l.transport.nearest_m} m`);
    l.explanations = lines;
  }
}

/**
 * Fetch (incrementally), merge, value and export the listings. Returns the
 * provenance line for the Sources table.
 */
export async function runListings(
  config: PipelineConfig,
  previous: ListingsFile | null,
  ctx: ListingsContext,
  writer: (path: string, file: ListingsFile) => Promise<void>,
): Promise<SourceStatus> {
  const status: SourceStatus = {
    id: "stream-estate",
    label: "Stream.estate — annonces en cours (photos, prix)",
    url: "https://stream.estate/",
    status: "unavailable",
    records: 0,
  };
  if (!hasListingsKey()) {
    log.info("Listings: STREAM_ESTATE_API_KEY not set — no listings (nothing is simulated)");
    return { ...status, label: `${status.label} — clé API non configurée` };
  }

  const since = previous?.cursor ?? null;
  const fresh = await fetchParisListings(config, since, config.maxListings);
  const cursor = (fresh ?? []).reduce<string | null>((m, p) => (p.updatedAt && (!m || p.updatedAt > m) ? p.updatedAt : m), since);
  const byId = new Map((previous?.listings ?? []).map((l) => [l.id, l]));
  let mapped = 0;
  for (const p of fresh ?? []) {
    const l = toListing(p, config.now);
    if (!l) continue;
    mapped++;
    const prev = byId.get(l.id);
    byId.set(l.id, {
      ...(prev ?? {}),
      ...l,
      address: { ...l.address, quartier: prev?.address.quartier ?? null },
    } as Listing);
  }
  // Refresh "days on market" for active listings not re-fetched this run.
  const cutoff = config.now.getTime() - KEEP_EXPIRED_DAYS * DAY_MS;
  const listings = [...byId.values()].filter((l) => !l.expired || !l.expired_at || Date.parse(l.expired_at) >= cutoff);
  for (const l of listings) {
    if (!l.expired) l.days_on_market = Math.max(0, Math.floor((config.now.getTime() - Date.parse(l.listed_at)) / DAY_MS));
  }
  valueListings(listings, ctx);
  listings.sort((a, b) => b.score.opportunity_score - a.score.opportunity_score || a.id.localeCompare(b.id));

  const result: SourceStatus = {
    ...status,
    status: fresh ? "ok" : listings.length ? "stale" : "unavailable",
    records: listings.length,
    period: `${fresh ? mapped : 0} fetched this run`,
  };
  await writer(join(DATA_DIR, LISTINGS_FILE), {
    generated_at: fresh ? config.now.toISOString() : previous?.generated_at ?? config.now.toISOString(),
    cursor,
    source: result,
    count: listings.length,
    listings,
  });
  log.ok(`Listings: ${listings.length} on file (${mapped} fetched/updated this run, cap ${config.maxListings})`);
  return result;
}
