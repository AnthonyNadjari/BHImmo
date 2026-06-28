/**
 * Prepares the static datasets the frontend fetches at runtime, from the
 * pipeline's canonical JSON in `/data`:
 *
 *   public/data/index.json        compact dashboard rows
 *   public/data/market.json       per-arrondissement model
 *   public/data/property/<id>.json one file per property (detail page)
 *
 * Splitting `properties.json` (which can be several MB at scale) into one file
 * per property means the detail page fetches only the record it needs instead
 * of the whole dataset. Output lives under the gitignored public/data, so it's
 * a pure build artifact. Run automatically via the `predev` / `prebuild` hooks.
 */
import { mkdir, copyFile, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const srcDir = join(process.cwd(), "..", "data");
const destDir = join(process.cwd(), "public", "data");
const propDir = join(destDir, "property");

await mkdir(destDir, { recursive: true });

// Compact, always-loaded artifacts.
let copied = 0;
for (const file of ["index.json", "market.json"]) {
  const src = join(srcDir, file);
  if (existsSync(src)) {
    await copyFile(src, join(destDir, file));
    copied++;
  } else {
    console.warn(`[copy-data] missing ${src} — run the pipeline/seed first`);
  }
}

// Split the full dataset into one file per property for the detail page.
const propsPath = join(srcDir, "properties.json");
let split = 0;
if (existsSync(propsPath)) {
  await rm(propDir, { recursive: true, force: true });
  await mkdir(propDir, { recursive: true });
  const { properties } = JSON.parse(await readFile(propsPath, "utf8"));
  await Promise.all(
    (properties ?? []).map((p) =>
      writeFile(join(propDir, `${p.id}.json`), JSON.stringify(p)),
    ),
  );
  split = (properties ?? []).length;
} else {
  console.warn(`[copy-data] missing ${propsPath} — detail pages will 404`);
}

console.log(`[copy-data] ${copied}/2 datasets + ${split} per-property files → ${destDir}`);
