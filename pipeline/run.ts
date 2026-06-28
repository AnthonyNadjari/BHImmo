/**
 * CLI entry point invoked by GitHub Actions and `npm run pipeline`.
 *
 * Reads configuration from the environment (PRER_MODE, PRER_NOW, …) and runs
 * one full pass of the pipeline against the committed dataset in `/data`.
 */

import { loadConfig } from "../shared/config.ts";
import { log } from "../shared/logger.ts";
import { runPipeline } from "./pipeline.ts";

runPipeline(loadConfig()).catch((err) => {
  log.error("Pipeline failed", err);
  process.exitCode = 1;
});
