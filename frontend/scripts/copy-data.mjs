/**
 * Prepares the static datasets the frontend fetches at runtime, from the
 * pipeline's canonical JSON in `/data`:
 *
 *   public/data/index.json          compact dashboard rows
 *   public/data/market.json         market model, price indices, provenance
 *   public/data/quartiers.geojson   quartier polygons for the price map
 *   public/data/property/<id>.json  one file per property (detail page)
 *
 * The full records live in per-arrondissement shards (`data/properties/*.json`);
 * splitting them into one file per property means the detail page fetches only
 * the record it needs. Output lives under the gitignored public/data, so it's a
 * pure build artifact. Run automatically via the `predev` / `prebuild` hooks.
 */
import { mkdir, copyFile, writeFile, rm, readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const srcDir = join(process.cwd(), "..", "data");
const destDir = join(process.cwd(), "public", "data");
const propDir = join(destDir, "property");

await mkdir(destDir, { recursive: true });

// Compact, always-loaded artifacts. listings.json only exists once a
// Stream.estate API key is configured (the UI then shows the listings page).
const artifacts = ["index.json", "market.json", "quartiers.geojson"];
let copied = 0;
for (const file of [...artifacts, "listings.json"]) {
  const src = join(srcDir, file);
  if (existsSync(src)) {
    await copyFile(src, join(destDir, file));
    copied++;
  } else if (file === "listings.json") {
    await rm(join(destDir, file), { force: true });
    console.log("[copy-data] no listings.json (Stream.estate key not configured) — listings page shows how to enable it");
  } else {
    console.warn(`[copy-data] missing ${src} — run the pipeline first`);
  }
}

// Split the per-arrondissement shards into one file per property.
const shardDir = join(srcDir, "properties");
const shards = existsSync(shardDir) ? (await readdir(shardDir)).filter((f) => f.endsWith(".json")) : [];
await rm(propDir, { recursive: true, force: true });
await mkdir(propDir, { recursive: true });
let split = 0;
for (const f of shards) {
  const { properties } = JSON.parse(await readFile(join(shardDir, f), "utf8"));
  await Promise.all((properties ?? []).map((p) => writeFile(join(propDir, `${p.id}.json`), JSON.stringify(p))));
  split += (properties ?? []).length;
}
if (split === 0) console.warn(`[copy-data] no property shards in ${shardDir} — detail pages will 404`);

console.log(`[copy-data] ${copied}/${artifacts.length} datasets + ${split} per-property files → ${destDir}`);
