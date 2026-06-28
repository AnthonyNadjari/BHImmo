import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * `base` must match the GitHub Pages sub-path. For the repo published at
 * https://anthonynadjari.github.io/BHImmo/ that is `/BHImmo/`. Override with
 * the PRER_BASE env var (the deploy workflow sets it automatically).
 */
export default defineConfig({
  base: process.env.PRER_BASE ?? "/BHImmo/",
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
