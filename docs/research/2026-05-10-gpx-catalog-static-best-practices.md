---
title: Best Practices fuer statische GPX-Routenkataloge (MotoAtlas)
date: 2026-05-10
status: current
owner: lars
---

# Best Practices fuer statische GPX-Routenkataloge

Recherche-Synthese fuer MotoAtlas (pure static auf GitHub Pages, Git als Source of Truth, `route.gpx` + `route.json` Sidecar, CI-generierte `catalog.json`). Quellen siehe Ende, alle Access-Date 2026-05-10.

## TL;DR (Empfehlungen fuer MotoAtlas)

1. **GPX behalten als Source of Truth**, GeoJSON nur als Build-Artefakt im Catalog. Nicht doppelt committen.
2. **Douglas-Peucker** fuer Karten-Preview behalten (schnell, scharfe Kurven OK fuer Roads). Toleranz ~10 m fuer Overview, ~2-5 m fuer Detail-Layer. Visvalingam nur wenn Cartographic-Smoothness wichtig wird.
3. **Catalog-Strategie**: Bei <500 Routen ein Single-`catalog.json` (~1-3 MB gzipped) reicht. Ueber 500: Splitten in `catalog-meta.json` (alle Metadaten) + Geometrien als **PMTiles**. Pagination per Land/Typ erst bei >2000 Routen.
4. **Duplikat-Check verbessern**: Aktueller Haversine-Centroid bleibt als Cheap Filter (O(N)), bei Treffer-Kandidaten **Discrete Frechet** als Second-Pass (Bibliothek: `similaritymeasures` oder `traj-dist` in Python). Geohash-Prefix-Hashing als optionaler Index ab >500 Routen.
5. **Lizenzen**: ADAC NavBikeTour, Wikiloc, Komoot duerfen **nicht redistributed** werden — GPX selbst herunterladen erlauben (ja, persoenliche Nutzung), aber GPX-Files NICHT in den Katalog kopieren. Stattdessen Sidecar mit `source_url` und Hinweis, dass User selbst dort lädt. OSM-basierte Daten (Trans Euro Trail historisch GPS-aufgezeichnet) sind unkritischer, aber: Wenn aus OSM-Daten **abgeleitet**, ODbL Share-Alike + Attribution.
6. **SEO**: Pro Route eine eigene URL (`#/route/{id}` reicht nicht — `route/{id}.html` fuer Crawler), JSON-LD `TouristTrip` mit `itinerary` ItemList von `TouristAttraction`, `geo` mit Bounds. Sitemap.xml im CI auto-generieren.

## 1. Bestehende Projekte als Referenz

### Trans Euro Trail (TET)

- **Architektur**: zentralisierte Website (`transeurotrail.org`), pro Land ein "Linesman" pflegt das GPX und committed Updates. TET HQ ist die einzige offizielle Distribution.
- **Pattern**: Free Download, dezentrale Pflege ueber Country-Coordinators — vergleichbar mit MotoAtlas' `routes/{land}/` Struktur und potenziellen Maintainern pro Land.
- **Lessons**: "Single Source" um Fork-Drift zu verhindern. Versionierung pro Country-File macht Sinn.

### Wikiloc / Komoot

- **User-generated**, beide haben breite **non-exclusive Lizenzen** mit Recht zur Weitergabe an Dritte. Heisst praktisch: **du darfst Wikiloc-Tracks nicht in eine Drittsite redistribuieren**, ausser der originale Uploader hat explizit eine offene Lizenz (CC0/CC-BY) gewaehlt. Nur ein kleiner Bruchteil tut das.
- **Konsequenz fuer MotoAtlas**: `source_url` referenzieren ist OK (Linking), aber kein GPX-Mirror.

## 2. GPX vs GeoJSON — Format-Entscheidung

| Aspekt             | GPX 1.1                            | GeoJSON                                      |
| ------------------ | ---------------------------------- | -------------------------------------------- |
| Native im Browser  | nein (XML-parse)                   | ja (JSON.parse)                              |
| MapLibre/Leaflet   | nur via Plugin                     | direkt via `source: { type: 'geojson' }`     |
| Groesse (gzip)     | leicht groesser durch XML-Overhead | ~10-20% kleiner als GPX gzipped              |
| Elevation          | nativ `<ele>`                      | nur ueber Z in `coordinates` oder Properties |
| GPS-Geraete-Kompat | universal                          | nicht direkt                                 |
| Routing-Tools      | universal                          | Mapbox/MapLibre, weniger Geraete             |

**Empfehlung MotoAtlas**: GPX bleibt Source of Truth (Downloadbarkeit fuer User-Geraete ist Kernfeature). Im CI bei Catalog-Build **on-the-fly** Geometrie als GeoJSON-Koordinaten-Array in `catalog.json` einbauen — keine separaten `.geojson`-Files committen. Doppelte Wahrheit waere Wartungsschuld.

Zur Performance: GeoJSON-Source-Update via `setData()` in MapLibre ist bei grossen Collections langsam — fuer MotoAtlas mit Preview-Geometrie (max 500 Punkte/Route) auch bei 1000 Routen OK (~500k Punkte total = handlebar), aber: bei Filter-Wechseln nicht jedes Mal `setData()` mit allem aufrufen — Layer-Filter bevorzugen.

## 3. Track-Simplification

### Algorithmen-Vergleich

**Douglas-Peucker (Ramer-Douglas-Peucker)**:

- Toleranz = perpendicular distance (Meter)
- Schnell, O(n log n) durchschnittlich
- Erhaelt scharfe Knicke (Kurven) gut — passt fuer Roads
- Kann "spiky" wirken bei feinen Wackelbewegungen
- Industrial Standard (PostGIS `ST_Simplify`, turf.js `simplify`)

**Visvalingam-Whyatt**:

- Toleranz = area (m²) des kleinsten Dreiecks
- Glattere Linien, "nicer geometry"
- Praeferiert fuer Coastlines/natuerliche Features, Cartographic Smoothness
- Etwas langsamer

### Empfehlung MotoAtlas

Aktueller Ansatz (500-Punkte-Cap) ist OK. Bessere Variante: **Zoom-abhaengige Simplification** mit zwei Praezisionsstufen im Catalog:

- `geometry_overview`: DP-Toleranz ~50 m (~50-100 Punkte/Route) fuer Country-Overview
- `geometry_detail`: DP-Toleranz ~5 m (max 500 Punkte) fuer Zoom-In

Alternativ: **PMTiles** mit MapLibre's `maxzoom` ueber tippecanoe bauen — die simplifiziert per-Zoom-Level automatisch. Erst sinnvoll bei mehr als ~500 Routen.

Toleranz-Bandbreite fuer Roads (aus Praxis):

- Globe/Europe-View: 50-100 m
- Country-View: 10-25 m
- Region-View: 2-5 m
- Detail (Zoom >12): Original behalten

## 4. Catalog-Index-Strategien

### Option A — Single JSON (aktuell)

- 1 Datei `catalog.json`, alle Metadaten + simplified Geometrie
- Pro Route ~3-10 KB (mit Geometrie), 500 Routen ~3 MB raw / ~800 KB gzipped
- Lazy ist nicht moeglich — erst Geometrie laden wenn sichtbar
- **Sweet Spot bis ~500 Routen**

### Option B — Split Meta + Geometrie

- `catalog-meta.json` (alle Sidecar-Felder, Bounds, KEIN Geometrie-Array) — bleibt klein (<300 KB bei 1000 Routen)
- Geometrie on-demand per Route: `geometry/{id}.json` (kleine Files, CDN-cachbar)
- Empfohlen ab ~500 Routen
- Browser laedt Metadaten + Bounds sofort, Trajektorien beim Hover/Click

### Option C — PMTiles

- Ein einzelnes `.pmtiles` File via HTTP Range Requests
- Skaliert auf 100k+ Features
- Bau via `tippecanoe` (GeoJSON → PMTiles, multi-zoom)
- Hosting: GitHub Pages **funktioniert** mit Range Requests
- Empfohlen ab ~2000 Routen oder wenn Performance bei Pan/Zoom kritisch wird
- Nachteil: ZIP-Collections und einzelne GPX-Downloads bleiben separat — PMTiles ersetzt nur Karten-Layer, nicht den Download

### Empfehlung MotoAtlas

Solange MotoAtlas <500 Routen hat: Single JSON behalten. Migration auf Split (Option B) ist trivial vom CI her: `build_catalog.py` schreibt zusaetzlich `geometry/{id}.json`, Frontend laedt lazy. PMTiles erst bei echtem Volume-Problem oder wenn Country-Layer mehr als ~50k Vertices kumulativ haben.

## 5. Duplikat-Erkennung jenseits Haversine-Centroid

Aktueller Ansatz: Centroid-Distance Haversine. Schwaeche: zwei verschiedene Routen mit aehnlichem Schwerpunkt (z.B. zwei Rundtouren aus derselben Stadt) flaggen als Duplikat — und zwei sehr aehnliche Tracks mit leicht verschobener Mittelpunkts-Statistik werden nicht erkannt.

### Verbesserte Pipeline (cascading)

**Stufe 1 — Fast Filter (O(N))** — behalten:

- Centroid-Distance < 1 km UND
- Bounds-Overlap > 50% (BBox-Intersection)
- → Kandidaten fuer Stufe 2

**Stufe 2 — Geometrische Aehnlichkeit (O(M)) auf Kandidaten**:

- **Discrete Frechet Distance**: misst Kurven-Aehnlichkeit unter Beruecksichtigung der Reihenfolge ("Mensch + Hund an der Leine"). Threshold z.B. 500 m = "praktisch derselbe Track".
- Alternative: **DTW (Dynamic Time Warping)** — schneller zu berechnen als Frechet, robust gegen unterschiedliche Sampling-Raten. Aber: ignoriert die "max"-Eigenschaft (Average statt Worst Case) → bei zwei Tracks die sich an EINER Stelle stark unterscheiden, kann DTW kleinen Wert liefern.
- Fuer MotoAtlas-Use-Case (echte Duplikate finden) ist **Frechet praeziser**, DTW schneller. Bei <500 Kandidaten ist Frechet OK.

**Python-Tools**:

- `similaritymeasures` (pip) — implementiert Frechet, DTW, Area Method, Curve Length
- `traj-dist` — spezialisiert auf Trajectory-Distance
- `frechetdist` — leichtgewichtig, nur Discrete Frechet

### Geohash als Index (optional)

Bei >500 Routen lohnt sich ein Geohash-basierter Index:

- Jeden Track-Punkt zu Geohash-Prefix Level 5 (~5 km Kacheln) hashen
- Track-Signatur = Set unique geohashes
- Zwei Tracks mit Jaccard-Similarity > 0.7 auf Signaturen → potentielles Duplikat
- O(1) Lookup statt O(N) Vergleich

Forschung: "Geodabs" Paper (Chapuis 2018) zeigt das Pattern produktionsreif.

## 6. Lizenzen — was darf in MotoAtlas?

### OpenStreetMap-basierte Daten (ODbL)

- **Track GPS-aufgezeichnet im OSM-Raum**: kein OSM-Derivative, eigene Daten — frei lizenzierbar
- **Track aus OSM-Routing-API generiert** (GraphHopper, OSRM, Kurviger): Derived Database → **ODbL Share-Alike + Attribution Pflicht**. Attribution: "© OpenStreetMap contributors" sichtbar auf der Site.
- **Best Practice**: Algorithmisch generierte Tracks (Kurviger-Output, OSRM-Output) gehoeren laut MotoAtlas-CLAUDE.md ohnehin nicht in den Katalog. Damit ist ODbL-Problem in Praxis vermeidbar.

### ADAC NavBikeTour

- AGB: GPX-Daten "ausschliesslich fuer persoenliche, nicht-kommerzielle Nutzung", "Verbreitung oder Veroeffentlichung nicht gestattet"
- **Konsequenz**: ADAC-Routen NICHT als GPX in das Repo committen. Sidecar mit `source_url` zum ADAC-Download ist OK (deep-link auf NavBikeTour-Seite).
- Auch wenn ADAC kostenlos verteilt, ist Redistribution untersagt.

### Wikiloc

- ToS: "non-exclusive license, with right to sub-license to any third party" — Wikiloc selbst darf weitergeben, **Drittsite darf nicht**.
- Ausnahme: Wenn der Uploader explizit eine offene Lizenz (CC-BY, CC0) gewaehlt hat, lizenzpfad-abhaengig moeglich. Praktisch selten klar markiert.
- **Konsequenz**: Auch hier nur Link, kein Mirror.

### Komoot

- Identische Logik wie Wikiloc — non-exclusive an Komoot, nicht uebertragbar.

### Trans Euro Trail

- Distribution explizit ueber TET-Website, Linesmen verwalten. Lizenz auf Site nicht klar als offen markiert → kein Mirror, nur Link.

### Empfehlung MotoAtlas

Es entstehen zwei sichere Quellen-Kategorien:

1. **Selbst gefahrene / vom Autor explizit CC-BY freigegebene Tracks** → in `routes/` committen
2. **Externe Quellen (ADAC, Wikiloc, Komoot, TET)** → nicht mirroren, stattdessen "Curated Link Collection" Eintrag mit `source_url`, `source_name`, ggf. Preview-Bild (eigenes), aber GPX-Download nur ueber Originalquelle

Das bricht die aktuelle MotoAtlas-Annahme "jede Route hat `route.gpx`". Loesung: Sidecar-Feld `gpx_redistribution: "allowed" | "link_only"` einfuehren. Bei `link_only` ist `route.gpx` optional — Frontend zeigt "Download via {source}" Button statt direkten GPX-Link.

## 7. SEO fuer statische Routen-Sites

### Pre-rendering (kritisch)

SPA-only mit Hash-Routing (`#/route/{id}`) ist fuer Crawler tot. Optionen:

- **Vite SSG** (`vite-plugin-ssg` oder Migration zu Astro/Eleventy): pro Route eine statische HTML
- **Pre-render im CI**: Route-Liste aus catalog.json → fuer jede Route eine HTML-Seite mit serialisiertem JSON-LD
- Ohne Pre-render: keine Indexierung der Einzelrouten

### JSON-LD pro Route

```json
{
  "@context": "https://schema.org",
  "@type": "TouristTrip",
  "name": "Eifel Volcanic Route",
  "description": "...",
  "touristType": ["Motorradtouristen", "Adventure Riding"],
  "geo": {
    "@type": "GeoShape",
    "box": "50.0 6.0 50.5 7.0"
  },
  "itinerary": {
    "@type": "ItemList",
    "itemListElement": [
      { "@type": "TouristAttraction", "name": "Nuerburgring", "geo": {...} }
    ]
  }
}
```

Hinweis: Google hat **keine Rich Results** fuer `TouristTrip` (Stand 2026), aber semantische Indexierung profitiert. `Place` mit `geo: GeoCoordinates` fuer Start/Endpunkt wird breiter unterstuetzt.

### sitemap.xml

Auto-generieren im CI:

- `/` (Catalog)
- `/#/map` (interaktive Karte, geringere Prio)
- `/route/{id}` (pro Route, `<lastmod>` = git commit date)
- `priority`: 1.0 Home, 0.8 Routes, 0.5 Map

### robots.txt + canonical

- Canonical-URL pro Route gegen Dupe-Risiko bei Country-Tabs
- `<link rel="alternate" hreflang="de">` falls Multi-Lingual

## 8. Konkrete Action Items fuer MotoAtlas

| #   | Item                                                                                       | Effort | Wert                                 |
| --- | ------------------------------------------------------------------------------------------ | ------ | ------------------------------------ |
| 1   | Sidecar-Feld `gpx_redistribution` einfuehren + `validate_sidecar.py` Test                  | S      | hoch (Lizenz-Compliance)             |
| 2   | `check_duplicates.py` um Frechet-Stufe erweitern (similaritymeasures pip)                  | S      | mittel                               |
| 3   | Pre-rendering einbauen (Astro-Migration oder Vite-SSG) fuer `/route/{id}` HTML + JSON-LD   | M-L    | hoch (SEO)                           |
| 4   | sitemap.xml im build-deploy.yml generieren                                                 | S      | mittel                               |
| 5   | `geometry_overview` zusaetzliche Praezisionsstufe in catalog.json (Build-Schritt)          | S      | mittel (Performance bei viel Routen) |
| 6   | OSM-Attribution sichtbar im Footer (auch wenn nur MapTiler-Tiles)                          | XS     | Pflicht                              |
| 7   | Lizenz-Audit aller existierenden Routen — `source_url` pro Route auf Restriktionen pruefen | M      | hoch (Risk)                          |
| 8   | Migration auf Split-Catalog (Meta + per-Route Geometrie) — erst bei >500 Routen            | M      | spaeter                              |

## Quellen

- [Trans Euro Trail — Linesmen](https://transeurotrail.org/the-linesmen/) (2026-05-10)
- [Trans Euro Trail App](https://transeurotrail.org/the-tet-app/) (2026-05-10)
- [GPX vs GeoJSON Comparison — GPXFIT](https://skeffling.net/gpxfit/help/gpx-fit-geojson-comparison.html) (2026-05-10)
- [GeoJSON vs GPX — Robert Ferguson Blog](https://rewferguson.com/blog/geojson-vs-gpx/) (2026-05-10)
- [MapLibre: Optimising Performance for Large GeoJSON Datasets](https://maplibre.org/maplibre-gl-js/docs/guides/large-data/) (2026-05-10)
- [GeoJSON Source setData performance — MapLibre Issue #106](https://github.com/maplibre/maplibre-gl-js/issues/106) (2026-05-10)
- [Ramer-Douglas-Peucker — Wikipedia](https://en.wikipedia.org/wiki/Ramer%E2%80%93Douglas%E2%80%93Peucker_algorithm) (2026-05-10)
- [Visvalingam vs Douglas-Peucker — msbarry Gist](https://gist.github.com/msbarry/9152218) (2026-05-10)
- [Line Simplification Algorithms — Martin Fleischmann](https://martinfleischmann.net/line-simplification-algorithms/) (2026-05-10)
- [PMTiles — Protomaps GitHub](https://github.com/protomaps/PMTiles) (2026-05-10)
- [What's new in PMTiles V3](https://protomaps.com/blog/pmtiles-v3-whats-new/) (2026-05-10)
- [Simon Willison TIL — PMTiles + maplibre-gl](https://til.simonwillison.net/gis/pmtiles) (2026-05-10)
- [PMTiles Cloud-Optimized Geospatial Formats Guide](https://guide.cloudnativegeo.org/pmtiles/intro.html) (2026-05-10)
- [Trajectory Distance Measures Survey — VLDBJ 2019](https://zheng-kai.com/paper/vldbj_2019.pdf) (2026-05-10)
- [Spatio-Temporal Trajectory Similarity Measures](https://arxiv.org/pdf/2303.05012) (2026-05-10)
- [Geodabs — Trajectory Indexing meets Fingerprinting](https://arxiv.org/pdf/1803.04292) (2026-05-10)
- [Discrete Frechet Distance with Applications — Wylie](https://www.cs.montana.edu/techreports/1314/Wylie.pdf) (2026-05-10)
- [Geohash — Wikipedia](https://en.wikipedia.org/wiki/Geohash) (2026-05-10)
- [Wikiloc Terms of Use](https://www.wikiloc.com/wikiloc/terms_en.html) (2026-05-10)
- [Komoot Terms of Service](https://www.komoot.com/terms-of-service) (2026-05-10)
- [ADAC NavBikeTour](https://www.adac.de/der-adac/regionalclubs/nrw/motorradtouren-fuers-navi/) (2026-05-10)
- [OSM Foundation — Attribution Guidelines](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines) (2026-05-10)
- [OSM — Open Database License Wiki](https://wiki.openstreetmap.org/wiki/Open_Database_License) (2026-05-10)
- [Open Data Commons — ODbL Text](https://opendatacommons.org/licenses/odbl/) (2026-05-10)
- [schema.org — TouristTrip](https://schema.org/TouristTrip) (2026-05-10)
- [schema.org — TouristAttraction](https://schema.org/TouristAttraction) (2026-05-10)
- [Schema Markup Strategies for Travel Websites — Black Bear Media](https://blackbearmedia.io/11-powerful-schema-markup-strategies-for-travel-websites/) (2026-05-10)
