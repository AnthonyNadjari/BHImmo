# BHImmobilier — Paris Real Estate Radar

### ▶ Live demo: https://bh-immo.vercel.app/  ·  https://anthonynadjari.github.io/BHImmo/

> An opportunity scanner for Paris *intra-muros* real estate. It ingests **real
> apartment transactions** (DVF / Etalab open data), enriches them with French
> open data (comparables, rents, transport, energy, neighbourhood), computes an
> **explainable** opportunity score (0–100), and serves everything as a fast,
> static React app. No backend, no login, no paid APIs — the data pipeline runs
> entirely in GitHub Actions and the dataset is versioned JSON in the repo.

| | |
|---|---|
| **Frontend** | React + Vite (TypeScript), static — deployable to Vercel or GitHub Pages |
| **Pipeline** | Node 20+/TypeScript via `tsx`, runs in GitHub Actions every 6h |
| **Data** | ~1000 **real** Paris apartment sales (the most recent per arrondissement) |
| **Storage** | Versioned JSON in `/data`; per-property files split at build time |
| **Data sources** | DVF (Etalab) · BAN · ADEME/DPE · INSEE · IDFM · OpenStreetMap · opendata.paris |
| **Auth / DB / paid APIs** | none |

> ✅ **Listings are real transactions.** The property universe is built from the
> official **DVF** (*Demandes de Valeurs Foncières*) geocoded flat files
> published by Etalab — real address, price, surface, rooms, coordinates and
> mutation date. Comparables are derived from the same dataset; secondary
> enrichment runs deterministically for scale and reliability. No listing-portal
> scraping (forbidden by their ToS and blocked in CI).

---

## Architecture

```
                          ┌──────────────────────── GitHub Actions ────────────────────────┐
                          │                                                                 │
   real Paris streets     │   pipeline/run.ts  (every 6h, cron)                             │
        │                 │                                                                 │
        ▼                 │   ┌─────────┐   ┌────────────┐   ┌─────────┐   ┌─────────────┐  │
  ┌────────────┐          │   │ scraper │──▶│ enrichment │──▶│ scoring │──▶│   storage   │  │
  │  synthetic │          │   ├─────────┤   ├────────────┤   ├─────────┤   ├─────────────┤  │
  │  universe  │──fetch──▶│   │ fetch   │   │ BAN geocode│   │ signals │   │ properties  │  │
  │(deterministic)        │   │ normalize│  │ DVF        │   │ dvf gap │   │   .json      │ │
  └────────────┘          │   │ dedupe  │   │ Géorisques │   │ drops   │   │ index.json  │  │
                          │   │ match   │   │ transport  │   │ time    │   │ market.json │  │
                          │   └─────────┘   │ ADEME/DPE  │   │ liquid. │   └──────┬──────┘  │
                          │                 │ INSEE      │   └─────────┘          │         │
                          │                 └────────────┘                        │         │
                          │   commit /data ◀─────────────────────────────────────┘         │
                          └────────────────────────────────┬────────────────────────────────┘
                                                            │ triggers deploy
                                                            ▼
                                        ┌───────────────────────────────────┐
                                        │   frontend/  (React + Vite, SPA)   │
                                        │  Dashboard · Detail · Watchlist    │
                                        │  Map (heatmap) · Market            │
                                        │  fetch /data/*.json  → render      │
                                        └───────────────────────────────────┘
                                              Vercel  /  GitHub Pages
```

The seven pipeline steps (in `pipeline/pipeline.ts`):

1. **Ingestion** — fetch listings, normalize, deduplicate (`scraper/`).
2. **Geocoding** — addresses → coordinates via **BAN** (`enrichment/geocode.ts`).
3. **Enrichment** — **DVF** comps, **Géorisques** flood/clay, transport score, **ADEME** DPE, **INSEE** density.
4. **Matching** — reconcile listings against existing properties; detect price changes (`scraper/match.ts`).
5. **Historical update** — append price history, compute days-on-market, mark sold/removed.
6. **Scoring** — weighted opportunity score + explainable signals (`scoring/`).
7. **Export** — write `properties.json`, `index.json`, `market.json` (`storage/`).

---

## Data model

The canonical schema lives in [`shared/types.ts`](shared/types.ts). Each property:

```ts
Property {
  id
  address      { raw, normalized, lat, lng, district }
  characteristics { surface_m2, rooms, floor }
  pricing      { current_price, price_per_m2, initial_price }
  timeline     { first_seen, last_seen, days_on_market }
  price_history[] { date, price, source }
  status       "active" | "sold" | "removed"
  dvf          { avg_price_m2_100m, avg_price_m2_500m, comparable_sales[] }
  risks        { flood, clay, noise }              // 0–1
  transport_score                                   // 0–100
  images[] / thumb                                  // deterministic gallery
  dpe?         { energy_class, ghg_class }          // A–G
  score        { opportunity_score, price_score, market_gap_score, liquidity_score }
  signals      { price_drops, total_drop_percent, long_time_on_market, explanations[] }
}
```

## Scoring (exact, explainable)

```
opportunity_score =
    dvf_gap_score          * 0.40   // how far below local DVF €/m²
  + price_drop_score       * 0.25   // drop depth + frequency (motivated seller)
  + time_on_market_score   * 0.15   // negotiation leverage
  + transport_score        * 0.10   // métro/RER proximity & density
  + market_liquidity_score * 0.10   // resale ease (transport + surface + demand)
```

Every component is normalized to 0–100 and the weights sum to 1, so the result
is already 0–100. There are **no black boxes**: each property carries a
`signals.explanations[]` list such as *"23.6% below DVF average"*, *"3 price
drops detected (−13.3%)"*, *"150+ days on market"*. See
[`scoring/score.ts`](scoring/score.ts).

Dashboard badges: 🔥 **opportunity** (≥68) · ⚠️ **watch** · ❌ **overvalued** (≤45).

---

## Government / open APIs

All free and key-less. Each client degrades gracefully to a **deterministic
synthetic fallback** so the pipeline never fails when an API is down.

| Source | Use | Endpoint |
|---|---|---|
| **DVF** (Etalab) | **real transactions** → property universe + €/m² comps | `files.data.gouv.fr/geo-dvf` |
| **BAN** (Base Adresse Nationale) | geocoding / address normalization | `api-adresse.data.gouv.fr` |
| **ADEME / DPE** | energy + GHG class of nearby certificate | `data.ademe.fr` (`dpe03existant`) |
| **INSEE** | income / density / reference rent per arrondissement | embedded reference |
| **IDFM** | métro/RER/tram station proximity | `data.iledefrance-mobilites.fr` |
| **opendata.paris** | encadrement des loyers · Vélib' · trees | `opendata.paris.fr` |
| **OpenStreetMap** | nearby amenities (Overpass) | `overpass-api.de` |

`PRER_MODE` controls **secondary** enrichment: `mock` (offline, deterministic
— used for scale), `hybrid`/`live` (real per-property API calls). The real DVF
universe loads in every mode (disable with `PRER_DVF=off`); `PRER_DVF_PER_ARR`
sets how many recent transactions to surface per arrondissement.

---

## File structure

```
scraper/      fetch → normalize → dedupe → match (synthetic universe)
enrichment/   geocode · dvf · georisques · transport · dpe · insee
scoring/      signals + weighted opportunity score
storage/      repository · market model · dataset export
pipeline/     run.ts (CLI) · pipeline.ts (orchestrator) · seed.ts
shared/       types · config · prng · geo · paris reference · images · logger
frontend/     React (Vite)
  src/pages         Dashboard · PropertyDetail · Watchlist · MapPage · Market
  src/components     Sparkline · PriceChart · Gallery · Img · ScoreBar · …
  src/services       data · format · watchlist · csv · stats
data/         properties.json · index.json · market.json   (committed)
.github/workflows/  pipeline.yml (6h refresh) · deploy.yml (Pages)
```

---

## Run it locally

Requires Node 20+.

```bash
# 1. Pipeline dependencies
npm install

# 2a. Generate a rich sample dataset (offline, deterministic — replays history)
npm run seed

# 2b. …or run a single pipeline pass (hybrid: real APIs + fallback)
npm run pipeline          # or: npm run pipeline:mock / :live

# 3. Frontend
cd frontend
npm install
npm run dev               # http://localhost:5173  (copies ../data automatically)
```

`npm run typecheck` (root and `frontend/`) type-checks everything.

---

## Deployment

The build is a plain static site (`frontend/dist`).

### Live now (zero config)

Every push to `main` (and every data refresh) publishes the built site to the
`live` branch via [`deploy.yml`](.github/workflows/deploy.yml), served by the
raw.githack CDN — no account, token, or repo setting required:

**https://raw.githack.com/AnthonyNadjari/BHImmo/live/index.html**

### Vercel (recommended)

The repo ships a [`vercel.json`](vercel.json) that builds the frontend from the
repo root:

```bash
npm i -g vercel
vercel            # link the project, then deploy a preview
vercel --prod     # production deploy → prints the live URL
```

Or import the GitHub repo in the Vercel dashboard — zero config, `vercel.json`
handles the build (`outputDirectory: frontend/dist`). The Vite `base` defaults
to `/` for root-domain hosting.

### GitHub Pages (clean `*.github.io` URL)

The Actions token can't enable Pages on its own, so this is a one-time setup:
set **Settings → Pages → Source: GitHub Actions**, then run the
[`pages.yml`](.github/workflows/pages.yml) workflow (Actions tab → *Deploy to
GitHub Pages* → *Run workflow*). It builds with the correct `/<repo>/` base and
publishes to `https://<owner>.github.io/<repo>/`.

### Scheduled data refresh

[`.github/workflows/pipeline.yml`](.github/workflows/pipeline.yml) runs every 6
hours (and on demand), regenerates the dataset, and commits `/data` only when
it actually changed. GitHub runs `cron` from the **default branch**, so the
canonical branch must be the repo default.

---

## Design notes

- **Determinism.** Secondary/derived values are seeded from a stable id
  (`shared/prng.ts`), so the same DVF transaction always enriches identically;
  `generated_at` stamps the real run time so the UI shows genuine freshness.
- **Resilience.** Every API call has an 8s timeout and a deterministic
  fallback; the pipeline always emits a valid dataset.
- **Performance.** Charts and sparklines are hand-rolled SVG (no chart lib);
  the production bundle is ~64 kB gzipped and loads in well under 2 s.
- **Bonus features.** CSV export, side-by-side comparison, opportunity heatmap,
  and a localStorage watchlist with price-drop / status-change alerts.

## Optional extensions

Swap `scraper/fetch-listings.ts` for a real portal connector returning
`RawListing[]` — geocoding, enrichment, scoring, and the UI are unchanged.
Géorisques flood and OSM transport can be promoted from proxy/static to full
live queries in `enrichment/`.
