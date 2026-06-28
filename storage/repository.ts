/**
 * Persistence for the canonical property dataset.
 *
 * The single source of truth is `data/properties.json`, committed to git on
 * every pipeline run. There is no database — the JSON file *is* the database
 * (versioned, diff-able, trivially served by GitHub Pages).
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR, FILES } from "../shared/config.ts";
import { log } from "../shared/logger.ts";
import type { PropertiesFile, Property } from "../shared/types.ts";

const propertiesPath = join(DATA_DIR, FILES.properties);

export async function loadProperties(): Promise<Property[]> {
  try {
    const raw = await readFile(propertiesPath, "utf8");
    const parsed = JSON.parse(raw) as PropertiesFile;
    return Array.isArray(parsed.properties) ? parsed.properties : [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      log.info("No existing dataset found — starting fresh");
      return [];
    }
    throw err;
  }
}

export async function saveProperties(
  properties: Property[],
  generatedAt: string,
): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const payload: PropertiesFile = {
    generated_at: generatedAt,
    count: properties.length,
    properties,
  };
  await writeJson(propertiesPath, payload);
  log.ok(`Saved ${properties.length} properties → ${propertiesPath}`);
}

/** Write JSON with stable 2-space formatting + trailing newline (clean diffs). */
export async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
