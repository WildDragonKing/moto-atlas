---
title: Map UX Best Practices für Routen-Sammlungen (MotoAtlas)
date: 2026-05-10
status: current
owner: lars.buettgen@inform-software.com
---

# Map UX Best Practices für Routen-Sammlungen / Track-Explorer

> Kontext: MotoAtlas — MapLibre GL, Vite, statisch deployed. Aktuell ~viele kuratierte GPX-Routen mit pulsierenden Pin-Markern, Sidebar mit Filter, Hash-Router (`#/`, `#/map`). Ziel: belastbare Patterns für die nächste Iteration, kein Re-Implementieren bekannter Fehler.

Stand: Mai 2026. Quellen unten mit Zugriffsdatum.

---

## 1. Marker-Clustering: Supercluster vs MapLibre Native

**Kernerkenntnis:** MapLibre Native Clustering _ist_ Supercluster — kein Entweder-Oder. `GeoJSONSource` mit `cluster: true` ruft Supercluster intern auf ([MapLibre Docs](https://maplibre.org/maplibre-gl-js/docs/examples/create-and-style-clusters/)). Direkter Supercluster-Einsatz lohnt nur, wenn man Cluster-Logik außerhalb der Map braucht (z.B. Liste in Sidebar synchron clustern) oder Custom-Hierarchien.

**Empfehlung MotoAtlas:**

- **Bis ~100 Routen:** Native Clustering reicht. `cluster: true`, `clusterRadius: 50`, `clusterMaxZoom: 11`. Standard-Layer (`circle` + `symbol`).
- **>100 Routen oder Geometrie-Vorschau im Cluster:** Externer Supercluster-Worker, damit Main-Thread frei bleibt für Hover-Sync.
- **Achtung Performance-Cliff:** `getLeaves()` ist O(n) und wird langsam bei großen Clustern (~40ms bei kleinen Sets, eskaliert). Für "Welche Routen sind in diesem Cluster?" lieber `clusterProperties` mit aggregierten Counts pro Typ/Land statt Leaves-Walk ([MapLibre Discussion #2160](https://github.com/maplibre/maplibre-gl-js/discussions/2160)).
- **Großer Performance-Vergleich:** Ab 50k Points fällt MapLibre gegen Mapbox GL/OpenLayers zurück ([MDPI Vector Data Rendering 2025](https://www.mdpi.com/2220-9964/14/9/336)). Bei MotoAtlas-Größenordnung irrelevant.

**Pin-Anker:** Cluster-Marker am Geometrie-**Mittelpunkt** der Route, nicht am Startpunkt. Sonst clustern sich Routen mit gemeinsamem Trailhead, obwohl sie geografisch weit auseinander gehen.

---

## 2. Route-Linien rendern: Strategie nach Maßstab

Drei Patterns aus der Praxis ([MapLibre Large Data Guide](https://maplibre.org/maplibre-gl-js/docs/guides/large-data/)):

| Strategie                     | Wann                   | Pro                                               | Contra                                      |
| ----------------------------- | ---------------------- | ------------------------------------------------- | ------------------------------------------- |
| **Alle Linien immer**         | <50 Routen             | Sofort sichtbarer Atlas-Charakter, kein Hover-Lag | Visuelles Rauschen, mobile schwach          |
| **Viewport-basiert**          | 50–500 Routen          | Map bleibt lesbar, Performance ok                 | Komplex, "verschwindende" Routen beim Panen |
| **Hover-Reveal über Cluster** | >100 oder mobile-first | Saubere Karte, Fokus auf einer Route              | Erst nach Interaktion sichtbar              |

**Empfehlung MotoAtlas:** **Hybrid** — Cluster + Pins als Default, **alle Linien dezent** (`line-opacity: 0.25`, `line-width: 1.5`) ab Zoom ≥ 8, **fokussierte Linie** (volle Opazität, dicker) bei Hover/Selektion. `minzoom` am Layer setzen verhindert teures Rendern bei Übersichtszoom ([MapLibre Large Data Guide](https://maplibre.org/maplibre-gl-js/docs/guides/large-data/)).

**Pre-Simplification:** `build_catalog.py` vereinfacht schon auf max 500 Punkte/Route (siehe `CLAUDE.md`). Das ist genau der richtige Hebel — keine Client-Side-Simplification per `simplify-js`, sondern Build-Time.

---

## 3. Hover/Selektion-Sync zwischen Map und Sidebar

**Pattern (bidirektional):**

1. **Shared State:** Ein einziger `activeRouteId` State (Reactive Signal / Pub-Sub). Map-Layer-Filter UND Card-Highlight reagieren auf denselben Wert. Verhindert Flicker und Race-Conditions ([Ride with GPS Route Library](https://support.ridewithgps.com/hc/en-us/articles/9951381001243-Explore-Your-Route-Library)).
2. **Hover-Sidebar → Map:** Card `mouseenter` → setActive → MapLibre `setFeatureState({source, id}, {hover: true})` triggert Style-Expression `["case", ["boolean", ["feature-state", "hover"], false], "#dc2626", "#0090a7"]`. Kein neues Render-Pass, keine Layer-Re-Erstellung.
3. **Hover-Map → Sidebar:** `map.on('mouseenter', layer, ...)` setzt denselben State, Sidebar scrollt Card in View (`scrollIntoView({block: 'nearest', behavior: 'smooth'})`).
4. **Klick = Lock-State** zusätzlich zu Hover. Hover bricht beim Mouse-Leave, Selektion bleibt bis nächster Klick oder Esc.
5. **fitBounds nur bei Klick**, nicht bei Hover — sonst springt Karte unkontrolliert. Bei Multi-Highlight (Filter aktiv) `fitBounds` auf Union der `bounds` ([gpx.studio docs](https://gpx.studio/help/map-controls)).

**Anti-Pattern:** `addLayer`/`removeLayer` pro Hover. Immer `setFeatureState` oder Filter-Expression — Layer-Re-Init ist teuer und blockiert Main-Thread.

---

## 4. Mobile-First: Bottom Sheet statt Sidebar

NN/Group und LogRocket sind eindeutig: **Bottom Sheet ist der Standard für Map-Apps mit Listen** ([NN/G Bottom Sheets](https://www.nngroup.com/articles/bottom-sheet/), [LogRocket](https://blog.logrocket.com/ux-design/bottom-sheets-optimized-ux/)).

**Konkrete Anforderungen:**

- **Drei Snap-Points:** `peek` (10–15% Höhe, nur Handle + Counter "23 Routen"), `half` (50%, Karte sichtbar + scrollbare Liste), `full` (90%, Filter-UI). Google-Maps-Idiom.
- **Karte bleibt interaktiv** auch bei `half`. Nie modal blockieren.
- **Touch-Targets ≥ 44×44px** (Apple HIG / Material). Pulsierende Pins aktuell oft kleiner — Tap-Area über `circle-radius` ≥ 20 oder unsichtbares Halo-Layer für `click`-Events.
- **Drag-Handle sichtbar** (16px Pille oben). Ohne Handle entdecken User die Drag-Geste nicht.
- **Engagement-Daten:** Bottom Sheets erreichen 25–30% höhere Engagement-Rate vs Modal-Dialoge ([Plotline Mobile Bottom Sheets](https://www.plotline.so/blog/mobile-app-bottom-sheets)).

**Empfehlung MotoAtlas:** Breakpoint `< 768px` → Sidebar wird zum Bottom Sheet. Library wie `vaul` (React) oder eigene CSS-`overscroll-behavior: contain` + `pointer-events`-Schalter. Wegen Vanilla-JS-Setup im Repo wahrscheinlich Eigenbau (~150 LOC).

---

## 5. Filter-UX: Facets für Routen

Vergleich aus AllTrails / Komoot / Strava ([Komoot Guide BikeRadar](https://www.bikeradar.com/advice/buyers-guides/guide-to-using-komoot), [AllTrails vs Komoot](https://www.theplanetedit.com/alltrails-vs-komoot/)):

**Etablierte Facets (in dieser Reihenfolge der Wichtigkeit):**

1. **Land/Region** (Tabs oder Pills — MotoAtlas hat das schon richtig)
2. **Typ** (Touring / Scenic / Offroad) — Chip-Toggle, multi-select
3. **Länge** (Range-Slider mit Histogramm, nicht Dropdown) — "< 50km / 50–150km / 150–300km / > 300km" als Buckets ist für Wenig-Routen besser als Slider
4. **Schwierigkeit** (1–5 oder Easy/Moderate/Hard) — Komoot nutzt 3 Stufen ([Komoot Tour Characteristics](https://www.komoot.com/tour-characteristics))
5. **Surface** (Asphalt / Gravel / Mixed) — relevant für Motorrad
6. **Höhenmeter** (optional, Power-User)

**Faceted-Counts neben Optionen** ("Offroad (12)"), graye out wenn `count = 0` bei gesetztem anderen Filter. Verhindert Dead-Ends.

**Reset/Clear All** prominent. Aktive Filter als entfernbare Chips über der Liste.

**URL-State:** Alle Filter in Query-String (`?country=de&type=offroad&len=50-150`). Hash-Router schon da → erweitern. Erlaubt Sharing und Browser-Back ([Eleken UX Navigation](https://www.eleken.co/blog-posts/ux-navigation-design)).

---

## 6. Color-Coding für Routen-Typen (Accessibility)

**WCAG 1.4.1 (Use of Color)** verbietet Farbe als _einziges_ Unterscheidungsmerkmal ([W3C WCAG 2.1](https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html)). Konsequenz für MotoAtlas:

- **Drei Typen brauchen drei Dimensionen:** Farbe + Icon + Label.
  - Touring: blau `#0a4d8c` + 🛣️ road-icon + Label "Touring"
  - Scenic: petrol `#0090a7` (Corporate) + 🏞️ landscape-icon + Label "Scenic"
  - Offroad: amber `#b45309` + 🏔️ mountain-icon + Label "Offroad"
- **Rot/Grün vermeiden:** ~5% der Männer rot-grün-blind ([Section508.gov](https://www.section508.gov/create/making-color-usage-accessible/), [A11Y Collective](https://www.a11y-collective.com/blog/color-blind-accessibility-guidelines/)).
- **Linien-Stil zusätzlich:** Touring solid, Scenic solid+dotted overlay, Offroad dashed (`line-dasharray`). Map-Stile sehen das problemlos als Style-Property.
- **Contrast-Ratio ≥ 3:1** für Linien gegen Basemap (≥ 4.5:1 für Text-Labels). Bei MapTiler-Outdoor-Style mit grün/braun-Hintergrund müssen Farben getestet werden — Tool: contrast-grid.eightshapes.com.
- **Schwierigkeit NICHT über Farbe**, sondern über 1–3 gefüllte Symbole (●●○) oder Text. Schwierigkeit + Typ-Farbe gleichzeitig überlastet sonst.

---

## 7. Geolocation: "Routen in meiner Nähe"

**Browser Geolocation API** — Standard-Pattern:

1. **Permission lazy anfordern**, nicht beim Pageload. Trigger: Klick auf "Routen in meiner Nähe"-Button. Spontane Prompts haben hohe Reject-Rate.
2. **Erklärenden Tooltip vor Prompt** ("Wir nutzen deinen Standort nur einmalig, um die nächsten Routen zu finden — kein Tracking, nichts wird gespeichert").
3. **Fallback bei Deny:** Manueller Ortseingabe-Input mit Geocoding (Nominatim für DE+BE+NL+FR+IT kostenlos, mit Usage-Policy beachten).
4. **`navigator.geolocation.getCurrentPosition`** mit `{maximumAge: 300000, timeout: 10000, enableHighAccuracy: false}`. High-Accuracy ist für Routen-Discovery nicht nötig (GPS-Fix dauert länger und kostet Akku).
5. **HTTPS Pflicht** — Geolocation API funktioniert nicht über HTTP. GitHub Pages liefert HTTPS automatisch, also kein Problem.
6. **Berechnung clientseitig:** Haversine zwischen User-Position und `bounds.center` jeder Route. Sortieren, Top-N anzeigen. `check_duplicates.py` macht das Pattern serverseitig schon — Logik wiederverwendbar.
7. **Privacy by Design:** Keinen Geolocation-Wert in URL/State persistieren, kein Analytics-Event mit Koordinaten.

---

## 8. Print-Friendly & Offline-Export

GPX-Apps lösen das meist über zwei Pfade ([GPS Visualizer](https://www.gpsvisualizer.com/), [GPXSee](https://www.gpxsee.org/), [gpx.studio](https://gpx.studio/)):

**Pfad A — Direkt-GPX-Download:** MotoAtlas macht das implizit (Repo = Source). Pin-Detail-View sollte prominent **Download .gpx** + **Download Collection .zip** (CI-generiert in `collections/*.zip`) anbieten.

**Pfad B — Print-CSS:**

```css
@media print {
  .sidebar,
  .bottom-sheet,
  .filter-bar,
  .map-controls {
    display: none;
  }
  .map-container {
    height: 100vh;
    page-break-inside: avoid;
  }
  .route-details {
    display: block;
    font-family: serif;
  }
}
```

- **Map-Snapshot statt Live-Map drucken:** MapLibre's `map.getCanvas().toDataURL('image/png')` für statisches Bild, dann in Print-Layout einbetten. Tiles können sonst nicht laden beim PDF-Export.
- **Höhenprofil + Metadaten** als Text-Tabelle daneben (Distanz, Höhenmeter, Surface). User druckt das als "Roadbook".
- **QR-Code zur Route-URL** unten rechts auf Print-Layout — direkter Sprung zur Online-Version vom Druck.

**Offline (PWA):**

- Service Worker für App-Shell (HTML/JS/CSS) ist Low-Hanging-Fruit. Vite-PWA-Plugin `vite-plugin-pwa`.
- **Tiles offline cachen ist heikel:** OSM-Tile-Server-ToS verbietet Bulk-Download/Caching von raster-tiles ohne Absprache. Bei MapTiler erlaubt im Free-Tier nicht. **Empfehlung:** Nur App-Shell + catalog.json + GPX-Files cachen, Tiles bleiben online-only. Echtes Offline-Karten-Verhalten kommt nur über native Apps wie Organic Maps ([Organic Maps](https://organicmaps.app/)).

---

## 9. Konkrete Quick-Wins für MotoAtlas (priorisiert)

1. **`setFeatureState` für Hover-Sync** (statt Layer-Re-Style). Falls noch nicht so umgesetzt — eliminiert Flicker.
2. **Linien dezent ab Zoom 8 + Cluster** statt nur Pins. Macht den Atlas-Charakter sofort sichtbar.
3. **URL-State für Filter** (Query-String in Hash). Sharable Links.
4. **Typ-Color + Icon + Label** durchgehend (Map-Pin, Card, Filter-Chip identisch). Accessibility-Pflicht.
5. **Bottom Sheet < 768px** statt Sidebar.
6. **Faceted Counts** in Filter-Optionen.
7. **"Routen in meiner Nähe"-Button** im Header (lazy permission).
8. **Print-CSS + Map-Snapshot** für Roadbook-Druck.
9. **PWA App-Shell** (catalog.json + GPX cachen, Tiles nicht).

Nicht jetzt: Heatmap (zu wenige Routen), 3D-Terrain (Tile-Kosten), Strava-Style Segments.

---

## Quellen

- [MapLibre Docs — Create and style clusters](https://maplibre.org/maplibre-gl-js/docs/examples/create-and-style-clusters/) (zugegriffen 2026-05-10)
- [MapLibre Large Data Guide](https://maplibre.org/maplibre-gl-js/docs/guides/large-data/) (zugegriffen 2026-05-10)
- [MapLibre Discussion #2160 — clusterProperties](https://github.com/maplibre/maplibre-gl-js/discussions/2160) (zugegriffen 2026-05-10)
- [MDPI — Vector Data Rendering Performance of Web Mapping Libraries 2025](https://www.mdpi.com/2220-9964/14/9/336) (zugegriffen 2026-05-10)
- [Mapbox/Supercluster GitHub](https://github.com/mapbox/supercluster) (zugegriffen 2026-05-10)
- [Stadia Maps — Clustering with MapLibre GL JS](https://docs.stadiamaps.com/tutorials/clustering-styling-points-with-maplibre/) (zugegriffen 2026-05-10)
- [Ride with GPS — Explore Your Route Library](https://support.ridewithgps.com/hc/en-us/articles/9951381001243-Explore-Your-Route-Library) (zugegriffen 2026-05-10)
- [gpx.studio — Map Controls](https://gpx.studio/help/map-controls) (zugegriffen 2026-05-10)
- [Alistair Shepherd — Hillwalking maps with Leaflet](https://alistairshepherd.uk/writing/hillwalking-maps-with-leaflet/) (zugegriffen 2026-05-10)
- [NN/Group — Bottom Sheets: Definition and UX Guidelines](https://www.nngroup.com/articles/bottom-sheet/) (zugegriffen 2026-05-10)
- [LogRocket — How to design bottom sheets for optimized UX](https://blog.logrocket.com/ux-design/bottom-sheets-optimized-ux/) (zugegriffen 2026-05-10)
- [Plotline — Mobile App Bottom Sheets](https://www.plotline.so/blog/mobile-app-bottom-sheets) (zugegriffen 2026-05-10)
- [Mobbin — Bottom Sheet UI Design](https://mobbin.com/glossary/bottom-sheet) (zugegriffen 2026-05-10)
- [Komoot — Tour Characteristics / Difficulty](https://www.komoot.com/tour-characteristics) (zugegriffen 2026-05-10)
- [BikeRadar — Guide to Komoot](https://www.bikeradar.com/advice/buyers-guides/guide-to-using-komoot) (zugegriffen 2026-05-10)
- [The Planet Edit — AllTrails vs Komoot](https://www.theplanetedit.com/alltrails-vs-komoot/) (zugegriffen 2026-05-10)
- [Eleken — UX Navigation Design Patterns](https://www.eleken.co/blog-posts/ux-navigation-design) (zugegriffen 2026-05-10)
- [W3C WCAG 2.1 — Use of Color (1.4.1)](https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html) (zugegriffen 2026-05-10)
- [Section508.gov — Making Color Usage Accessible](https://www.section508.gov/create/making-color-usage-accessible/) (zugegriffen 2026-05-10)
- [The A11Y Collective — Colour Blindness Accessibility](https://www.a11y-collective.com/blog/color-blind-accessibility-guidelines/) (zugegriffen 2026-05-10)
- [GPS Visualizer](https://www.gpsvisualizer.com/) (zugegriffen 2026-05-10)
- [GPXSee](https://www.gpxsee.org/) (zugegriffen 2026-05-10)
- [gpx.studio](https://gpx.studio/) (zugegriffen 2026-05-10)
- [Organic Maps — Offline Hike, Bike, Trails](https://organicmaps.app/) (zugegriffen 2026-05-10)
