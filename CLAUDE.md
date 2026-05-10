# MotoAtlas — Claude-Projektdokumentation

Öffentliche Motorrad-GPX-Routensammlung für DE, BE, NL, FR, IT. Pure Static — kein Server, keine Datenbank. Git ist die einzige Source of Truth. Deployed auf GitHub Pages via GitHub Actions.

---

## Architektur

```
routes/{land}/{typ}/   ← Live-Routen (kuratiert, reviewed)
drafts/{land}/         ← In Bearbeitung (im Frontend sichtbar, kein Download)
archive/{land}/        ← Geparkt, nie gelöscht, nicht im Katalog

catalog.json           ← CI-generiert, NICHT committen (in .gitignore)
collections/*.zip      ← CI-generiert, NICHT committen
scripts/               ← Python-Validierung + Shell-Helper
public/                ← Frontend (CDN-React + MapLibre GL, text/babel inline)
.github/workflows/     ← validate.yml + build-deploy.yml
```

Frontend ist bewusst **build-frei**: CDN-React + `@babel/standalone` inline-Transpile, kein Vite-Build, kein npm-Install für Lokalentwicklung nötig. Trade-off bewusst akzeptiert — Babel-Standalone ist ~1 MB und transpiliert JSX im Browser, was den ersten Pageload verlangsamt. Wenn Performance kritisch wird, ist eine Vite-Migration der dokumentierte Plan-B (vgl. `docs/research/2026-05-10-vite-static-deploy-performance.md`).

Jede Route besteht aus zwei Dateien mit gleichem Basisnamen:

- `route.gpx` — GPX 1.1, Pflicht: name (metadata oder track), Elevation, ≥10 Trackpunkte, Europa-Bounds
- `route.json` — Sidecar mit Metadaten (siehe Schema unten)

---

## Scripts

| Befehl                                                              | Zweck                                  |
| ------------------------------------------------------------------- | -------------------------------------- |
| `python scripts/build_catalog.py`                                   | catalog.json + Geometrie aus GPX bauen |
| `python scripts/validate_gpx.py <f.gpx>`                            | GPX prüfen (Schema, ele, bounds)       |
| `python scripts/validate_sidecar.py <f.json>`                       | Sidecar-Pflichtfelder prüfen           |
| `python scripts/check_duplicates.py <f.gpx> --catalog catalog.json` | Duplikat-Check (Haversine)             |
| `bash scripts/collect.sh <url\|pfad> --country de [--type offroad]` | Route → drafts/                        |
| `bash scripts/promote.sh drafts/de/route.gpx`                       | Draft → routes/{country}/{type}/       |
| `bash scripts/archive.sh routes/…/route.gpx ["Grund"]`              | Route → archive/                       |

---

## Sidecar-Schema

**Pflichtfelder** (manuell setzen):

```json
{
  "name": "Route Name",
  "country": "de",
  "source_url": "https://…",
  "source_name": "ADAC",
  "gpx_redistribution": "allowed"
}
```

`gpx_redistribution` ist Lizenz-Schalter. `"allowed"` = GPX wird in catalog.json verlinkt und im Frontend zum Download angeboten. `"link_only"` = `gpx_url` wird **nicht** in catalog gerendert, das Frontend zeigt stattdessen einen Link auf `source_url`. Default ist `link_only` (Vorsicht zuerst) — Redistribution-Rechte zwingend prüfen, bevor `allowed` gesetzt wird. ADAC NavBikeTour, Wikiloc, Komoot: **nicht** redistributable → `link_only`. Trans Euro Trail, eigene Tracks: `allowed`.

**Von CI auto-befüllt** (nie manuell setzen):
`distance_km`, `elevation_gain_m`, `duration_h`, `bounds`, `geometry`, `gpx_url` (nur bei `allowed`), `status`, `id`

**Von Agent befüllt** (agent-review.yml, Plan 3):
`rating`, `agent_review`, `difficulty`, `surface`, `offroad_pct`, `reviewed_at`

**Optionale Felder:**

```json
{
  "id": "de-eifel-volcanic-route",
  "region": "eifel",
  "type": "offroad",
  "source_gpx_url": "https://example.com/route.gpx",
  "modified": false,
  "modification_notes": ""
}
```

`source_gpx_url` ist nur für `link_only`-Routen relevant: ein **Hotlink** auf die GPX-Datei bei der Originalquelle (z.B. ADAC-CDN-Pfad einer einzelnen Route). Wenn gesetzt, zeigt das Frontend trotzdem einen GPX-Download-Button und der Scenic-Deeplink funktioniert. Bei Routen wo der Direct-Link nicht stabil/erreichbar ist (Wikiloc verlangt Login, viele SPAs), leerlassen — dann fällt das Frontend auf den reinen `source_url`-Link zurück. Hotlinking kann in den AGB einiger Anbieter problematisch sein, also case-by-case prüfen.

Erlaubte `country`-Werte: `de`, `be`, `nl`, `fr`, `it`
Erlaubte `type`-Werte: `offroad`, `touring`, `scenic`
Erlaubte `gpx_redistribution`-Werte: `allowed`, `link_only`

---

## Frontend

**Stack:** Vite 6 + Svelte 5 (Runes) + MapLibre GL. **Vite+ (`vp`)** als unified Toolchain für Dev/Build/Lint/Format/Type-Check/Test (Rolldown + Oxlint + Oxfmt + tsgo + Vitest). Kein SvelteKit, kein React, kein Babel-Standalone mehr. Build-Output: ~236 KB gzipped (vs ~1.3 MB unter dem alten CDN-React-Setup).

**Vite+ Workflow (kompletter Stack):**

- `vp dev` / `vp build` / `vp preview` — Rolldown-native Build in ~260 ms
- `vp check` / `vp lint` / `vp fmt` / `vp test` — Format/Lint/Type-Check/Tests in einem Pass
- `vp run catalog` / `vp run pytest` — Task-Runner mit transparentem Cache
- Single-Config (`vite.config.js`) deckt Vite + Vitest + Run-Tasks ab; `.oxlintrc.json` + `.oxfmtignore` halten die Check-Pipeline grün

**Stack-Pins (Artifactory-Workarounds, dokumentiert für Reproduzierbarkeit):**

- `vite@^6` + `@sveltejs/vite-plugin-svelte@^5` für Svelte 5
- `pnpm.overrides.esbuild = "0.21.5"` + manueller Symlink `node_modules/@esbuild/darwin-arm64 → 0.21.5` (INFORM-Artifactory blockt `@esbuild/darwin-arm64@>=0.24` mit 403; ältere Version ist API-kompatibel genug)
- `pnpm install --no-optional` damit der 403-Pfad für die optional dep nicht versucht wird
- `build.cssMinify: false` + `css.transformer: "postcss"` weil die vp brew bottle `lightningcss-darwin-arm64.node` nicht mitliefert
- `resolve.conditions: ["browser"]` + `optimizeDeps.exclude: ["svelte"]` damit Svelte 5 nicht den Server-Build picked

- `index.html` — Vite-Entry, lädt nur `src/main.js` + Fonts
- `src/main.js` — Mount der App
- `src/App.svelte` — Container: lädt catalog.json, montiert `MapView` + `Sidebar`
- `src/lib/data.svelte.js` — Konstanten, `transformRoute`, `applyFilters`, `filters` + `ui` als globale `$state`-Stores (Svelte 5 Runes)
- `src/lib/MapView.svelte` — MapLibre-Init in `onMount`, 1 Layer (`routes`) mit `feature-state` für hover/selected, OSRM-Road-Snapping
- `src/lib/Sidebar.svelte` — Routenliste, Filter-Chips, mountet `RouteDetailPane`
- `src/lib/RouteDetailPane.svelte` — Detail-Pane mit Höhenprofil, Stats, Footer-Buttons
- `src/app.css` — MotoAtlas-Theme
- `public/` — statische Assets (CNAME) + Symlinks zu `catalog.json`/`routes/`/`drafts/` für den Dev-Server

Default-Tile-Provider: **OpenFreeMap Liberty** (Vector, ohne Key). MapTiler nur wenn `VITE_MAPTILER_KEY` gesetzt. Performance-Settings: `fadeDuration: 0`, `refreshExpiredTiles: false`, `prefetchZoomDelta: 5`, `transformRequest`-Cache für Tiles, GeoJSON-Source mit `maxzoom: 12 / tolerance: 0.5`, **1 Layer** mit feature-state-getriebenen line-width/blur. Details: `docs/research/2026-05-10-maplibre-tile-performance.md` und `docs/research/2026-05-10-vite-svelte-stack.md`.

**XSS-Regel:** Sidecar-Daten ausschließlich via Svelte-Template-Interpolation rendern (Svelte escaped automatisch). Keine `@html`-Direktive, keine `innerHTML`-Assignments.

---

## CI/CD

**`validate.yml`** — bei PR auf `routes/**` oder `drafts/**`:

1. GPX-Schema, Elevation, Europa-Bounds, min. 10 Punkte
2. JSON-Sidecar Pflichtfelder + country/type-Whitelist
3. Haversine-Duplikat-Check (Schwerpunkt < 0,5km zur nächsten Route)

**`build-deploy.yml`** — bei Push auf `main`:

1. `build_catalog.py` → catalog.json mit Geometrie (vereinfacht, max 500 Punkte/Route)
2. ZIP-Collections für Scenic (pro Land+Typ + all-offroad + all-routes)
3. `pnpm install --frozen-lockfile && pnpm build` mit `VITE_MAPTILER_KEY` aus Secret
4. `dist/` als Pages-Artifact deployen

GitHub Secrets: `MAPTILER_KEY` (optional, Premium-Tiles via `VITE_MAPTILER_KEY`), `ANTHROPIC_API_KEY` (für zukünftigen agent-review.yml).

---

## Tests

```bash
pnpm pytest                                     # vp run pytest — 18 Tests (cached)
pnpm test                                       # vp test run — 10 Vitest Tests
pnpm test:e2e                                   # vp dlx playwright test
pnpm check                                      # vp check — Format + Lint + Type-Check
```

| Datei                            | Tests                                           |
| -------------------------------- | ----------------------------------------------- |
| `tests/test_validate_gpx.py`     | 5 — GPX-Validierung                             |
| `tests/test_validate_sidecar.py` | 5 — Sidecar-Schema (inkl. `gpx_redistribution`) |
| `tests/test_check_duplicates.py` | 4 — inkl. self-reference-Skip                   |
| `tests/test_build_catalog.py`    | 4 — Katalog-Build                               |
| `tests-js/data.test.js`          | 10 — `transformRoute` + `applyFilters` (Vitest) |

---

## Lokale Entwicklung

```bash
# Vite+ installieren (einmalig)
brew install vite-plus              # oder curl -fsSL https://vite.plus | bash

# Python (Validatoren + Catalog-Build)
python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
pnpm catalog                         # vp run catalog (cached) — baut catalog.json

# Node (Frontend) — Vite Dev-Server mit HMR auf http://localhost:5173
pnpm install
pnpm dev                             # vp dev (Vite 6 + Rolldown + HMR)
pnpm check                           # vor Commit: Lint + Format + Type-Check
```

Frontend liest `catalog.json`, `routes/`, `drafts/` aus dem Server-Root — Vite serviert sie über Symlinks in `public/` (`public/catalog.json` → `../catalog.json` etc.). Symlinks sind gitignored und werden bei Bedarf einmalig angelegt.

Optional MapTiler-Key für Premium-Tiles (lokal): `.env.local` mit `VITE_MAPTILER_KEY=dein-key`. In CI über GitHub-Secret `MAPTILER_KEY`.

---

## Routen-Qualität & Lizenz

**Quellen-Policy:** Nur Routen aus Quellen mit expliziter Redistribution-Erlaubnis. Konkret: **eigene gefahrene Tracks**, Tracks aus dem Freundeskreis (mit Einverständnis), oder explizit frei lizenzierte Sammlungen (CC BY / CC BY-SA, Public Domain, Trans Euro Trail). **Keine** ADAC-NavBikeTour-Tracks, Wikiloc-Downloads, Komoot-Routen, BikeMap, oder ähnlich AGB-geschützte Bestände — auch nicht als Hotlink, da deren Nutzungsbedingungen "use on other websites" untersagen (vgl. [ADAC Reisen Nutzungsbedingungen](https://www.adacreisen.de/rechtliches/nutzungsbedingungen)). Algorithmisch generierte Tracks (Kurviger-API, namenlose OSM-Dumps) sind ebenfalls ausgeschlossen.

**Sidecar-Pflicht**: `gpx_redistribution` muss bei jeder Route gesetzt sein. Default `link_only` (= falls die Quelle keine Redistribution erlaubt, würde Hotlink nötig — Frontend zeigt dann nur den `source_url`-Link). Real verwendet das Repo aktuell ausschließlich `allowed`-Quellen.

**Quellen-Workflow**: Neue Route per `scripts/collect.sh <gpx-url|datei> --country de` ins `drafts/`-Verzeichnis. Sidecar manuell auffüllen (`name`, `source_url`, `source_name`, `gpx_redistribution: allowed`, optional `region`, `type`). Promote nach Review per `scripts/promote.sh drafts/de/route.gpx`.

Details: `docs/research/2026-05-10-gpx-catalog-static-best-practices.md`.

---

## Nicht in Scope (Phase 1)

Community-Ratings, User-Accounts, Kommentare, Routing-API-Integration, Mobile App.
