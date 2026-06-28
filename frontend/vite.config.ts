import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Default base is "/" (Vercel / root-domain hosting). For GitHub Pages project
 * sites the path is a sub-folder (e.g. /BHImmo/); the Pages deploy workflow
 * sets PRER_BASE=/<repo>/ to override.
 */
export default defineConfig({
  base: process.env.PRER_BASE ?? "/",
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
