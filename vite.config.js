import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// Vite+ Best Practice: eine einzige Config fuer Build, Test, Lint, Format
// und Task-Runner. Vite+ wertet test/lint/fmt-Bloecke aus dieser Datei aus
// (kein separates vitest.config / oxlint.config noetig).

// base: muss bei GitHub Pages der Repo-Name sein
// (= '/moto-atlas/' produktiv, '/' lokal). Override via VITE_BASE.
const base = process.env.VITE_BASE ?? "/";

export default defineConfig({
  base,
  plugins: [svelte()],
  publicDir: "public",
  // Svelte 5 hat conditional exports — Browser-Bedingung erzwingen, sonst
  // wird der Server-Build (ohne `mount`) im Dev-Server gepicked.
  resolve: { conditions: ["browser"] },
  optimizeDeps: { exclude: ["svelte"] },
  server: {
    port: 5173,
    // catalog.json + routes/ + drafts/ liegen ausserhalb von public/ —
    // Vite Dev-Server muss sie ueber Symlinks serven duerfen.
    fs: { allow: [".."] },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    cssMinify: false, // lightningcss-darwin-arm64.node + esbuild fehlen in vp brew bottle
  },
  css: {
    transformer: "postcss", // statt lightningcss (siehe oben)
  },

  // -- Vitest -------------------------------------------------------------
  test: {
    environment: "node",
    globals: true,
    include: ["tests-js/**/*.test.{js,svelte}"],
  },

  // -- Vite+ Task-Runner (`vp run <task>`) --------------------------------
  // Wraps lange-laufende Tasks mit transparentem Caching.
  run: {
    tasks: {
      catalog: {
        // Catalog.json aus den GPX/JSON-Sidecars bauen. Cache invalidiert
        // automatisch wenn routes/ oder drafts/ sich aendert.
        command: ".venv/bin/python scripts/build_catalog.py",
        inputs: ["routes/**", "drafts/**", "scripts/build_catalog.py"],
        outputs: ["catalog.json"],
      },
      pytest: {
        command: ".venv/bin/pytest tests/ -q",
        inputs: ["tests/**", "scripts/**"],
      },
    },
  },
});
