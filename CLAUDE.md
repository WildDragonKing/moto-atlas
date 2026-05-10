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

- `index.html` — App-Shell, lädt CDN-React + MapLibre + Babel-Standalone
- `public/data.jsx` — Konstanten, `transformRoute`, `applyFilters`
- `public/sidebar.jsx` — Routenliste, Filter-Chips, RouteDetailPane
- `public/app.jsx` — MapLibre-Init, Layer-Logik, OSRM-Road-Snapping
- `public/styles.css` — MotoAtlas-Theme (Fraunces + JetBrains Mono, Pergament-Palette)
- `public/config.js` — von CI generiert (`window.MAPTILER_KEY`), gitignored

Default-Tile-Provider: **OpenFreeMap Liberty** (Vector, ohne Key). MapTiler Outdoor nur wenn `MAPTILER_KEY`-Secret in CI gesetzt. Performance-Settings in `app.jsx`: `fadeDuration: 0`, `refreshExpiredTiles: false`, `transformRequest`-Cache für Tiles, GeoJSON-Source mit `maxzoom: 12 / tolerance: 0.5`. Details: `docs/research/2026-05-10-maplibre-tile-performance.md`.

**XSS-Regel:** Alle Sidecar-Daten ausschließlich via JSX-Interpolation rendern (React escaped automatisch). Keine unsicheren HTML-Inject-APIs verwenden.

---

## CI/CD

**`validate.yml`** — bei PR auf `routes/**` oder `drafts/**`:

1. GPX-Schema, Elevation, Europa-Bounds, min. 10 Punkte
2. JSON-Sidecar Pflichtfelder + country/type-Whitelist
3. Haversine-Duplikat-Check (Schwerpunkt < 0,5km zur nächsten Route)

**`build-deploy.yml`** — bei Push auf `main`:

1. `build_catalog.py` → catalog.json mit Geometrie (vereinfacht, max 500 Punkte/Route)
2. ZIP-Collections für Scenic (pro Land+Typ + all-offroad + all-routes)
3. `config.js` aus `MAPTILER_KEY`-Secret schreiben (falls gesetzt)
4. Static-Assets (index.html, public/, catalog.json, routes/, drafts/) auf gh-pages

GitHub Secrets: `MAPTILER_KEY` (optional, Premium-Tiles), `ANTHROPIC_API_KEY` (für zukünftigen agent-review.yml).

---

## Tests

```bash
source .venv/bin/activate && pytest tests/ -v   # 18 Tests
```

| Datei                            | Tests                         |
| -------------------------------- | ----------------------------- |
| `tests/test_validate_gpx.py`     | 5 — GPX-Validierung           |
| `tests/test_validate_sidecar.py` | 5 — Sidecar-Schema            |
| `tests/test_check_duplicates.py` | 4 — inkl. self-reference-Skip |
| `tests/test_build_catalog.py`    | 4 — Katalog-Build             |

---

## Lokale Entwicklung

```bash
python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
python scripts/build_catalog.py                                              # catalog.json bauen
python3 -m http.server 5173 --directory public                               # Server starten
# Frontend erwartet /catalog.json, /routes/, /drafts/ im Server-Root → Symlinks
# in public/ pflegen oder anders mounten (vgl. .claude/launch.json).
```

Optional MapTiler-Key für Premium-Tiles (lokal): `public/config.js` mit `window.MAPTILER_KEY = "dein-key"` (gitignored). In CI über GitHub-Secret `MAPTILER_KEY`.

---

## Routen-Qualität & Lizenz

**Quellen-Policy:** Nur Routen aus Quellen mit expliziter Redistribution-Erlaubnis. Konkret: **eigene gefahrene Tracks**, Tracks aus dem Freundeskreis (mit Einverständnis), oder explizit frei lizenzierte Sammlungen (CC BY / CC BY-SA, Public Domain, Trans Euro Trail). **Keine** ADAC-NavBikeTour-Tracks, Wikiloc-Downloads, Komoot-Routen, BikeMap, oder ähnlich AGB-geschützte Bestände — auch nicht als Hotlink, da deren Nutzungsbedingungen "use on other websites" untersagen (vgl. [ADAC Reisen Nutzungsbedingungen](https://www.adacreisen.de/rechtliches/nutzungsbedingungen)). Algorithmisch generierte Tracks (Kurviger-API, namenlose OSM-Dumps) sind ebenfalls ausgeschlossen.

**Sidecar-Pflicht**: `gpx_redistribution` muss bei jeder Route gesetzt sein. Default `link_only` (= falls die Quelle keine Redistribution erlaubt, würde Hotlink nötig — Frontend zeigt dann nur den `source_url`-Link). Real verwendet das Repo aktuell ausschließlich `allowed`-Quellen.

**Quellen-Workflow**: Neue Route per `scripts/collect.sh <gpx-url|datei> --country de` ins `drafts/`-Verzeichnis. Sidecar manuell auffüllen (`name`, `source_url`, `source_name`, `gpx_redistribution: allowed`, optional `region`, `type`). Promote nach Review per `scripts/promote.sh drafts/de/route.gpx`.

Details: `docs/research/2026-05-10-gpx-catalog-static-best-practices.md`.

---

## Nicht in Scope (Phase 1)

Community-Ratings, User-Accounts, Kommentare, Routing-API-Integration, Mobile App.
