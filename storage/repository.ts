/**
 * Persistence for the canonical property dataset.
 *
 * The source of truth is `data/properties/<district>.json`, one shard per
 * arrondissement, committed on every pipeline run. Each shard is a JSON array
 * with ONE PROPERTY PER LINE: compact on disk, yet git diffs stay per-property.
 * There is no database — the JSON files *are* the database.
 */

import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR, FILES } from "../shared/config.ts";
import { log } from "../shared/logger.ts";
import type { PropertiesFile, Property } from "../shared/types.ts";

const shardDir = join(DATA_DIR, FILES.propertiesDir);

export async function loadProperties(): Promise<Property[]> {
  const out: Property[] = [];
  try {
    for (const f of (await readdir(shardDir)).filter((f) => f.endsWith(".json")).sort()) {
      const parsed = JSON.parse(await readFile(join(shardDir, f), "utf8")) as PropertiesFile;
      out.push(...(parsed.properties ?? []));
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  if (out.length) return out;

  // One-time migration from the pre-sharding single file.
  try {
    const legacy = JSON.parse(await readFile(join(DATA_DIR, FILES.legacyProperties), "utf8")) as PropertiesFile;
    return Array.isArray(legacy.properties) ? legacy.properties : [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      log.info("No existing dataset found — starting fresh");
      return [];
    }
    throw err;
  }
}

/** Write one shard per arrondissement and drop shards/legacy files no longer used. */
export async function saveProperties(properties: Property[], generatedAt: string): Promise<void> {
  await mkdir(shardDir, { recursive: true });
  const byDistrict = new Map<string, Property[]>();
  for (const p of properties) {
    (byDistrict.get(p.address.district) ?? byDistrict.set(p.address.district, []).get(p.address.district)!).push(p);
  }
  for (const f of await readdir(shardDir)) {
    if (!byDistrict.has(f.replace(/\.json$/, ""))) await rm(join(shardDir, f));
  }
  for (const [district, list] of byDistrict) {
    await writeJsonLines(join(shardDir, `${district}.json`), { generated_at: generatedAt, count: list.length }, "properties", list);
  }
  await rm(join(DATA_DIR, FILES.legacyProperties), { force: true });
  log.ok(`Saved ${properties.length} properties → ${shardDir}/ (${byDistrict.size} shards)`);
}

/** Write JSON with stable 2-space formatting + trailing newline (clean diffs). */
export async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

/** `{ ...head, [key]: [rows…] }` with one compact row per line. */
export async function writeJsonLines(path: string, head: Record<string, unknown>, key: string, rows: unknown[]): Promise<void> {
  const top = JSON.stringify(head).slice(0, -1);
  const body = rows.map((r) => JSON.stringify(r)).join(",\n");
  await writeFile(path, `${top}${top.length > 1 ? "," : ""}"${key}":[\n${body}\n]}\n`, "utf8");
}
