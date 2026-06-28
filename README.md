# Paris Real Estate Radar — P.R.E.R

### ▶ Live demo: https://raw.githack.com/AnthonyNadjari/BHImmo/live/index.html

> An opportunity scanner for Paris *intra-muros* real estate. It ingests
> listings, enriches them with French open data (transactions, risks,
> transport, energy), computes an **explainable** opportunity score (0–100),
> and serves everything as a fast, static React app. No backend, no login, no
> paid APIs — the data pipeline runs entirely in GitHub Actions and the
> dataset is versioned JSON in the repo.

| | |
|---|---|
| **Frontend** | React + Vite (TypeScript), static — deployable to Vercel or GitHub Pages |
| **Pipeline** | Node 20+/TypeScript via `tsx`, runs in GitHub Actions every 6h |
| **Storage** | Versioned JSON in `/data` (`properties.json`, `index.json`, `market.json`) |
| **Data sources** | BAN · DVF (Etalab) · Géorisques · ADEME/DPE · INSEE · OpenStreetMap |
| **Auth / DB / paid APIs** | none |

> ⚠️ **Listings are synthetic** (no free, ToS-compatible listings API exists),
> generated deterministically on **real Paris streets** so the enrichment
> against real government APIs is exercised end-to-end. The scoring,
> enrichment, and UI are production code; swap the scraper for a real
> connector and the rest works unchanged.

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
| **BAN** (Base Adresse Nationale) | geocoding / address normalization | `api-adresse.data.gouv.fr` |
| **DVF** (Etalab) | nearby real transactions → €/m² 100 m & 500 m | `api.cquest.org/dvf` |
| **Géorisques** | clay shrink-swell (RGA); flood via Seine-proximity proxy | `georisques.gouv.fr/api/v1` |
| **ADEME / DPE** | energy + GHG class of nearby certificate | `data.ademe.fr` (`dpe03existant`) |
| **INSEE** | static population density per arrondissement | embedded reference |
| **OpenStreetMap** | métro count (Overpass, live mode) + map embed | `overpass-api.de`, `openstreetmap.org` |

`PRER_MODE` controls API usage: `mock` (offline, deterministic), `hybrid`
(real APIs + fallback, **default**), `live` (real APIs, also queries Overpass).

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

- **Determinism.** No `Math.random()` / wall-clock in data: every synthetic
  value is seeded from a stable id (`shared/prng.ts`) and `generated_at` is
  day-granular, so a no-change run produces byte-identical JSON (no empty CI
  commits).
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
