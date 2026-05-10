# MotoAtlas — Agent-Anweisungen

Statisches Motorrad-GPX-Routenarchiv (DE/BE/NL/FR/IT). Vite + Svelte 5 (Runes) + MapLibre GL + Vite+ als unified Toolchain für Check/Lint/Format/Test.

## Befehle (verbindlich)

```bash
# Frontend
pnpm dev          # Vite Dev-Server mit HMR auf http://localhost:5173
pnpm build        # Produktions-Build nach dist/
pnpm preview      # Lokales Preview des Build

# Vite+ unified toolchain
pnpm check        # vp check — Format + Lint + Type-Check (Oxfmt + Oxlint + tsgo)
pnpm lint         # vp lint — nur Oxlint
pnpm fmt          # vp fmt --write — Oxfmt auto-fix
pnpm test         # vp test run — Vitest one-shot
pnpm test:e2e     # vp dlx playwright test (wenn aufgesetzt)
pnpm catalog      # vp run catalog — catalog.json bauen (mit Cache)
pnpm pytest       # vp run pytest — Python-Tests (mit Cache)
```

**Build-Hinweis:** `vp dev` / `vp build` werden aktuell nicht genutzt, weil das bundled Vite 8 von Vite+ inkompatibel mit `@sveltejs/vite-plugin-svelte@4` (Svelte-5-Support) ist und der INFORM-Artifactory-Proxy `@esbuild/darwin-arm64@>=0.24` (Vite 6+ Voraussetzung) mit 403 blockt. Sobald Vite+ stabil ist oder Artifactory neuere esbuild-Versionen freischaltet, kann auf `vp dev`/`vp build` zurückgewechselt werden. Bis dahin werden Dev/Build über lokales Vite 5 gefahren — alle anderen vp-Befehle funktionieren normal.

## Stack-Conventions

- **Svelte 5 mit Runes:** `$state`/`$derived`/`$effect`. Keine `$:`-Legacy-Syntax. Globale Stores als `$state(...)` in `.svelte.js`-Dateien.
- **1 MapLibre-Layer:** `routes` mit `feature-state`-getriebenen `line-width`/`line-blur`. Keine separaten Hover-/Selected-Layer.
- **OpenFreeMap Liberty** als Default-Tile-Provider. MapTiler nur via `VITE_MAPTILER_KEY` (optionaler Premium-Pfad).
- **Single Vite-Config** (`vite.config.js`): Vite + Vitest + Vite+ Tasks in einer Datei. Oxlint via `.oxlintrc.json`, Oxfmt-Ignore via `.oxfmtignore`.
- **Tests:** Vitest für JS (in `tests-js/`), pytest für Python-Scripts (in `tests/`).

## Routen-Quellen-Policy

Nur Tracks aus Quellen mit Redistribution-Erlaubnis. Eigene Tracks, Freundeskreis (mit Einverständnis), explizit CC-lizenzierte Sammlungen (CC BY/SA, Public Domain, Trans Euro Trail) → `gpx_redistribution: "allowed"`. ADAC/Wikiloc/Komoot/BikeMap → **verboten** (auch nicht als Hotlink — deren AGB schließen "use on other websites" aus). Jede Route hat einen `source_url`-Pflichtfeld; `gpx_redistribution` ist Pflicht.

## Sidecar-Pflichtfelder

```json
{
  "name": "Routenname",
  "country": "de|be|nl|fr|it",
  "source_url": "https://example.org/tour",
  "source_name": "Eigene Tour",
  "gpx_redistribution": "allowed"
}
```

## XSS / Sicherheit

- Sidecar-Daten ausschließlich via Svelte-Template-Interpolation. Kein `@html`-Direktive, kein `innerHTML`.
- Keine Hotlinks zu lizenzgeschützten GPX-Files (Lizenz-Audit vor jedem neuen `source_gpx_url`).

## Vor Commit-Pflicht

```bash
pnpm check         # Lint + Format + Type-Check muss grün sein
pnpm test          # 10 Vitest grün
pnpm pytest        # 18 Pytest grün
```

## Referenzen

- `CLAUDE.md` — ausführliche Architekturdoku
- `docs/research/2026-05-10-vite-svelte-stack.md` — Migrations-Recherche
- `docs/research/2026-05-10-maplibre-tile-performance.md` — Tile-Tuning
- `docs/research/2026-05-10-gpx-catalog-static-best-practices.md` — Lizenz + Catalog-Strategie
