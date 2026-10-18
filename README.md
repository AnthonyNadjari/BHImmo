# BHImmobilier — Paris Real Estate Radar

### ▶ Live demo: https://bh-immo.vercel.app/  ·  https://anthonynadjari.github.io/BHImmo/

> An opportunity scanner for Paris *intra-muros* real estate built **only on
> real open data**. Every record is an actual apartment sale from **DVF**
> (DGFiP / Etalab), enriched with official French open data (ADEME energy
> certificates, Géorisques flood zoning, rent control, INSEE, IDFM, Ville de
> Paris, OpenStreetMap, IGN imagery). Scores are explainable functions of
> those facts. When a source has no answer the field is empty and the UI says
> so — **nothing is simulated, imputed or stock-photographed**.

| | |
|---|---|
| **Frontend** | React + Vite (TypeScript), static — Vercel / GitHub Pages |
| **Pipeline** | Node 20+/TypeScript via `tsx`, runs daily in GitHub Actions |
| **Universe** | the 50 most recent single-apartment sales per arrondissement (1 000 sales) |
| **Market context** | every clean Paris apartment sale of the last 5 DVF vintages (~137 000) |
| **Storage** | versioned JSON in `/data`; per-property files split at build time |
| **Auth / DB / paid APIs** | none (all sources are free and key-less) |

---

## What is real, and where it comes from

| Field | Source | Scope |
|---|---|---|
| Address, price, surface, Carrez, rooms, sale date, parcel | **DVF** geo-files (`files.data.gouv.fr/geo-dvf`) — latest vintages auto-discovered | the sale |
| Resale history | DVF — earlier sales of the same lot (same parcel + lot number, same surface) | the lot |
| Comparables, local €/m² (100 m / 500 m, ±12 months) | DVF | ≤ 500 m |
| Arrondissement median €/m², YoY trend, volume, volatility | DVF (all sales, latest vs previous vintage) | arrondissement |
| BAN label + interoperability key | IGN Géoplateforme geocoder (BAN) | the address |
| DPE energy/GHG class, certificate date, energy bill, construction year | **ADEME** `dpe03existant`, matched by BAN key + surface (“unit”), else median of the building’s certificates (“building”, labelled) | apartment / building |
| Flood exposure | **Géorisques** TRI zoning (`tri_zonage`) | the address |
| Clay shrink–swell | Géorisques RGA — no data for Paris addresses, shown as *no data* | the address |
| Legal rent ceiling (yield basis) | Ville de Paris *encadrement des loyers* (latest year), point-in-polygon on the quartiers; era from the DPE | quartier |
| Transit score, nearest station | **IDFM** station locations | ≤ 600 m |
| Schools, Vélib’, parks, street trees | Annuaire de l’éducation · opendata.paris.fr | 150–500 m |
| Food / health / culture amenities | **OpenStreetMap** (Overpass) | ≤ 500 m |
| Population, density, median standard of living, poverty rate | **INSEE** Melodi API (populations, FiLoSoFi) · Ville de Paris areas | arrondissement |
| Road-noise exposure | Ville de Paris (share of residents above the Lden threshold) | arrondissement |
| Imagery | **IGN** BD ORTHO® aerial photos + Plan IGN centred on the address (Mapillary / Street View optional) | the address |

The Market page lists every source with its status for the last run
(`loaded`, `last run's values`, `unavailable`).

**No-fake rules enforced by the pipeline**

- DVF is mandatory: if it can't be downloaded the run fails and CI commits
  nothing, so the last real dataset stays online. There is no synthetic
  universe, no seeder and no "mock" mode anymore.
- Per-address lookups (BAN, ADEME, Géorisques) are stored with their date and
  retried on the next run if an API was down — never guessed.
- If a Paris-wide reference set fails to load, properties keep the value
  computed from it on a previous run (status `last run's values`).
- Mixed sales (apartment + shop/office/other dwelling) and atypical prices
  (< 0.6× or > 2.2× the arrondissement-year median, e.g. viager) are excluded
  so €/m² is meaningful.
- DVF records completed sales, not listings: there is no "days on market" or
  "price drop" signal. A sale is shown as *Sold <date>*.

---

## Architecture

```
GitHub Actions (daily) ─ pipeline/run.ts
  1. Ingestion    scraper/      DVF vintages → clean single-apartment sales → universe
  2. Lookups      enrichment/   BAN · ADEME DPE · Géorisques (once per address)
  3. References   enrichment/   IDFM · schools · Vélib' · parks · trees · OSM · rent control · INSEE · noise
  4. Enrichment   enrichment/   comparables · transport · neighbourhood · rent · POIs · IGN imagery
  5. History      scraper/      earlier DVF sales of the same lot
  6. Scoring      scoring/      deal score + explainable signals
  7. Export       storage/      data/properties.json · index.json · market.json
                       │ commit → deploy
                       ▼
frontend/ (React + Vite SPA): Dashboard · Sale detail · Map · Market (+ Sources) · Watchlist
```

---

## Data model

The canonical schema lives in [`shared/types.ts`](shared/types.ts). Each property:

```ts
Property {
  id                      // "dvf-<id_mutation>"
  address        { raw, normalized, lat, lng, district, ban_id }
  characteristics { surface_m2, carrez_m2, rooms }
  sale           { date, price, price_per_m2, mutation_id, parcel }
  price_history[] { date, price, source }          // every DVF sale of the lot
  dvf            { avg_price_m2_100m, avg_price_m2_500m, count_100m, count_500m, window_*, comparable_sales[] }
  risks          { flood, clay, noise }            // RiskFact | null (value 0–1, label, scope, source)
  transport      { score, nearest_name, nearest_m, stations_600m } | null
  neighborhood   { walk_score, schools_500m, velib_400m, trees_150m, parks_500m, amenities, income, poverty_rate }
  rent           { ref_m2, max_m2, min_m2, monthly_est, quartier, year, epoque, epoque_source } | null
  dpe            { energy_class, ghg_class, scope: "unit"|"building", certificates, date, … } | null
  investment     { gross_yield, net_yield, ppm2_percentile, dvf_gap_pct, dpe_risk_score, value_add_flag }
  score          { opportunity_score, value_score, yield_score, liquidity_score, gentrification_score }
  signals        { resale, explanations[] }
  images[] / thumb / image_credit                 // IGN aerial + map of the address
  lookups        { ban?, dpe?, flood?, clay? }     // when each remote lookup completed
}
```

## Scoring (explainable)

```
deal_score = weighted mean of the AVAILABLE components
             0.35·value + 0.35·yield + 0.18·liquidity + 0.12·gentrification
deal_score *= 0.5 + 0.5·dpe_health/100          // when a DPE is known
```

- **value** — discount vs. the local DVF reference (60 % within 100 m + 40 %
  within 500 m) and €/m² percentile among *all* the arrondissement's sales of
  the year.
- **yield** — legal rent ceiling × surface vs. sale price; explicit assumptions:
  7.5 % acquisition fees, charges at 1.2 % of price per year.
- **liquidity** — IDFM transit, walkability, size, arrondissement price level,
  local DVF sale volume.
- **gentrification** — arrondissement DVF YoY trend vs. Paris + INSEE income
  rank vs. price rank.

A component without data is dropped and the weights renormalise. Badges:
🔥 **opportunity** = score ≥ 68 · ❌ **overvalued** = sold ≥ 10 % *above* the
local DVF average · ⚠️ **watch** otherwise. Every property carries
`signals.explanations[]`, e.g. *"27% below the local DVF average (11 675 €/m²,
492 sales ≤ 500 m)"*, *"DPE D (this apartment)"*, *"Resold: bought 355 000 € in
2023-05 (+1.7% over 2.6 y)"*. See [`scoring/score.ts`](scoring/score.ts).

---

## File structure

```
scraper/      DVF download (gz vintages) → clean sales → universe, comparables, lot history, market stats
enrichment/   geocode (BAN) · dpe (ADEME) · georisques · reference (Paris-wide sets) · insee
              dvf · transport · neighborhood · rent · pois · facade (Mapillary)
scoring/      deal score, gentrification, explanations
storage/      repository · market model · dataset export
pipeline/     run.ts (CLI) · pipeline.ts (orchestrator)
shared/       types · config (endpoints, fetch helpers) · geo (grid index, PIP) · paris · images (IGN)
frontend/     React (Vite) — pages, components, services
data/         properties.json · index.json · market.json   (committed)
```

---

## Run it locally

Requires Node 20+ and network access to the sources above.

```bash
npm install
npm run pipeline          # ~4 min on a first run (1 000 address lookups), ~30 s afterwards

cd frontend
npm install
npm run dev               # http://localhost:5173  (copies ../data automatically)
```

Environment knobs: `PRER_DVF_PER_ARR` (sales per arrondissement, default 50),
`PRER_DVF_YEARS` (DVF vintages loaded, default 5), `PRER_CONCURRENCY`
(parallel lookups, default 6), `MLY_TOKEN` (optional Mapillary street photos).
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

[`.github/workflows/pipeline.yml`](.github/workflows/pipeline.yml) runs daily
(and on demand), regenerates the dataset from the live sources, and commits
`/data` when it changed. GitHub runs `cron` from the **default branch**, so the
canonical branch must be the repo default.

---

## Design notes

- **Real or empty.** Every field is sourced or `null`; the UI renders `—` /
  *no data* with the reason (e.g. "No ADEME DPE registered at this address").
- **Incremental.** Remote lookups run once per address; Paris-wide reference
  sets are loaded once per run and queried through an in-memory grid index, so
  a daily run takes ~30 s once the universe is enriched.
- **Resilience without fakes.** Fetches have timeouts, retries and mirrors
  (Overpass); a failed source keeps its last real values instead of a guess.
- **Performance.** Charts are hand-rolled SVG; maps use Leaflet with Plan IGN
  tiles (key-less).
- **Bonus features.** CSV export, side-by-side comparison, price-by-area map
  layer, and a localStorage watchlist tracking score changes.
