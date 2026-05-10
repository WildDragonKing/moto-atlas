---
title: MapLibre GL Tile-Loading-Performance — Best Practices 2025/2026
date: 2026-05-10
status: current
owner: lars
---

# MapLibre GL Tile-Loading-Performance

Recherche zu Tile-Loading-Performance fuer MotoAtlas (Vite + MapLibre GL,
deployed auf GitHub Pages). User-Beobachtung: Tile-Loading ist langsam.
Aktuell: `src/tiles.js` mit MapTiler (key-optional) und OSM-Raster-Fallback.

## Executive Summary — 3 konkrete Empfehlungen

1. **Provider-Wechsel: MapTiler key-optional + OSM-Raster-Fallback → OpenFreeMap als Default**
   OpenFreeMap (`https://tiles.openfreemap.org/styles/liberty` o.ae.) liefert
   Vector-Tiles ohne API-Key, ohne Registrierung, ohne dokumentiertes Limit
   (geplante Future-Rate-Limit-Schwelle: 100M Requests/24h pro Referrer —
   fuer ein Hobby-Projekt irrelevant). Vector-Tiles statt OSM-Raster bringen
   den groessten Sprung: kleinere Payloads pro Tile, Style auf dem Client,
   bessere Cache-Wiederverwendung, schaerfere Darstellung bei Zoom.
   MapTiler-Pfad als optionalen Premium-Style behalten, OSM-Raster als
   Last-Resort. Migration-Aufwand: ~30 LOC in `src/tiles.js`.

2. **`fadeDuration: 0` + `maxParallelImageRequests` an HTTP/2 anpassen**
   Im Map-Konstruktor (`new maplibregl.Map({ ..., fadeDuration: 0 })`)
   eliminiert das die 300ms-Cross-Fade-Animation, die gerade auf langsamen
   Verbindungen den "Tiles erscheinen langsam"-Eindruck dominiert. Zusaetzlich
   `maplibregl.config.MAX_PARALLEL_IMAGE_REQUESTS = 16` (Default) auf Wert
   pruefen — bei HTTP/2-Hosts (OpenFreeMap, MapTiler) kann ein hoeherer Wert
   helfen, bei HTTP/1.1-OSM-Tile-Servern eher niedriger lassen (Browser-Limit
   6 pro Origin greift sowieso).

3. **PMTiles + Protomaps-Style als Plan B fuer maximale Offline-/Static-Robustheit**
   Falls langfristig ein Subset Europas selbst gehostet werden soll (Source-of-
   Truth = Git → reproduzierbar, kein Vendor-Lock-in): PMTiles-Datei (Europa-
   Extract ~1-5 GB, mit `tippecanoe` oder fertigem Protomaps-Build) auf
   externen Static-Host (Cloudflare R2, B2, S3 mit Range-Requests).
   **NICHT auf GitHub Pages** — Range-Request-Support ist dort dokumentiert
   instabil (siehe Quellen, Issue #584). Fuer Phase 1 ueberdimensioniert,
   aber als ADR notieren wenn MotoAtlas-Traffic skaliert.

## Detail-Sections

### 1. Provider-Vergleich (Stand 05/2026)

| Provider     | Format        | API-Key  | Free-Limit                | Bemerkung                             |
| ------------ | ------------- | -------- | ------------------------- | ------------------------------------- |
| OpenFreeMap  | Vector        | nein     | keines (geplant 100M/24h) | OSM-Daten, Liberty/Positron/Bright    |
| MapTiler     | Vector+Raster | ja       | "free tier" (Sessions)    | Suspended bei Ueberschreitung         |
| Stadia Maps  | Vector+Raster | optional | nicht-kommerziell free    | Stamen-Toner-Lite ohne Key            |
| Protomaps    | PMTiles       | optional | API-Key free non-commerc. | Single-File self-host moeglich        |
| OSM Standard | Raster        | nein     | Tile Usage Policy         | NICHT als Default fuer Apps empfohlen |

Fuer MotoAtlas (Hobby, GitHub Pages, kein Login, geringe Last) ist
**OpenFreeMap** der pragmatischste Default. Kein Account-Setup, kein Key in
`.env`, deterministisches CDN-Verhalten.

Quellen:

- [OpenFreeMap](https://openfreemap.org/) — zugegriffen 2026-05-10
- [hyperknot/openfreemap (GitHub)](https://github.com/hyperknot/openfreemap) — zugegriffen 2026-05-10
- [OpenFreeMap survived 100k req/s (Hyperknot Blog)](https://blog.hyperknot.com/p/openfreemap-survived-100000-requests) — zugegriffen 2026-05-10
- [Stadia Maps Pricing](https://stadiamaps.com/pricing/) — zugegriffen 2026-05-10
- [MapTiler Cloud Pricing](https://www.maptiler.com/cloud/pricing/) — zugegriffen 2026-05-10
- [Protomaps Docs — PMTiles Concepts](https://docs.protomaps.com/pmtiles/) — zugegriffen 2026-05-10

### 2. Vector vs Raster — warum der Wechsel den groessten Hebel hat

- **Payload**: Vector-Tile ~5-30 KB (gzipped MVT) vs Raster-Tile ~30-100 KB PNG.
  Pro Viewport (~9-16 Tiles) Faktor 3-5x weniger Bytes.
- **Zoom-Verhalten**: Vector-Tiles werden client-seitig gerendert — Zwischen-
  Zooms erzeugen keine neuen HTTP-Requests, nur Re-Rendering aus bereits
  geladenen Tiles. Raster verlangt fuer jeden Zoom-Level neue Tile-Requests.
- **HTTP-Cache**: Vector-Tile-CDNs setzen i.d.R. lange Cache-Header
  (`Cache-Control: public, max-age=...`). Mit Service-Worker oder einfach
  via `transformRequest` keine Aenderung noetig — Browser-Cache reicht.
- **Re-Style ohne Reload**: Layer-Filter / Color-Aenderungen brauchen keine
  neuen Tile-Requests.

Quelle:

- [MapLibre Tile Management (DeepWiki)](https://deepwiki.com/maplibre/maplibre-gl-js/2.4-tile-management) — zugegriffen 2026-05-10

### 3. Konkrete MapLibre-Settings

```js
// In map-view.js bei new maplibregl.Map({...})
{
  style: getBaseStyle(),
  fadeDuration: 0,           // 300ms -> 0ms Cross-Fade
  maxZoom: 14,               // Motorradrouten brauchen selten >14
  minZoom: 4,                // Europa-Bounds: <4 nutzlos
  preserveDrawingBuffer: false,  // schon Default, explizit dokumentieren
  refreshExpiredTiles: false,    // bei statischen Routen unnoetig
  attributionControl: { compact: true },
}

// Global (vor erstem Map-Init)
maplibregl.config.MAX_PARALLEL_IMAGE_REQUESTS = 16;  // Default, anpassen wenn HTTP/2
```

Auf der **Source** (catalog.json / GeoJSON mit Routen-Geometrien):

```js
map.addSource("routes", {
  type: "geojson",
  data: "/catalog-geometry.geojson",
  maxzoom: 12, // Default 18 — fuer Polylines unnoetig
  tolerance: 0.5, // Simplify-Tolerance (Default 0.375), bei vielen Routen erhoehen
  buffer: 64, // Default 128 — halbiert Tile-Bytes leicht
});
```

`maxzoom` auf der GeoJSON-Source ist der **wichtigste** Knopf bei vielen
Routen: er steuert ab welchem Zoom keine neuen Geometrie-Tiles mehr generiert
werden — Re-Use aus Zoom 12 fuer alles darueber.

Quellen:

- [MapLibre: Optimising MapLibre Performance — Tips for Large GeoJSON](https://maplibre.org/maplibre-gl-js/docs/guides/large-data/) — zugegriffen 2026-05-10
- [MapLibre Performance Optimization (DeepWiki)](https://deepwiki.com/maplibre/maplibre-gl-js/5.2-performance-optimization-techniques) — zugegriffen 2026-05-10
- [MapLibre PR #2447: fadeDuration improvement](https://github.com/maplibre/maplibre-gl-js/pull/2447) — zugegriffen 2026-05-10
- [MapLibre Discussion #2443: Initial load Performance — FadeDuration](https://github.com/maplibre/maplibre-gl-js/discussions/2443) — zugegriffen 2026-05-10

### 4. `transformRequest` fuer HTTP-Caching und CDN-Steuerung

```js
new maplibregl.Map({
  transformRequest: (url, resourceType) => {
    // Cache-friendly: keine cache-busting Query-Strings durchlassen
    if (resourceType === "Tile") {
      return { url, cache: "force-cache" }; // Browser HTTP-Cache priorisieren
    }
    return { url };
  },
});
```

`cache: 'force-cache'` ist auf Vector-Tile-CDNs sicher (Tiles sind immutable
per URL — Style-Versionen aendern URL-Schema). Bei OSM-Raster eher
`'default'` lassen, da OSM-Tiles unter gleicher URL aktualisiert werden.

Quelle:

- [MapLibre RequestParameters API](https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/RequestParameters/) — zugegriffen 2026-05-10

### 5. PMTiles auf GitHub Pages — Vorsicht

Theoretisch attraktiv (Single-File Europa-Tileset, kein Drittanbieter), aber:

- **Range-Request-Probleme**: Issue #584 protomaps/PMTiles dokumentiert
  intermittierende Failures auf GitHub Pages — Content-Length-Header inkonsistent,
  Chrome/Firefox-Diskrepanzen.
- **Filesize-Limit GitHub**: einzelne Datei <100 MB (Soft-Limit), Repo <5 GB.
  Europa-Vector-Tileset bei z11-z14 ist ~2-5 GB. Zu gross fuer Pages.
- **Alternative**: Cloudflare R2 Free Tier (10 GB Storage, 1M Class-A-Ops/Monat
  gratis) oder Backblaze B2. Beide unterstuetzen Range-Requests verlaesslich.

Empfehlung: Plan B, nicht Phase 1. **Erst wenn OpenFreeMap-Default unzureichend
ist** (Latenz, Coverage, Style-Anforderungen).

Quellen:

- [Simon Willison TIL — PMTiles](https://til.simonwillison.net/gis/pmtiles) — zugegriffen 2026-05-10
- [PMTiles Issue #584: GitHub Pages instability](https://github.com/protomaps/PMTiles/issues/584) — zugegriffen 2026-05-10
- [DEV.to — Hosting PMTiles on GitHub Pages](https://dev.to/ronitjadhav/how-to-host-and-test-pmtiles-on-github-pages-the-easiest-way-to-serve-maps-without-a-server-2ei8) — zugegriffen 2026-05-10

### 6. Common Pitfalls (Checkliste fuer MotoAtlas)

- [ ] **Mehrere `geojson`-Sources mit gleichen Daten** — pruefen ob Katalog +
      Route-Detail dieselben Features doppelt laden. Eine Source, mehrere Layer.
- [ ] **`data:` URL fuer GeoJSON-Source** statt URL — verhindert Caching,
      laedt bei jeder Map-Erstellung neu. Lieber `data: '/catalog-geometry.geojson'`.
- [ ] **`fitBounds` mit `animate: true` bei Initial-Load** — schiebt
      Tile-Requests waehrend Animation. Initial besser `animate: false` oder
      `center`/`zoom` direkt setzen.
- [ ] **Map in jedem Hash-Route-Wechsel neu erstellen** — `destroyMap` +
      `initMap` jedes Mal vernichtet Tile-Cache. Map persistieren und nur
      `setStyle`/`fitBounds` aufrufen wenn moeglich.
- [ ] **`raster-resampling: 'linear'`** auf Raster-Layern statt Default
      `'nearest'` — schoenere Skalierung, minimaler Overhead.
- [ ] **RTL-Plugin nur bei Bedarf**: `setRTLTextPlugin` laedt extra Asset
      — fuer DE/BE/NL/FR/IT nicht noetig. Bei Default-OFM-Style ggf. trotzdem
      ungewollt geladen, pruefen.
- [ ] **Glyphs/Sprites von eigenem Host**: Wenn Style-URL extern, aber
      Glyphs lokal patchen — vermeidet Latenz auf Schriftladung.

Quelle:

- [MapLibre Examples — Overview](https://maplibre.org/maplibre-gl-js/docs/examples/) — zugegriffen 2026-05-10

### 7. Messung — woran Erfolg ablesen

Vor Aenderung baseline mit Chrome DevTools → Network → Filter "Img" und
"Fetch/XHR" auf `tiles.openstreetmap.org` o.ae.:

- Anzahl Requests pro Map-Open (Ziel: <30)
- Total Bytes pro Map-Open (Ziel: <1 MB)
- LCP-aequivalent: Zeit bis erstes Tile sichtbar (Ziel: <500ms bei Cache, <1.5s cold)
- Wiederholte Map-Opens: 0 neue Requests dank `force-cache`

Tools:

- Chrome DevTools "Performance Insights" → Network-Track
- Lighthouse Mobile-Throttling — gute Approximation fuer schlechtes Mobilfunk

## Migrationspfad fuer MotoAtlas

1. **`src/tiles.js`**: OpenFreeMap-Style als Default einbauen, MapTiler als
   Opt-In via `VITE_MAPTILER_KEY`, OSM-Raster als Last-Resort.
2. **`src/map-view.js`** (oder Aequivalent): `fadeDuration: 0`, `maxZoom: 14`,
   `minZoom: 4`, `refreshExpiredTiles: false`, `transformRequest` mit
   `force-cache` fuer Tiles.
3. **GeoJSON-Source**: `maxzoom: 12`, `tolerance: 0.5`.
4. **ADR**: `docs/adr/000X-tile-provider.md` mit Wahl OpenFreeMap + Begruendung.
5. **README**: MapTiler-Hinweis von "optional fuer bessere Karten" auf
   "optional fuer alternativen Style" umtexten — OpenFreeMap ist bereits gut.

## Out of Scope

- Selbstgehostetes Protomaps/PMTiles (Phase 2 wenn relevant)
- Service-Worker mit Tile-Pre-Cache (Phase 2)
- 3D-Terrain / Hillshade (separate Recherche)
