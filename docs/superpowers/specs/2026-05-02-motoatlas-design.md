---
title: MotoAtlas — Design Spec
date: 2026-05-02
status: current
owner: lbuettge
---

# MotoAtlas — Design Spec

Öffentliche Motorrad-GPX-Routensammlung für DE, BE, NL, FR, IT.
Kuratiert, agent-reviewed, direkt importierbar in Scenic.
URL: **moto.buettgen.app** · Repo: **github.com/lbuettge/moto-atlas**

---

## 1. Architektur

**Pure Static** — kein laufender Server, kein Backend.

```
Du / Agent
  → PR mit GPX + JSON
    → GitHub Actions (validate → agent-review → build → deploy)
      → GitHub Pages (moto.buettgen.app)
```

- Git ist die einzige Source of Truth
- GitHub Actions sind das einzige "Backend"
- Alle Artefakte (catalog.json, ZIPs) werden bei jedem Merge neu gebaut
- Custom Domain: `moto.buettgen.app` via CNAME → `lbuettge.github.io`
- Tech Stack: **Vite + MapLibre GL + Vanilla JS** (aus Bosnien-Projekt adaptiert)

---

## 2. Datenmodell

### 2.1 Repo-Struktur

```
routes/           ← Live-Routen (kuratiert, reviewed)
  de/
    offroad/
    touring/
  be/offroad/ touring/
  nl/touring/
  fr/offroad/ touring/
  it/offroad/ touring/

drafts/           ← Gesammelt, noch nicht promoted
  de/
  be/ nl/ fr/ it/

archive/          ← Geparkt, nie gelöscht, nicht im Katalog
  de/
  be/ nl/ fr/ it/

collections/      ← Generiert von CI (ZIP für Scenic)
catalog.json      ← Generiert von CI
scripts/          ← collect.sh, promote.sh, archive.sh, validate_gpx.py, …
src/              ← Vite-App (MapLibre, Frontend)
.github/workflows/
```

### 2.2 Route-Typen

| Typ       | Bedeutung                                                        |
| --------- | ---------------------------------------------------------------- |
| `offroad` | Schotter, Waldwege, Trails — keine reine Asphalt-Route           |
| `touring` | Kurvige Asphalt-Landstraßen, Pässe, Panoramastrecken             |
| `scenic`  | Primär für Sehenswürdigkeiten / Landschaft, gemischte Oberfläche |

### 2.3 GPX-Struktur (Pflicht)

```xml
<gpx version="1.1" creator="motoatlas">
  <metadata>
    <name>Volcanic Route Eifel</name>         <!-- Pflicht -->
    <desc>Schotter durch die Vulkaneifel…</desc>  <!-- Pflicht -->
    <keywords>offroad,eifel,schotter</keywords>
  </metadata>

  <!-- POIs als Waypoints -->
  <wpt lat="50.38" lon="6.74">
    <name>Camping Eifel See</name>
    <sym>Campground</sym>   <!-- Scenic-kompatibel -->
    <type>camp</type>
  </wpt>
  <wpt lat="50.41" lon="6.88">
    <name>Laacher See Aussicht</name>
    <sym>Scenic Area</sym>
    <type>sight</type>
  </wpt>

  <trk>
    <name>Volcanic Route Eifel</name>
    <type>offroad</type>
    <trkseg>
      <trkpt lat="50.32" lon="6.51">
        <ele>412.0</ele>   <!-- Elevation: Pflicht auf allen Punkten -->
      </trkpt>
      …
    </trkseg>
  </trk>
</gpx>
```

**Scenic-POI-Symbole:** `Campground`, `Scenic Area`, `Gas Station`, `Restaurant`

### 2.4 JSON-Sidecar-Schema

Gleicher Dateiname wie GPX, Endung `.json`.

```json
{
  // Identifikation — Pflicht
  "id": "de-eifel-volcanic-route",
  "name": "Volcanic Route Eifel",
  "country": "de",
  "region": "eifel",
  "type": "offroad",

  // Herkunft — Pflicht
  "source_url": "https://wikiloc.com/trails/…",
  "source_name": "Wikiloc",
  "modified": false,
  "modification_notes": "", // z.B. "Anfang gekürzt, Schotterpfad ergänzt"

  // Stats — von CI auto-berechnet, nicht manuell setzen
  "distance_km": 142,
  "elevation_gain_m": 1840,
  "duration_h": 3.5,
  "bounds": { "north": 50.5, "south": 50.1, "east": 7.1, "west": 6.4 },

  // Qualität — von CI + Agent befüllt
  "surface": "mixed", // paved | gravel | mixed
  "difficulty": 3, // 1–5
  "offroad_pct": 40, // % Schotteranteil (Agent schätzt aus GPX + Geländeprofil)
  "rating": 4.8, // Agent-Rating
  "rating_source": "agent",
  "agent_review": "Schöne Schotterpiste durch…",

  // Zeitstempel
  "added_at": "2026-05-02",
  "reviewed_at": "2026-05-02",

  // Deduplizierung — von CI befüllt
  "gpx_hash": "sha256:abc123",
  "similar_to": [] // IDs ähnlicher Routen falls Haversine-Match
}
```

**Minimal-JSON für Drafts** (nur das ist Pflicht beim Erstellen):

```json
{
  "name": "Eifel Loop Variant",
  "country": "de",
  "source_url": "https://…",
  "source_name": "Wikiloc"
}
```

CI und Agent füllen den Rest automatisch aus.

### 2.5 catalog.json (generiert)

```json
{
  "generated_at": "2026-05-02T10:00:00Z",
  "total": 47,
  "routes": [
    {
      "id": "de-eifel-volcanic-route",
      "name": "Volcanic Route Eifel",
      "country": "de", "region": "eifel", "type": "offroad",
      "distance_km": 142, "elevation_gain_m": 1840,
      "rating": 4.8, "difficulty": 3,
      "gpx_url": "routes/de/offroad/eifel-volcanic-route.gpx",
      "bounds": { "north": 50.5, "south": 50.1, "east": 7.1, "west": 6.4 }
    }
  ],
  "drafts": [ … ],     // Routen aus drafts/ mit status: "draft"
  "collections": [
    { "id": "de-offroad", "name": "Deutschland Offroad", "count": 12, "zip_url": "collections/de-offroad.zip" }
  ]
}
```

---

## 3. CI/CD Pipeline

Drei GitHub Actions Workflows:

### validate.yml — bei PR auf `routes/**` oder `drafts/**`

Checks (in dieser Reihenfolge, fail-fast):

1. XML well-formed
2. GPX 1.1 Schema (XSD via `gpxpy`)
3. `<ele>` auf allen `<trkpt>` vorhanden
4. Min. 10 Trackpunkte
5. Max. Dateigröße: 50 MB
6. Koordinaten in Europa (Bounds: 35°N–72°N, 10°W–32°E)
7. JSON-Sidecar existiert mit gleichem Basisnamen
8. JSON-Sidecar: Pflichtfelder vorhanden (`name`, `country`, `source_url`, `source_name`)
9. Kein Duplikat (Haversine-Distanz Schwerpunkt < 500m zu existierender Route)
10. Kein algorithmisch generierter Name (Heuristik: "Route 1", "Unnamed", Koordinaten als Name)

Fehler → PR-Comment mit exakter Fehlerstelle.

### agent-review.yml — nach validate.yml (nur bei Erfolg)

Modell: `claude-haiku-4-5-20251001` (~$0.001 pro Route)

Aufgaben:

- Stats berechnen: `distance_km`, `elevation_gain_m`, `duration_h`, `bounds`
- Route inhaltlich bewerten: Ist das eine schöne, interessante Route? Keine generischen Kurvenfresser.
- Rating (1–5) + kurzer `agent_review`-Text (2–3 Sätze Deutsch)
- `difficulty`, `surface`, `offroad_pct` schätzen
- Tags vorschlagen
- JSON-Sidecar aktualisieren und auf PR-Branch committen

Agent-Review-Kriterien:

- Landschaft / Eigencharakter der Route
- Qualität der GPX-Daten (ausreichend Punkte, saubere Linie)
- Offroad-Anteil stimmt mit Typ überein
- Quellenangabe vollständig

### build-deploy.yml — bei Push auf `main`

1. Alle JSON-Sidecars lesen → `catalog.json` generieren
2. Scenic-Collections bauen (ZIP pro Land+Typ + `all-routes.zip` + `all-offroad.zip`)
3. Vite Build
4. GitHub Pages deployen (`gh-pages`-Branch)
5. Laufzeit gesamt: ~3–5 min

---

## 4. Recherche- & Curation-Workflow

### Routen-Lifecycle

```
DRAFT (drafts/{land}/)
  → CI validate + Agent review (bei PR)
    → Du entscheidest: promote oder archive
      → LIVE (routes/{land}/{typ}/)    — sichtbar mit Download
      → ARCHIV (archive/{land}/)       — im Repo, nicht im Katalog
```

Nichts wird jemals gelöscht. Archive ist permanent.

### Drafts auf der Website

Eigener Bereich auf der Startseite: "In Bearbeitung — N Routen warten auf Review"

- Ausgegraute Karten mit "Draft"-Badge
- Kein GPX-Download-Button
- Gestrichelte Linie auf der Karte
- "Wird bewertet…" statt Rating

### Helper-Scripts

```bash
# Route von URL sammeln → drafts/
scripts/collect.sh <url-oder-pfad> --country de [--type offroad]

# Draft promoten → routes/{country}/{type}/ (type aus JSON-Sidecar)
# id wird aus Dateiname ohne Extension gebildet: eifel-loop.gpx → de-eifel-loop
scripts/promote.sh drafts/de/eifel-loop.gpx

# Route archivieren
scripts/archive.sh routes/de/offroad/old-route.gpx "von v2 abgelöst"
```

---

## 5. Crawling-Strategie

Nur echte, von Menschen gefahrene oder sorgfältig geplante Routen.
**Keine algorithmisch generierten "fahr-Kurven"-Routen** (kein Kurviger-API-Output, keine rohen OSM-Track-Dumps ohne Kuration).

### Tier 1 — Vollautomatisch (legal, open)

| Quelle               | Methode                                                                                   | Cadence                       |
| -------------------- | ----------------------------------------------------------------------------------------- | ----------------------------- |
| **OSM Overpass API** | Query `relation[route=motorcycle]` mit kuratiertem Namen in DE/BE/NL/FR/IT Bounding Boxes | Wöchentlich via GitHub Action |
| **Trans Euro Trail** | GitHub-Repo-Watch, Sections für relevante Länder                                          | Bei TET-Updates               |
| **GIVI Explorer**    | GPX-Links scrapen (öffentlich, kein Login)                                                | Einmalig + quartalsweise      |

OSM-Filter: nur `relation[route=motorcycle]` mit gesetztem `name`-Tag — keine namenlosen `highway=track`-Exports.

### Tier 2 — Halbautomatisch (ToS respektieren)

| Quelle                | Methode                                                 |
| --------------------- | ------------------------------------------------------- |
| **Wikiloc**           | `collect.sh <wikiloc-url>` — einzeln, manuell ausgelöst |
| **Komoot**            | `collect.sh <komoot-url>` — einzeln, manuell ausgelöst  |
| **Best Biking Roads** | `collect.sh <bbr-url>` — einzeln, manuell ausgelöst     |

Kein automatischer Bulk-Crawler für Tier-2-Quellen.

### Tier 3 — Agent-gestützte Recherche

```bash
scripts/research.sh "eifel offroad motorrad"
```

Claude (Sonnet) sucht im Web nach Routen-Quellen für den Begriff, gibt eine priorisierte Liste mit URLs, Kurzinfos und Qualitätseinschätzung zurück. Du wählst, `collect.sh` übernimmt den Rest.

### Quellenangabe (Pflicht in jedem JSON)

- `source_url`: direkte URL zur Originalroute
- `source_name`: Plattform-Name (Wikiloc, Komoot, TET, OSM, Eigene Aufzeichnung, …)
- `modified`: `true`/`false`
- `modification_notes`: wenn `modified: true`, kurze Beschreibung der Änderung

---

## 6. Web-Frontend

Stack: **Vite + MapLibre GL + Vanilla JS** (aus `../bosnien` adaptiert)

### Seiten (Hash-Navigation)

| Route          | Inhalt                                                                           |
| -------------- | -------------------------------------------------------------------------------- |
| `/`            | Hero + Länder-Filter + Route-Cards + Draft-Bereich + Scenic-Collection-Downloads |
| `/#/map`       | MapLibre GL Karte, alle Routen als Layer, Filter-Sidebar, GPS-Button             |
| `/#/route/:id` | Detail: Mini-Karte, Elevation-Profil, Stats, Agent-Review, GPX-Download          |

### Aus Bosnien-Projekt wiederverwendet

- `map.js` — MapLibre GL Init, Tile-Sources, 3D-Terrain
- `tiles.js` — MapTiler/Fallback-Tiles
- `gps.js` — GPS-Tracking, Nearby-POIs
- `routing.js` → `hav()` für Distanzberechnung
- `style.css` — Sidebar-Grundstruktur (angepasst)

### Neu geschrieben

- `catalog.js` — catalog.json laden, filtern, rendern
- `route-detail.js` — Einzelrouten-View, Elevation-Profil (SVG)
- `filter.js` — Land/Typ/Schwierigkeit-Filter-State
- `download.js` — GPX + ZIP-Download
- `hero.js` — Animierte Routen-Linien im Hero (SVG stroke-dashoffset)
- `index.html` + MotoAtlas-Theme (Fraunces + JetBrains Mono, Pergament-Palette)

### Design-Sprache

- Farben: Cream `#f5efe0`, Terracotta `#c4501e`, Ink `#1c1208`, Forest `#2d5016`, Amber `#d4882a`
- Fonts: Fraunces (Display/Headings) + JetBrains Mono (Meta/Stats) + Lato (Body)
- Stil: Vintage Adventure Atlas — warm, reiselustig, leicht quirky mit CSS-Animationen

---

## 7. Scenic-Export

### Einzelne Route

Direkt-Download der GPX-Datei via Browser → Safari → "In Scenic öffnen".

URL-Schema: `moto.buettgen.app/routes/de/offroad/eifel-volcanic-route.gpx`

### Collections (ZIP)

CI baut 11 Standard-Collections:

```
collections/
  de-offroad.zip      be-offroad.zip      fr-offroad.zip
  de-touring.zip      be-touring.zip      fr-touring.zip
  nl-touring.zip      it-offroad.zip      it-touring.zip
  all-offroad.zip     all-routes.zip
```

### Custom Domain Setup

```
DNS: CNAME  moto  →  lbuettge.github.io
Repo: public/CNAME  →  moto.buettgen.app
GitHub Pages: Branch gh-pages, Custom Domain, Enforce HTTPS
```

---

## 8. GitHub Repo

| Feld            | Wert                                           |
| --------------- | ---------------------------------------------- |
| Name            | `moto-atlas`                                   |
| Owner           | `lbuettge`                                     |
| Visibility      | Public                                         |
| License         | MIT                                            |
| Topics          | `gpx motorcycle scenic offroad touring europe` |
| Pages           | `gh-pages` Branch                              |
| Secrets         | `ANTHROPIC_API_KEY` (für agent-review.yml)     |
| Secret optional | `MAPTILER_KEY` (für Karten-Tiles)              |

---

## Nicht in Scope (Phase 1)

- Community-Ratings (kein Server)
- User-Accounts
- Kommentar-Funktion
- Routing-API-Integration (kein Kurviger-Output)
- Mobile App
- Mehrsprachigkeit
