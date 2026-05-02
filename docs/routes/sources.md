---
title: Routen-Quellen
date: 2026-05-02
status: current
owner: lbuettge
---

# Routen-Quellen

Nur echte, von Menschen gefahrene oder sorgfältig geplante Routen. Keine automatisch generierten Tracks.

## Tier 1 — Vollautomatisch (legal, open)

### ADAC NavBikeTour

Direkte GPX-Download-URLs ohne Login. Regionen NRW, Eifel, Bergisches Land, Sauerland.

Basis-URL: `https://assets.adac.de/raw/upload/...gpx`
Übersicht: https://www.adac.de/der-adac/regionalclubs/nrw/motorradtouren-fuers-navi/

Wichtig: Die "Calimoto App und Scenic App"-Tracks sind explizit für Scenic optimiert.

```bash
bash scripts/collect.sh "https://assets.adac.de/raw/upload/.../ADAC_Track_....gpx" --country de --type touring
```

### Trans Euro Trail (TET)

51.000 km Offroad-Route von Afrika bis zum Arktischen Ozean, kostenlos und offen.
Sections für DE, BE, NL, FR, IT verfügbar.

Download: https://transeurotrail.org — Land auswählen → GPX herunterladen

```bash
bash scripts/collect.sh /Downloads/TET_DE_South.gpx --country de --type offroad
```

### OSM Overpass API

Kuratierte Motorrad-Routen-Relations aus OpenStreetMap. Nur `relation[route=motorcycle]` mit gesetztem `name`-Tag — keine namenlosen Track-Dumps.

Beispiel-Query für Eifel-Bereich:

```
[out:json];
relation["route"="motorcycle"]["name"](50.0,6.0,51.5,7.5);
out geom;
```

## Tier 2 — Halbautomatisch (ToS respektieren)

Kein automatischer Bulk-Crawler. Jede Route einzeln und manuell.

### Wikiloc

50 Mio+ Routen, GPX-Download nach kostenlosem Login.
Suche nach "motorcycle" oder "motorrad" + Region.

```bash
bash scripts/collect.sh "https://www.wikiloc.com/trails/..." --country de
```

### Komoot

Gute Tourenqualität, GPX-Export über Community-Tools möglich.

```bash
bash scripts/collect.sh "https://www.komoot.com/tour/..." --country be
```

### Best Biking Roads

GPX-Download ohne Login. Fokus auf Motorrad-Straßentouren.
URL: https://www.bestbikingroads.com

## Tier 3 — Agent-gestützt (Plan 3)

```bash
# Claude sucht Web nach Routen-Quellen für den Begriff
bash scripts/research.sh "ardennen offroad belgien"
```

Gibt priorisierte Liste mit URLs und Qualitätseinschätzung zurück. Dann `collect.sh` für gewünschte Routen.

## Qualitäts-Checkliste vor dem Hinzufügen

- [ ] Route wurde tatsächlich von Motorradfahrern genutzt/empfohlen?
- [ ] `source_url` direkt zur Route (nicht zur Startseite)?
- [ ] GPX hat Elevation-Daten?
- [ ] Kein reiner Routing-API-Output (kein "Route 1", keine Koordinaten als Name)?
- [ ] Für Offroad-Routen: wirklich Schotter/Trail-Anteil vorhanden?
