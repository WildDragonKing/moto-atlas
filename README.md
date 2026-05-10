# MotoAtlas

Kuratierte Motorrad-GPX-Routensammlung für DE, BE, NL, FR, IT — direkt importierbar in [Scenic](https://scenic.app).

**Live:** https://moto.buettgen.app

## Was es macht

- Browse und Filter nach Land/Typ (Offroad / Touring / Scenic)
- MapLibre GL Karte mit feature-state-getriebenem Hover/Selected
- GPX-Download pro Route, ZIP-Collections pro Land/Typ für Scenic Bulk-Import
- CI prüft bei jedem PR: Schema, Elevation, Duplikate, Pflichtfelder, Lizenz-Flag

## Stack

- **Frontend:** Vite 5 + Svelte 5 (Runes) + MapLibre GL · Bundle ~240 KB gzipped
- **Toolchain:** [Vite+](https://viteplus.dev) (`vp`) für unified Lint/Format/Type-Check/Test (Oxlint + Oxfmt + Vitest + Task-Runner mit Cache)
- **Tiles:** OpenFreeMap Liberty (Vector, ohne Key) — MapTiler optional via `VITE_MAPTILER_KEY`
- **CI/CD:** GitHub Actions → Pages
- **Pipeline:** Python für GPX-Validierung, Catalog-Build, Duplikat-Check

## Starten

```bash
brew install vite-plus              # einmalig — oder: curl -fsSL https://vite.plus | bash
python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
pnpm install
pnpm catalog                         # vp run catalog (cached) — baut catalog.json
pnpm dev                             # http://localhost:5173
```

### Vite+ Workflow

```bash
pnpm check       # vp check — Format + Lint + Type-Check in einem Pass (vor Commit)
pnpm lint        # nur Oxlint (600+ Regeln, ESLint-kompatibel)
pnpm fmt         # Oxfmt auto-fix
pnpm test        # vp test run — Vitest one-shot
pnpm pytest      # vp run pytest — Python-Tests (mit Cache)
pnpm build       # Produktions-Build nach dist/
```

> **Hinweis:** `vp dev` / `vp build` werden aktuell **nicht** als Wrapper genutzt, weil das bundled Vite 8 von Vite+ inkompatibel mit `@sveltejs/vite-plugin-svelte@4` (Svelte-5-Support) ist und INFORM-Artifactory `@esbuild/darwin-arm64@>=0.24` blockt. `pnpm dev`/`pnpm build` rufen lokales Vite 5 auf. Alle anderen vp-Befehle laufen normal.

## Route hinzufügen

```bash
# 1. Sammeln (URL oder lokale Datei → drafts/)
bash scripts/collect.sh <url-oder-pfad> --country de --type offroad

# 2. Nach Review promoten
bash scripts/promote.sh drafts/de/meine-route.gpx
```

Jede Route braucht eine `.gpx` + `.json` Sidecar-Datei. Minimales Sidecar:

```json
{
  "name": "Routenname",
  "country": "de",
  "source_url": "https://example.org/meine-tour",
  "source_name": "Eigene Tour",
  "gpx_redistribution": "allowed"
}
```

Nur eigene Tracks oder Tracks aus dem Freundeskreis (mit Einverständnis). Keine algorithmisch generierten Tracks. **Keine Inhalte aus AGB-geschützten Quellen** (ADAC NavBikeTour, Wikiloc, Komoot, BikeMap) — auch nicht als Hotlink. `source_url`, `source_name`, `gpx_redistribution` sind Pflicht.

## Struktur

```
routes/{land}/{typ}/   ← Live (GPX + JSON)
drafts/{land}/         ← Gesammelt, noch nicht reviewed
archive/{land}/        ← Geparkt, nie gelöscht
scripts/               ← collect.sh, promote.sh, archive.sh, build_catalog.py, …
tests/                 ← 18 Pytest (Validatoren + Catalog-Build)
tests-js/              ← 10 Vitest (transformRoute + applyFilters)
src/                   ← Vite-Frontend (Svelte 5 + MapLibre GL)
.github/workflows/     ← validate.yml, build-deploy.yml
```

## Konfiguration

- `vite.config.js` — Vite + Vitest + Vite+ Run-Tasks in einer Datei
- `.oxlintrc.json` — Oxlint-Regeln + Ignore-Patterns
- `.oxfmtignore` — Oxfmt-Ignore
- `.env.local` — optional `VITE_MAPTILER_KEY=...` für Premium-Tiles
- `package.json` — pnpm-Overrides für esbuild 0.21.5 (Artifactory-Workaround)

## Lizenz

MIT
