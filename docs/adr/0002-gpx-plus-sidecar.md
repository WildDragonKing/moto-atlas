---
title: "ADR 0002: GPX + JSON-Sidecar als Datenformat"
date: 2026-05-02
status: current
owner: lbuettge
---

# ADR 0002: GPX + JSON-Sidecar als Datenformat

## Kontext

GPX-Dateien (GPS Exchange Format) enthalten Koordinaten, Elevation und einfache Metadaten. Für MotoAtlas brauchen wir zusätzlich: Rating, Quelle, Region, Typ, Agent-Review, Schwierigkeit. Das GPX-Format unterstützt Custom-Extensions, aber diese sind nicht standardisiert und werden von Scenic und anderen Apps ignoriert.

## Entscheidung

**Zwei Dateien pro Route mit identischem Basisnamen:**

```
de-eifel-volcanic-route.gpx   ← Koordinaten, Elevation, POIs
de-eifel-volcanic-route.json  ← Alle Metadaten, Stats, Rating
```

Der JSON-Sidecar ist die einzige Quelle für Metadaten. CI prüft Konsistenz (gleicher Basisname, Pflichtfelder vorhanden).

## Konsequenzen

**Positiv:**

- GPX-Dateien bleiben 100% standard-konform und Scenic-kompatibel
- JSON ist einfach zu lesen, zu schreiben und zu versionieren
- CI kann JSON-Schema strikt validieren
- `catalog.json` lässt sich trivial aus allen Sidecars generieren
- Grep-bar: `grep -r "rating" routes/` funktioniert

**Negativ:**

- Zwei Dateien pro Route statt einer
- CI muss Konsistenz sicherstellen (gleicher Basisname vorhanden)
- Rename einer Route erfordert beide Dateien umzubenennen

## Alternativen erwogen

**Custom GPX-Extensions (`<extensions>`):** Technisch möglich, aber nicht von Scenic/Garmin/Komoot gelesen. Schlechtere Tooling-Unterstützung.

**Datenbank (SQLite im Repo):** Nicht diff-bar, nicht merge-bar, schwer zu debuggen. Binary-Dateien in Git sind problematisch.

**Einzelne JSON-Datei mit eingebetteten Koordinaten (GeoJSON):** Verliert die direkte Scenic-Kompatibilität (GPX-Download). Zwei Formate wären nötig.

**GPX mit Namenskonvention im `<desc>`-Feld:** Fragil, nicht maschinenlesbar, kein Schema möglich.
