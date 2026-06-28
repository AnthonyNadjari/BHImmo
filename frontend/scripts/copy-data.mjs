/**
 * Copies the pipeline's JSON datasets into `public/data` so the frontend can
 * fetch them in both `vite dev` and the production build. Run automatically
 * via the `predev` / `prebuild` npm hooks.
 */
import { mkdir, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const FILES = ["index.json", "properties.json", "market.json"];
const srcDir = join(process.cwd(), "..", "data");
const destDir = join(process.cwd(), "public", "data");

await mkdir(destDir, { recursive: true });

let copied = 0;
for (const file of FILES) {
  const src = join(srcDir, file);
  if (existsSync(src)) {
    await copyFile(src, join(destDir, file));
    copied++;
  } else {
    console.warn(`[copy-data] missing ${src} — run the pipeline/seed first`);
  }
}
console.log(`[copy-data] copied ${copied}/${FILES.length} dataset(s) → ${destDir}`);
