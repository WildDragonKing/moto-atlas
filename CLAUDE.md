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
src/                   ← Vite-Frontend (MapLibre GL)
.github/workflows/     ← validate.yml + build-deploy.yml
```

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
  "source_name": "ADAC"
}
```

**Von CI auto-befüllt** (nie manuell setzen):
`distance_km`, `elevation_gain_m`, `duration_h`, `bounds`, `geometry`, `gpx_url`, `status`, `id`

**Von Agent befüllt** (agent-review.yml, Plan 3):
`rating`, `agent_review`, `difficulty`, `surface`, `offroad_pct`, `reviewed_at`

**Optionale Felder:**

```json
{
  "id": "de-eifel-volcanic-route",
  "region": "eifel",
  "type": "offroad",
  "modified": false,
  "modification_notes": ""
}
```

Erlaubte `country`-Werte: `de`, `be`, `nl`, `fr`, `it`
Erlaubte `type`-Werte: `offroad`, `touring`, `scenic`

---

## Frontend

- `index.html` — App-Shell (Repo-Root, Vite-Einstieg)
- `src/main.js` — Hash-Router: `#/` → Katalog, `#/map` → Karte
- `src/catalog.js` — Route-Cards aus catalog.json (`loadCatalog`, `initCatalog`)
- `src/filter.js` — reaktiver Filter-State (`filterRoutes`, `renderCountryTabs`, `onFilterChange`)
- `src/map-view.js` — MapLibre GL Karte (`initMap`, `destroyMap`)
- `src/tiles.js` — MapTiler/Fallback-Tiles (`getBaseStyle`, `hasMaptiler`)
- `src/style.css` — MotoAtlas-Theme (Fraunces + JetBrains Mono, Pergament-Palette)

**XSS-Regel:** Kein `innerHTML` für Userdaten — ausschließlich `textContent` und DOM-API.

---

## CI/CD

**`validate.yml`** — bei PR auf `routes/**` oder `drafts/**`:

1. GPX-Schema, Elevation, Europa-Bounds, min. 10 Punkte
2. JSON-Sidecar Pflichtfelder + country/type-Whitelist
3. Haversine-Duplikat-Check (Schwerpunkt < 0,5km zur nächsten Route)

**`build-deploy.yml`** — bei Push auf `main`:

1. `build_catalog.py` → catalog.json mit Geometrie (vereinfacht, max 500 Punkte/Route)
2. ZIP-Collections für Scenic (pro Land+Typ + all-offroad + all-routes)
3. Vite Build → `dist/`
4. Deploy auf GitHub Pages (`gh-pages` Branch)

GitHub Secret: `ANTHROPIC_API_KEY` (für zukünftigen agent-review.yml)

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
pnpm install
python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
python scripts/build_catalog.py   # catalog.json lokal bauen
pnpm dev                           # http://localhost:5173
```

Optional MapTiler-Key für bessere Karten-Tiles:

```bash
echo "VITE_MAPTILER_KEY=dein-key" > .env.local
```

---

## Routen-Qualität

Nur echte, von Menschen gefahrene oder sorgfältig geplante Routen. **Keine algorithmisch generierten Tracks** (kein Kurviger-API-Output, keine namenlosen OSM-Track-Dumps). `source_url` ist Pflichtfeld.

Gute Quellen: ADAC NavBikeTour, Trans Euro Trail, Wikiloc (manuell, einzeln via `collect.sh`).

---

## Nicht in Scope (Phase 1)

Community-Ratings, User-Accounts, Kommentare, Routing-API-Integration, Mobile App.
