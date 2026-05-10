---
title: Vite + Svelte Stack fuer MotoAtlas — Migrations-Recherche
date: 2026-05-10
status: current
owner: lars
---

# Vite + Svelte Stack fuer MotoAtlas

Recherche-Stand: Mai 2026. Kontext: MotoAtlas migriert von CDN-React + `@babel/standalone`
(~1 MB Babel-Overhead, runtime-JSX-Transform) auf einen kompilierten Stack. Ziel ist
ein statisches SPA, das auf GitHub Pages liegt, MapLibre GL einbindet und einen
`catalog.json` mit GPX-Routen rendert.

## Executive Summary — 3 Empfehlungen

1. **Vite + `@sveltejs/vite-plugin-svelte` (vanilla, kein SvelteKit).** Pure-SPA ohne
   Routing-Bedarf jenseits eines Hash-Routers, kein SSR, kein Filesystem-Routing —
   die SvelteKit-Maschinerie (Adapter, `+page.svelte`, `$app/paths`, base-Path-Gotchas)
   kostet mehr Komplexitaet als sie bringt. Bei 3 JSX-Files ist Vanilla-Vite die
   richtige Stufe. **Falls** Multi-Route (z.B. `/route/:id`-Permalinks) doch noetig
   wird, SvelteKit mit `adapter-static` und `fallback: '404.html'` — Migration ist
   inkrementell moeglich.

2. **Svelte 5 mit Runes von Anfang an.** Stabil seit Okt 2024, Legacy-Mode bleibt
   parallel benutzbar. Fuer reaktiven Filter-/Map-Highlight-State sind `$state` und
   `$derived` praeziser als React-Hooks und reduzieren Re-Render-Falle (kein
   `useMemo`-Boilerplate). Migration-Aufwand entfaellt — wir starten greenfield.

3. **`svelte-maplibre-gl` (MIERUNE, Svelte 5 native) als Wrapper, mit Escape-Hatch
   auf rohes `onMount`.** Deklarative Map-Komponenten + Sources/Layers, aber jederzeit
   Zugriff auf die rohe `Map`-Instanz fuer Sonderfaelle (Pulsier-Pin via
   `addLayer({type:'circle',paint:{...}})`). Alternative `dimfeld/svelte-maplibre`
   ist Svelte 4 und nicht mehr First Choice in 2026.

---

## 1. Vite + Svelte vs SvelteKit

| Kriterium                     | Vanilla Vite + Svelte                               | SvelteKit + adapter-static                         |
| ----------------------------- | --------------------------------------------------- | -------------------------------------------------- |
| Setup-Komplexitaet            | minimal (`vite.config.js`, `App.svelte`, `main.js`) | Filesystem-Routing, `+layout`, `+page`, `app.html` |
| Build-Output                  | reines SPA, ein `index.html`                        | konfigurierbar SSG/SPA, mit `fallback` SPA-Mode    |
| Routing                       | Hash-Router selbst (oder `svelte-spa-router`)       | eingebaut, file-based                              |
| GitHub Pages                  | trivial — `base: '/repo/'` in `vite.config.js`      | `paths.base` + `$app/paths`-Imports ueberall       |
| Asset-Pipeline (catalog.json) | `import.meta.glob` oder `/public/` direkt           | dito, plus `$lib/` Alias                           |
| Wenn lohnt?                   | SPAs mit <5 Routen, kein SEO-Bedarf, kein Datalayer | Multi-Route, SEO, server endpoints, kuenftiges SSR |

**Quintessenz fuer MotoAtlas:** Vanilla. Die App ist `#/` (Katalog) + `#/map` —
zwei Views, ein Container. SvelteKit waere overkill und bringt base-Path-Stolperdrahte
(GitHub Issue [#9341](https://github.com/sveltejs/kit/issues/9341): falsche
prepended `.` in Imports bei `base`-Konfig), die wir nicht brauchen.

Wenn spaeter Permalinks `/route/de-eifel-volcanic` gewuenscht sind: Migration auf
SvelteKit ist machbar, weil die Svelte-Komponenten 1:1 wiederverwendbar sind. Heute
zu frueh.

### Empfohlene Minimal-Struktur

```
index.html
src/
  main.js          # mount App
  App.svelte       # Hash-Router-Switch
  lib/
    catalog.js     # loadCatalog, filter-state ($state)
    Sidebar.svelte
    RouteDetailPane.svelte
    MapView.svelte # MapLibre init in onMount
    tiles.js
public/
  catalog.json     # CI-generiert
  .nojekyll
vite.config.js     # base: '/gpx/'
```

---

## 2. Svelte 5 Runes — Status & Mapping zu MotoAtlas-State

Stable seit Okt 2024 ([svelte.dev/blog/svelte-5-is-alive](https://svelte.dev/blog/svelte-5-is-alive)).
In 2026 Default fuer Neuprojekte. Legacy `$:`-Syntax laeuft weiter, ist aber im
Code-Base-Kontext nicht mehr empfohlen.

### Runes-Cheatsheet fuer MotoAtlas

```svelte
<script>
  // Filter-State (frueher React useState)
  let country = $state('all');
  let type    = $state('all');
  let query   = $state('');

  // Abgeleitete Liste (frueher useMemo)
  let filtered = $derived(
    catalog.filter(r =>
      (country === 'all' || r.country === country) &&
      (type    === 'all' || r.type    === type) &&
      r.name.toLowerCase().includes(query.toLowerCase())
    )
  );

  // Side-Effect: Karte highlighten wenn Selection wechselt
  let selectedId = $state(null);
  $effect(() => {
    if (map && selectedId) highlightRoute(map, selectedId);
  });
</script>
```

**Vorteil gegenueber React-Hooks:** Keine Dependency-Array-Pflicht, kein
`useCallback`-Tax, kein Re-Render bei Eltern-Render. Reaktivitaet ist
fine-grained — nur Knoten, die `filtered` lesen, werden geupdated.

`$state` ist ueber Module-Grenzen hinweg teilbar, wenn die Datei `.svelte.js`
oder `.svelte.ts` heisst — d.h. ein zentraler Filter-Store ist ein Plain-JS-Modul,
kein eigenes Store-API mehr (Svelte 4 `writable()` ist obsolet).

Quelle: [Svelte 5 Runes Guide](https://www.pkgpulse.com/guides/svelte-5-runes-complete-guide-2026),
[Migration Guide](https://svelte.dev/docs/svelte/v5-migration-guide).

---

## 3. MapLibre GL in Svelte

**Zwei Optionen:**

### A) `svelte-maplibre-gl` (MIERUNE) — empfohlen

Svelte-5-nativ, in 2025/26 die De-facto-Wrapper. Repo:
[github.com/MIERUNE/svelte-maplibre-gl](https://github.com/MIERUNE/svelte-maplibre-gl),
Docs: [svelte-maplibre-gl.mierune.dev](https://svelte-maplibre-gl.mierune.dev/).

```svelte
<script>
  import { MapLibre, GeoJSONSource, LineLayer, CircleLayer } from 'svelte-maplibre-gl';
  let { geojson, selectedId = $bindable() } = $props();
</script>

<MapLibre style={baseStyle} center={[10.5, 51]} zoom={5} class="h-full">
  <GeoJSONSource id="routes" data={geojson}>
    <LineLayer paint={{ 'line-color': '#0090a7', 'line-width': 3 }} />
    <CircleLayer
      filter={['==', ['get', 'id'], selectedId]}
      paint={{ 'circle-radius': 10, 'circle-color': '#ff6b35' }}
    />
  </GeoJSONSource>
</MapLibre>
```

Map-Instanz bleibt via `bind:map={mapInstance}` erreichbar fuer Custom-Logik
(Pulsier-Pin-Animation via `setPaintProperty` im `setInterval`).

### B) Rohes `onMount` ohne Wrapper

Wenn der Wrapper zu viel Abstraktion ist oder eine Funktion fehlt (selten in 2026):

```svelte
<script>
  import { onMount, onDestroy } from 'svelte';
  import maplibregl from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';

  let container;
  let map;

  onMount(() => {
    map = new maplibregl.Map({
      container, style: baseStyle, center: [10.5, 51], zoom: 5
    });
    map.on('load', () => { /* addSource, addLayer */ });
  });

  onDestroy(() => map?.remove());
</script>

<div bind:this={container} class="map-container"></div>
```

Pattern siehe [MapTiler Svelte Guide](https://docs.maptiler.com/svelte/maplibre-gl-js/how-to-use-maplibre-gl-js/)
und [dev.to/mug-jp Tutorial](https://dev.to/mug-jp/building-a-map-application-with-maplibre-gl-js-and-svelte-pg6).

**Empfehlung MotoAtlas:** Wrapper fuer Sources/Layers, `bind:map` plus `$effect`
fuer den Pulsier-Pin (Imperative Animation passt nicht in deklarative Layer).

---

## 4. Build/Deploy fuer GitHub Pages

### `vite.config.js`

```js
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte()],
  base: "/gpx/", // = Repo-Name, sonst 404 auf Assets
  build: { outDir: "dist", sourcemap: true },
});
```

### SPA-Fallback (Hash-Router macht das unnoetig)

Bei Hash-Router (`#/map`) braucht es **keinen** 404-Trick — GitHub Pages liefert
`index.html`, der Hash wird vom Client geparst. Falls History-Router gewuenscht:
`dist/404.html` als Kopie von `index.html` ablegen, plus `.nojekyll` in
`public/` (sonst frisst Jekyll unsere `_`-Praefixe).

### Assets

- `public/catalog.json` — wird 1:1 ins `dist/` kopiert, fetchbar als
  `${import.meta.env.BASE_URL}catalog.json`.
- `import.meta.glob('./routes/*.json', { eager: true })` — falls Routen
  einzeln am Build geladen werden sollen (statt einem Aggregat). Static-Pattern
  Pflicht, keine Variablen ([Vite Docs](https://vite.dev/guide/features)).
- MapTiler-Key: `VITE_MAPTILER_KEY` in `.env.local` (dev) und als GitHub-Actions-Secret
  fuer den Build. Zugriff im Code: `import.meta.env.VITE_MAPTILER_KEY`. Nur
  `VITE_`-Prefix wird ans Client-Bundle exposed.

### GitHub-Actions-Workflow (Skizze)

```yaml
- run: pnpm install --frozen-lockfile
- run: python scripts/build_catalog.py # catalog.json bauen
- run: pnpm build
  env:
    VITE_MAPTILER_KEY: ${{ secrets.MAPTILER_KEY }}
- uses: actions/upload-pages-artifact@v3
  with: { path: dist }
```

---

## 5. Tests — 2026-Standard

Zwei-Schichten-Modell ist Konsensus ([Svelte Docs Testing](https://svelte.dev/docs/svelte/testing)):

| Schicht      | Tool                                              | Wofuer                                                      |
| ------------ | ------------------------------------------------- | ----------------------------------------------------------- |
| Unit / Logik | **Vitest** (jsdom oder browser-mode)              | Pure-JS-Module: `filter.js`, `transformRoute`, Hash-Router  |
| Component    | **Vitest Browser Mode + `vitest-browser-svelte`** | Komponenten gegen echtes Playwright-Chromium statt jsdom    |
| E2E          | **Playwright**                                    | User-Flow: Filter setzen → Pin klicken → DetailPane oeffnet |

Vitest-Browser-Mode (seit Vitest 2.x stabil) ersetzt zunehmend
`@testing-library/svelte` + jsdom. Vorteil: echte Layout-Engine, IntersectionObserver,
Canvas — relevant fuer MapLibre-Komponenten.

**Beispiel Component-Test:**

```js
// Sidebar.svelte.test.js
import { render } from "vitest-browser-svelte";
import { expect, test } from "vitest";
import Sidebar from "./Sidebar.svelte";

test("filter-input updates list", async () => {
  const { getByPlaceholder, getByText } = render(Sidebar, {
    props: { routes: [{ id: "de-eifel", name: "Eifel Loop" }] },
  });
  await getByPlaceholder("Suchen").fill("Eifel");
  await expect.element(getByText("Eifel Loop")).toBeVisible();
});
```

Quellen: [Scott Spence — Vitest Browser Svelte](https://scottspence.com/posts/testing-with-vitest-browser-svelte-guide),
[dev.to/lioloc — Svelte5 + Vitest + Playwright](https://dev.to/lioloc/testing-svelte5-with-vitest-and-playwright-for-non-svelte-kit-projects-gnb).

E2E mit Playwright separat: `pnpm exec playwright test`, gegen `pnpm preview`-Build.

---

## 6. Performance-Vergleich

| Metrik                             | React 19 (heutige CDN-Variante + Babel)                        | Svelte 5 + Vite                   |
| ---------------------------------- | -------------------------------------------------------------- | --------------------------------- |
| Hello-World gzipped                | ~42 KB (React + ReactDOM)                                      | ~3-5 KB                           |
| Mittlere App (Forms+Routing+State) | ~156 KB                                                        | ~47 KB (Faktor 3.3x)              |
| TTI mobil                          | Baseline                                                       | 30-40% schneller                  |
| MotoAtlas heute                    | **~1 MB Babel-Standalone** + React-CDN + JSX-Runtime-Transform | wegfaellt komplett (Compile-time) |
| MapLibre (gleich in beiden)        | ~250 KB gzipped                                                | ~250 KB gzipped                   |

Quellen: [tech-insider.org — Svelte vs React 2026 Bundle Gap](https://tech-insider.org/svelte-vs-react-2026-2/),
[stacksfinder — BundlePhobia Svelte](https://stacksfinder.com/guides/bundlephobia-svelte-comparison).

**Realer Gewinn fuer MotoAtlas:** Die ~1 MB Babel-Standalone-Last verschwindet
voellig — JSX-Transform passiert beim `pnpm build`. Erwarteter Gesamt-Bundle nach
Migration: **~280-320 KB gzipped** (MapLibre dominiert), heute geschaetzt ~1.3 MB
inklusive Babel.

Dokumentierter Migrationsbericht React → Svelte 5:
[SvelteJobs — Incremental Migration Guide](https://sveltejobs.com/blog/incremental-migration-of-a-production-react-app-to-svelte-5).

---

## 7. Gotchas

- **Vite-Glob-Imports brauchen Literal-Pfade.** Variablen sind verboten;
  `import.meta.glob('./routes/' + country + '/*.json')` schlaegt fehl. Workaround:
  Eager-Glob auf alle Routen, dann clientseitig filtern.
- **`base: '/gpx/'` und absolute Pfade.** `<img src="/logo.png">` ignoriert `base`.
  IMMER `${import.meta.env.BASE_URL}logo.png` oder `import logo from './logo.png'`.
- **MapLibre CSS NICHT vergessen:** `import 'maplibre-gl/dist/maplibre-gl.css'` in
  `main.js` oder der MapView-Komponente — sonst sind Controls unsichtbar.
- **`onMount` laeuft nicht beim SSR.** Bei Vanilla-Vite-SPA irrelevant; bei
  SvelteKit `adapter-static` muss `export const ssr = false` in `+layout.js`,
  sonst crasht MapLibre (greift auf `window` zu).
- **Svelte 5 Runes nur in `.svelte` und `.svelte.js/.ts`.** `let count = $state(0)` in
  einer normalen `.js` ist Syntax-Error — Datei umbenennen.
- **HMR + MapLibre:** Hot-Reload kann Map-Instanzen leaken. In `onDestroy`
  zwingend `map.remove()` aufrufen, sonst akkumulieren `<canvas>`-Elemente bei
  jedem Save.
- **Pnpm + Vite-Plugin-Svelte Peer-Deps:** Mit `pnpm` manchmal
  `unmet peer svelte@^5`. Fix: `"svelte": "^5"` als devDependency explizit setzen.
- **GitHub Pages Jekyll:** `.nojekyll` muss im `public/`-Ordner liegen (kopiert in
  `dist/`), sonst werden Dateien mit `_`-Prefix gefiltert.
- **`enhanced:img` und MapLibre-Tile-URLs:** Tile-URLs nicht durch Vite-Asset-Pipeline
  jagen — sind Runtime-URLs, keine Build-Assets.

---

## Quellen (Zugriff alle 2026-05-10)

- [Static site generation • SvelteKit Docs](https://svelte.dev/docs/kit/adapter-static)
- [Svelte 5 Migration Guide](https://svelte.dev/docs/svelte/v5-migration-guide)
- [Svelte 5 is alive (Blog)](https://svelte.dev/blog/svelte-5-is-alive)
- [Introducing Runes](https://svelte.dev/blog/runes)
- [SvelteKit Project Types](https://svelte.dev/docs/kit/project-types)
- [MIERUNE/svelte-maplibre-gl](https://github.com/MIERUNE/svelte-maplibre-gl)
- [dimfeld/svelte-maplibre (Svelte 4, Legacy)](https://github.com/dimfeld/svelte-maplibre)
- [MapTiler — MapLibre GL JS in Svelte](https://docs.maptiler.com/svelte/maplibre-gl-js/how-to-use-maplibre-gl-js/)
- [dev.to/mug-jp — MapLibre + Svelte Tutorial](https://dev.to/mug-jp/building-a-map-application-with-maplibre-gl-js-and-svelte-pg6)
- [Vite Features (incl. import.meta.glob)](https://vite.dev/guide/features)
- [florinasutanto.com — Deploy SvelteKit to GH Pages](https://florinasutanto.com/blog/2026/deploy-sveltekit-to-gh-pages)
- [metonym/sveltekit-gh-pages (Minimal Setup)](https://github.com/metonym/sveltekit-gh-pages)
- [Svelte Testing Docs](https://svelte.dev/docs/svelte/testing)
- [Scott Spence — Vitest Browser Svelte Guide](https://scottspence.com/posts/testing-with-vitest-browser-svelte-guide)
- [dev.to/lioloc — Svelte 5 + Vitest + Playwright](https://dev.to/lioloc/testing-svelte5-with-vitest-and-playwright-for-non-svelte-kit-projects-gnb)
- [tech-insider.org — Svelte vs React 2026 Bundle Gap](https://tech-insider.org/svelte-vs-react-2026-2/)
- [stacksfinder — BundlePhobia Svelte](https://stacksfinder.com/guides/bundlephobia-svelte-comparison)
- [SvelteJobs — Incremental React → Svelte 5 Migration](https://sveltejobs.com/blog/incremental-migration-of-a-production-react-app-to-svelte-5)
- [PkgPulse — Svelte 5 Runes Complete Guide 2026](https://www.pkgpulse.com/guides/svelte-5-runes-complete-guide-2026)
- [Naturaily — Svelte 5 & SvelteKit 2026 Guide](https://naturaily.com/blog/why-svelte-is-next-big-thing-javascript-development)
