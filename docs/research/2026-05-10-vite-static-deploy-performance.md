---
title: Vite Build + GitHub Pages Deploy + Frontend-Performance fuer MotoAtlas
date: 2026-05-10
status: current
owner: lars.buettgen@inform-software.com
---

# Vite + GitHub Pages + Performance — Best Practices fuer Karten-Apps (2026)

Stand-2025/2026-Recherche fuer MotoAtlas. Kontext: Vite + Vanilla JS (kein React),
MapLibre GL, deployed via GitHub Actions auf `gh-pages`-Branch. Ziel: schneller
Initial-Load (Katalog-Seite ohne Map), schlanke Map-Route, sinnvolles Caching
trotz GitHub-Pages-Limitierungen.

## Kernerkenntnisse (TL;DR)

1. **MapLibre lazy laden** ist Pflicht — Bundle ist ~200 KB gzipped, gehoert
   NICHT in den Initial-Bundle der Katalog-Route. Dynamic `import()` in der
   Hash-Router-Route fuer `#/map`. Vite splittet automatisch eigenen Chunk.
2. **GitHub Pages liefert gzip on-the-fly**, aber **kein Brotli** und **keine
   custom Cache-Control-Header**. Brotli-Vorkompression `.br` wird nicht
   ausgeliefert. Wer Brotli/Cache-Control will: Cloudflare davorhaengen oder
   Cloudflare/GitLab Pages nutzen.
3. **Hash-Router bleibt der pragmatische Default** auf GitHub Pages — kein
   404.html-Hack noetig, kein SEO-Penalty fuer eine reine App. MotoAtlas
   nutzt bereits Hash-Router → beibehalten.
4. **Service Worker via vite-plugin-pwa** ist der einzige realistische Hebel
   fuer Cache-Control auf gh-pages: precache fuer App-Shell + runtimeCaching
   `CacheFirst` fuer Tiles und `StaleWhileRevalidate` fuer `catalog.json`.
5. **catalog.json bei >1 MB**: Geometrie auslagern (separate JSON pro Route,
   on-demand laden) ist effektiver als NDJSON oder Streaming. Vorkompression
   `.json.gz` bringt auf GitHub Pages nichts — wird transparent gzipped.
6. **Preconnect zu Tile-Server** (MapTiler) im `<head>` reduziert LCP auf
   Map-Route messbar (TLS-Handshake parallel zum JS-Parse).

---

## 1. Vite Bundle-Splitting fuer MapLibre

### Empfohlene Strategie: Dynamic Import (kein manualChunks)

MapLibre gehoert ausschliesslich in `src/map-view.js`. Vite/Rollup splittet
automatisch einen eigenen Chunk, wenn der Import dynamisch ist:

```js
// src/main.js (Hash-Router)
async function route() {
  if (location.hash.startsWith("#/map")) {
    const { initMap } = await import("./map-view.js"); // MapLibre erst hier laden
    initMap();
  } else {
    const { initCatalog } = await import("./catalog.js");
    initCatalog();
  }
}
```

Effekt: Katalog-Route laedt ~30 KB JS, Map-Route ~230 KB JS. Ohne dynamic
import landet alles in einem Chunk.

### Wann `manualChunks` sinnvoll ist

Nur wenn mehrere Routen MapLibre teilen UND der gemeinsame Code stabil ist
(gut fuer langfristiges Browser-Caching). MotoAtlas hat aktuell **eine** Map-
Route — manualChunks waere Overengineering.

Wenn doch noetig (Beispiel-Pattern, nicht implementieren bis Bedarf da ist):

```js
// vite.config.js
build: {
  rollupOptions: {
    output: {
      manualChunks(id) {
        if (id.includes('maplibre-gl')) return 'maplibre';
      }
    }
  }
}
```

### Warning: chunkSizeWarningLimit

MapLibre triggert Vites 500-KB-Warning. Anpassen NICHT durch Hochsetzen
des Limits, sondern durch lazy-load — sonst maskiert man echtes Bundle-Bloat.

### CDN-Externalisierung (nicht empfohlen)

MapLibre koennte als external Dependency aus `unpkg`/`jsdelivr` geladen werden
(Bundle von ~1 MB auf ~60 KB laut Sambit Sahoo). **Nicht empfohlen** fuer
MotoAtlas: zusaetzliche DNS-Lookup-Kosten, kein Subresource Integrity in
GitHub-Actions-Workflow gepflegt, Versions-Drift-Risiko. Lazy import aus dem
eigenen Bundle ist die saubere Loesung.

---

## 2. catalog.json — Groesse und Strategie

### Schwellwerte

| catalog.json  | Aktion                                                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| <500 KB roh   | Nichts tun. GitHub Pages gzipt auf ~100 KB.                                                                                                       |
| 500 KB - 2 MB | Geometrie ausduennen (max 500 Punkte/Route, ist bereits implementiert). `StaleWhileRevalidate` via Service Worker.                                |
| >2 MB         | **Geometrie aus catalog.json entfernen**, pro Route in `geometry/{id}.json` auslagern, on-demand laden beim Klick auf Route-Card oder Map-Marker. |

### NDJSON / Streaming-JSON?

**Nicht relevant fuer MotoAtlas.** NDJSON lohnt sich erst bei zehntausenden
Records, die incremental gerendert werden. Bei einigen hundert Routen mit
einfachem Filter ist klassisches `fetch().then(r => r.json())` schneller
(parser-optimiert, JSON.parse ist hochoptimiert). Streaming-JSON-Parser
(z.B. `oboe.js`, `clarinet`) addieren Komplexitaet ohne Gewinn auf dieser
Skala.

### gzip/brotli auf GitHub Pages

- **gzip**: GitHub Pages komprimiert HTML/JS/CSS/JSON on-the-fly. Keine
  Aktion noetig.
- **brotli**: Wird NICHT von GitHub Pages ausgeliefert. `.br`-Dateien im
  Repo bringen nichts.
- **Vorkomprimierte `.gz`-Dateien**: Werden ebenfalls nicht serviert wie
  bei nginx `gzip_static`. GitHub macht das transparent live.

Konsequenz: vite-plugin-compression im Build ist auf gh-pages reine
Repo-Bloat. Skip.

### Wenn Brotli/CDN-Caching kritisch wird

Optionen (von least- zu most-effort):

1. **Cloudflare vor GitHub Pages** (kostenlos, ~15 min Setup): Brotli +
   custom Cache-Control + CDN-Edge.
2. **Cloudflare Pages** statt GitHub Pages: native Brotli, custom Headers
   via `_headers`-Datei.
3. **GitLab Pages**: serviert vorkomprimierte `.br` direkt.

Aktuell fuer MotoAtlas nicht erforderlich.

---

## 3. Asset-Caching auf GitHub Pages

### Was geht NICHT

- `_headers`-Datei (Netlify-Feature, von GitHub Pages ignoriert)
- `.htaccess`
- Custom Cache-Control-Header
- Brotli-Auslieferung

### Was geht

GitHub Pages setzt standardmaessig `Cache-Control: max-age=600` (10 Minuten)
fuer alle Assets. Das ist fuer hash-versionierte Vite-Assets (`main-abc123.js`)
suboptimal — sie koennten ein Jahr cachen. Aber: nicht aenderbar ausser
mit CDN davor.

### Service Worker als Header-Ersatz

Der einzige praktikable Weg, langes Caching auf gh-pages zu erzwingen, ist
ein Service Worker, der hash-versionierte Assets aus dem Cache serviert.

**Empfehlung fuer MotoAtlas**: `vite-plugin-pwa` mit `generateSW`-Modus.

```js
// vite.config.js
import { VitePWA } from "vite-plugin-pwa";

export default {
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /\/catalog\.json$/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "catalog",
              expiration: { maxAgeSeconds: 86400 },
            },
          },
          {
            urlPattern: /^https:\/\/api\.maptiler\.com\/.*\.(png|jpg|webp|pbf)/,
            handler: "CacheFirst",
            options: {
              cacheName: "tiles",
              expiration: { maxEntries: 500, maxAgeSeconds: 604800 }, // 7 Tage
            },
          },
        ],
      },
    }),
  ],
};
```

Effekt:

- App-Shell offline verfuegbar nach Erstbesuch.
- Tiles werden lokal gecached → wiederholte Besuche derselben Region
  sind instant.
- `catalog.json` zeigt sofort alte Version, fetcht im Hintergrund neue.

**Caveat**: SW-Updates muessen bei Deploys triggern. `registerType: 'autoUpdate'`
laedt neue SW-Version beim naechsten Pageload, aktiviert sie nach Tab-Schluss.
Fuer aggressivere Updates (sofortiges Reload bei neuer Version) `prompt`-Mode +
UI-Banner.

---

## 4. Hash-Router vs History API

### Status Quo: Hash-Router ist korrekte Wahl

MotoAtlas nutzt `#/` und `#/map` — kein Roundtrip zum Server, kein 404-Problem.
Beibehalten.

### Wann History API erwaegen?

Nur fuer SEO-relevante Multi-Page-Strukturen mit eigenen Meta-Tags pro Route
(z.B. `/route/eifel-volcanic-route` mit eigenem OG-Image). MotoAtlas hat aktuell
nicht diese Anforderung.

### 404.html-Trick (falls jemals noetig)

Pattern aus `rafgraph/spa-github-pages`:

1. `404.html` enthaelt Script, das Pfad in Query-String umwandelt und nach
   `/?/path&query` redirected.
2. `index.html` enthaelt Spiegel-Script, das Query zurueck in History-State
   umwandelt.

Kosten: Initial-Load zeigt kurz 404 (manche Browser bannern das), SEO sieht
404-Status-Code. **Nicht empfohlen** fuer MotoAtlas — Hash-Router ist sauberer.

---

## 5. Performance / Lighthouse fuer Karten-Sites

### LCP-Treiber bei Karten-Apps

LCP wiegt 25% des Lighthouse-Scores. Bei Karten-Apps ist der LCP-Kandidat
meist **nicht** die Map-Canvas (rendert oft nach LCP-Cutoff), sondern:

- Hero-Headline / Filter-Leiste (auf Katalog-Route)
- Map-Canvas-Container (Background-Color, vor Tile-Load)

Strategie:

1. Map-Container hat `background: #e0e0e0` oder Pergament-Color → wird als
   LCP-Element registriert, sobald CSS geladen ist.
2. Tiles laden danach, beeinflussen LCP nicht.

### Preconnect / dns-prefetch fuer Tile-Server

Im `<head>` von `index.html`:

```html
<link rel="preconnect" href="https://api.maptiler.com" crossorigin />
<link rel="dns-prefetch" href="https://api.maptiler.com" />
```

Effekt: TLS-Handshake zum Tile-Server beginnt parallel zum JS-Parse. Spart
auf 4G ~150-300ms bei erstem Tile-Request.

**Wichtig**: NUR fuer die wirklich genutzten Origins. Zu viele Preconnects
verschwenden Bandbreite (Lighthouse warnt bei >4).

### Render-Blocking minimieren

- `src/style.css` ist klein (~10 KB) → inline lassen via Vite ist NICHT
  noetig. CSS sollte parallel zum HTML geparst werden, Vite emittet
  bereits `<link rel="stylesheet">` mit `media="all"`.
- Fonts (Fraunces, JetBrains Mono): `<link rel="preload" as="font" crossorigin>`
  fuer das LCP-relevante Font-File (Subset). `font-display: swap` in
  `@font-face`.

### Image-Optimierung (falls Thumbnails kommen)

Wenn Route-Cards spaeter Vorschau-Bilder bekommen:

- WebP / AVIF statt JPG (Vite-Plugin `vite-imagetools` oder Build-Step mit
  `sharp`).
- `loading="lazy"` ab dem zweiten viewport-Down-Bild.
- `srcset` + `sizes` fuer Retina-Display-Variante.
- Dimensions immer setzen (`width`/`height`) → kein CLS.

Aktuell hat MotoAtlas keine Thumbnails — siehe ADR/Backlog wenn Plan 4 das
einfuehrt.

### Vite-spezifische Hebel

- `build.target: 'es2022'` — moderne Browser, kleinere Polyfills (Default
  ist `'modules'` ≈ ES2020).
- `build.cssCodeSplit: true` (Default) — pro Chunk eigenes CSS.
- `build.sourcemap: false` in Production — sourcemaps nicht ausliefern
  (Default false fuer Production).
- `build.assetsInlineLimit: 4096` — kleine Assets als Data-URLs inlinen.

---

## 6. Konkrete Action-Items fuer MotoAtlas

| #   | Aktion                                                                                         | Aufwand      | Impact                            |
| --- | ---------------------------------------------------------------------------------------------- | ------------ | --------------------------------- |
| 1   | Dynamic `import('./map-view.js')` im Hash-Router pruefen / sicherstellen                       | 10 min       | Hoch — halbiert Initial-Bundle    |
| 2   | `<link rel="preconnect" href="https://api.maptiler.com" crossorigin>` in `index.html` `<head>` | 2 min        | Mittel — ~200ms LCP auf Map-Route |
| 3   | Map-Container CSS `background: #f3ece0` (Pergament)                                            | 2 min        | Mittel — stabiler LCP-Kandidat    |
| 4   | Lighthouse Baseline auf Live-Site messen                                                       | 15 min       | Voraussetzung fuer ROI-Messung    |
| 5   | `vite-plugin-pwa` installieren, App-Shell + Tile-Cache (CacheFirst) + catalog (SWR)            | 1-2 h        | Hoch fuer Repeat-Visits           |
| 6   | `build.target: 'es2022'` in `vite.config.js`                                                   | 5 min        | Klein — minus ~5 KB Polyfills     |
| 7   | catalog.json-Groesse messen; bei >2 MB Geometrie auslagern                                     | 30 min Audit | Bei Bedarf hoch                   |
| 8   | Cloudflare vor gh-pages? — nur wenn Brotli oder Header-Kontrolle wichtig                       | 30 min       | Niedrig fuer aktuellen Stand      |

Reihenfolge: 1 → 2 → 3 → 4 → 6 (Quick Wins, <30 min total). Danach 5 (PWA)
und 7 (Catalog-Split) basierend auf gemessenen Werten.

---

## 7. Anti-Patterns / Gotchas

- **`vite-plugin-compression` fuer gh-pages**: nutzlos — gh-pages serviert
  `.gz`-Dateien nicht direkt, nur Live-gzip.
- **Preload aller Routen-Chunks**: zerstoert Lazy-Load-Effekt. Vite macht
  modulepreload nur fuer den initialen Chunk-Graph.
- **Service Worker ohne Versionierung**: alter SW kann neue Assets blockieren.
  `registerType: 'autoUpdate'` + Workbox `skipWaiting` ueberlegen, sonst
  Stale-Forever-Problem.
- **MapTiler-Key im Bundle**: VITE\_-Variablen sind PUBLIC. Domain-Restriction
  im MapTiler-Dashboard ist Pflicht (sonst quota-Diebstahl).
- **MapLibre GL JS unter Strict CSP**: braucht `worker-src blob:` oder
  `worker-src 'self'`. GitHub Pages setzt keine CSP, aber bei Cloudflare-
  Wrapper relevant.
- **Cache-Control fuer hash-versionierte Assets**: GitHub Pages 10min default
  ist suboptimal aber nicht aenderbar ohne CDN. Service Worker umgeht das.

---

## Quellen

Alle zugegriffen 2026-05-10.

- [Vite manual chunks for dependency caching — soledadpenades.com](https://soledadpenades.com/posts/2025/use-manual-chunks-with-vite-to-facilitate-dependency-caching/)
- [Taming Large Chunks in Vite — mykolaaleksandrov.dev (2025)](https://www.mykolaaleksandrov.dev/posts/2025/11/taming-large-chunks-vite-react/)
- [Vite Code Splitting that works — sambitsahoo.com](https://www.sambitsahoo.com/blog/vite-code-splitting-that-works.html)
- [MapLibre GL — Optimising Performance for Large GeoJSON](https://maplibre.org/maplibre-gl-js/docs/guides/large-data/)
- [maplibre-gl Bundlephobia](https://bundlephobia.com/package/maplibre-gl)
- [GitHub Pages — no custom headers (community discussion #11884)](https://github.com/orgs/community/discussions/11884)
- [GitHub Pages — pre-compressed brotli not supported (#21655)](https://github.com/orgs/community/discussions/21655)
- [GitHub Pages — SPA routing not supported (#64096)](https://github.com/orgs/community/discussions/64096)
- [rafgraph/spa-github-pages — 404.html SPA trick](https://github.com/rafgraph/spa-github-pages)
- [Handling 404 in SPA on GitHub Pages — dev.to/lico](https://dev.to/lico/handling-404-error-in-spa-deployed-on-github-pages-246p)
- [vite-plugin-pwa — generateSW docs](https://vite-pwa-org.netlify.app/workbox/generate-sw)
- [vite-plugin-pwa — Service Worker precache guide](https://vite-pwa-org.netlify.app/guide/service-worker-precache)
- [Workbox runtimeCaching for offline PWAs (Vite + React)](https://adueck.github.io/blog/caching-everything-for-totally-offline-pwa-vite-react/)
- [Brotli vs Gzip for static sites — dev.to/lovestaco](https://dev.to/lovestaco/brotli-vs-gzip-for-web-performance-in-static-sites-2nhk)
- [NDJSON optimization techniques](https://ndjson.com/advanced/)
- [Lighthouse performance scoring — Chrome for Developers](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring)
- [LCP optimization guide — Unlighthouse](https://unlighthouse.dev/learn-lighthouse/lcp)
- [Web Performance Optimization 2025 — Medium / Abhinav Sharma](https://medium.com/@as.abhinav/web-performance-optimization-in-2025-beyond-lighthouse-scores-2a06ad226665)
