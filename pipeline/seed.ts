/**
 * Dataset seeder.
 *
 * Replays the pipeline across a series of historical dates so the committed
 * sample dataset has a realistic, multi-point price history (drops, days on
 * market, sold/removed transitions) instead of a single snapshot. Runs fully
 * offline in `mock` mode and is deterministic: re-seeding reproduces the same
 * data.
 *
 *   npm run seed
 */

import { rm } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig, DATA_DIR, FILES } from "../shared/config.ts";
import { log } from "../shared/logger.ts";
import { runPipeline } from "./pipeline.ts";

const DAY_MS = 86_400_000;

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

async function clearDataset(): Promise<void> {
  for (const file of Object.values(FILES)) {
    await rm(join(DATA_DIR, file), { force: true });
  }
}

async function main(): Promise<void> {
  const base = loadConfig();
  const start = parseDate(process.env.PRER_SEED_START ?? "2025-09-15");
  const end = base.now; // logical "today"
  const stepDays = Number(process.env.PRER_SEED_STEP_DAYS ?? 10);

  log.info(
    `Seeding from ${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)} every ${stepDays} days`,
  );
  await clearDataset();

  let runs = 0;
  let lastT = -1;
  for (let t = start.getTime(); t <= end.getTime(); t += stepDays * DAY_MS) {
    await runPipeline({ ...base, mode: "mock", now: new Date(t) });
    lastT = t;
    runs++;
  }

  // Ensure the final snapshot lands exactly on "today" (only if the loop
  // didn't already end there — avoids a redundant duplicate pass).
  if (lastT !== end.getTime()) {
    await runPipeline({ ...base, mode: "mock", now: end });
    runs++;
  }

  log.ok(`Seed complete after ${runs} simulated runs`);
}

main().catch((err) => {
  log.error("Seeding failed", err);
  process.exitCode = 1;
});
