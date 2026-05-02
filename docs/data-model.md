---
title: MotoAtlas — Datenmodell
date: 2026-05-02
status: current
owner: lbuettge
---

# Datenmodell

Pro Route gibt es zwei Dateien mit identischem Basisnamen:

```
routes/de/offroad/de-eifel-volcanic-route.gpx
routes/de/offroad/de-eifel-volcanic-route.json
```

## GPX-Pflichtstruktur

```xml
<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="motoatlas" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Volcanic Route Eifel</name>        <!-- Pflicht ODER <trk><name> -->
    <desc>Schotter durch die Vulkaneifel</desc>
  </metadata>

  <!-- POIs als Waypoints (optional) -->
  <wpt lat="50.38" lon="6.74">
    <name>Camping Eifel See</name>
    <sym>Campground</sym>   <!-- Scenic-Symbol -->
    <type>camp</type>
  </wpt>

  <trk>
    <name>Volcanic Route Eifel</name>  <!-- Fallback wenn kein metadata/name -->
    <type>offroad</type>
    <trkseg>
      <trkpt lat="50.320" lon="6.510">
        <ele>412.0</ele>   <!-- Pflicht auf ALLEN Punkten -->
      </trkpt>
    </trkseg>
  </trk>
</gpx>
```

**Scenic-POI-Symbole:** `Campground`, `Scenic Area`, `Gas Station`, `Restaurant`

## JSON-Sidecar-Schema

```json
{
  // ── Pflicht (manuell beim Anlegen) ──────────────────────────
  "id": "de-eifel-volcanic-route",
  "name": "Volcanic Route Eifel",
  "country": "de",           // de | be | nl | fr | it
  "source_url": "https://transeurotrail.org/germany/",
  "source_name": "Trans Euro Trail",
  "modified": false,         // true wenn GPX gegenüber Original verändert
  "modification_notes": "",  // Pflicht wenn modified=true

  // ── Optional (manuell, verbessern die Qualität) ─────────────
  "region": "eifel",
  "type": "offroad",         // offroad | touring | scenic

  // ── Von CI auto-berechnet (NICHT manuell setzen) ────────────
  "distance_km": 142,
  "elevation_gain_m": 1840,
  "duration_h": 3.5,
  "bounds": { "north": 50.45, "south": 50.10, "east": 7.10, "west": 6.40 },
  "gpx_url": "routes/de/offroad/de-eifel-volcanic-route.gpx",
  "gpx_hash": "sha256:abc123",
  "geometry": { "type": "LineString", "coordinates": [[6.51, 50.32], ...] },

  // ── Von Agent befüllt (Plan 3) ──────────────────────────────
  "rating": 4.8,             // 1.0–5.0
  "rating_source": "agent",  // agent | manual
  "agent_review": "Klassischer Offroad-Einstieg...",
  "difficulty": 3,           // 1–5
  "surface": "mixed",        // paved | gravel | mixed
  "offroad_pct": 40,         // % Schotteranteil
  "tags": ["offroad", "vulkaneifel"],
  "reviewed_at": "2026-05-02"
}
```

## Route-Typen

| Typ       | Bedeutung                                                 |
| --------- | --------------------------------------------------------- |
| `offroad` | Schotter, Waldwege, Trails — kein reiner Asphalt          |
| `touring` | Kurvenreiche Asphalt-Landstraßen, Pässe, Panoramastrecken |
| `scenic`  | Primär Sehenswürdigkeiten, gemischte Oberfläche           |

## Minimal-JSON für Drafts

Beim ersten Anlegen reicht:

```json
{
  "name": "Meine Route",
  "country": "de",
  "source_url": "https://...",
  "source_name": "Wikiloc"
}
```

CI und Agent füllen den Rest automatisch.

## CI-Validierungsregeln

| Check       | Regel                                                 |
| ----------- | ----------------------------------------------------- |
| XML         | Wohlgeformtes XML, GPX 1.1                            |
| Name        | `<metadata><name>` ODER `<trk><name>` vorhanden       |
| Elevation   | `<ele>` auf allen `<trkpt>`                           |
| Trackpunkte | Mindestens 10                                         |
| Dateigröße  | Maximal 50 MB                                         |
| Koordinaten | Europa-Bounds: 35°N–72°N, 10°W–32°E                   |
| Sidecar     | Pflichtfelder: name, country, source_url, source_name |
| Country     | Whitelist: de, be, nl, fr, it                         |
| Duplikat    | Haversine-Schwerpunkt < 0,5 km zu bestehender Route   |

## catalog.json (generiert)

`catalog.json` wird von `build_catalog.py` aus allen Sidecars generiert. **Nicht committen** (in `.gitignore`). Enthält für jede Route alle Sidecar-Felder plus die berechneten Stats und die vereinfachte Geometrie.
