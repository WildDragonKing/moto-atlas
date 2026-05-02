---
title: Route hinzufügen
date: 2026-05-02
status: current
owner: lbuettge
---

# Route hinzufügen

## Schnellstart

```bash
# 1. Route sammeln
bash scripts/collect.sh <url-oder-pfad> --country de --type offroad

# 2. Sidecar anpassen (Name, source_name, type falls nötig)
$EDITOR drafts/de/meine-route.json

# 3. Lokal validieren
source .venv/bin/activate
python scripts/validate_gpx.py drafts/de/meine-route.gpx
python scripts/validate_sidecar.py drafts/de/meine-route.json

# 4. PR erstellen → CI läuft automatisch
git add drafts/de/meine-route.gpx drafts/de/meine-route.json
git push origin feat/meine-route

# 5. Nach Review: promoten
bash scripts/promote.sh drafts/de/meine-route.gpx
```

## collect.sh im Detail

```bash
bash scripts/collect.sh <source> --country <de|be|nl|fr|it> [--type <offroad|touring|scenic>]
```

`<source>` kann sein:

- URL einer GPX-Datei (`https://assets.adac.de/...gpx`)
- Lokaler Dateipfad (`/Downloads/meine-route.gpx`)

Das Script legt die GPX-Datei in `drafts/{country}/` ab und erstellt einen minimalen JSON-Sidecar mit `name` (aus Dateiname), `country`, `source_url`, `source_name="Manuell"`.

## Sidecar bearbeiten

Mindestens anpassen:

- `name` — lesbarer Routenname
- `source_name` — Plattform (ADAC, Wikiloc, Komoot, TET, …)
- `type` — `offroad`, `touring` oder `scenic`
- `modified` / `modification_notes` — wenn du die GPX verändert hast

## Qualitätsregeln

Nur Routen die diese Kriterien erfüllen werden von CI akzeptiert:

| Regel         | Detail                                                            |
| ------------- | ----------------------------------------------------------------- |
| Echte Route   | Keine algorithmisch generierten Tracks (kein Kurviger-API-Output) |
| Quellenangabe | `source_url` und `source_name` Pflicht                            |
| Elevation     | `<ele>` auf allen Trackpunkten                                    |
| Koordinaten   | Innerhalb Europa (35°N–72°N, 10°W–32°E)                           |
| Kein Duplikat | Schwerpunkt > 0,5 km zur nächsten Route                           |
| GPX-Name      | `<metadata><name>` oder `<trk><name>` vorhanden                   |

## Route archivieren

```bash
# Route aus routes/ oder drafts/ in archive/ verschieben
bash scripts/archive.sh routes/de/offroad/alte-route.gpx "von v2 abgeloest"
```

Archivierte Routen bleiben im Repo (für History), erscheinen aber nicht mehr im Katalog.

## Häufige Fehler

**`Track 0: N Trackpunkte ohne <ele>`**
Die GPX-Datei hat keine Höhendaten. Viele Routing-Apps exportieren nur lat/lon. Lösung: Elevation via [gpx.studio](https://gpx.studio) oder `srtm.py` ergänzen.

**`Mögliches Duplikat von 'de-eifel-...'`**
Eine ähnliche Route existiert bereits. Prüfe ob es eine neue Variante oder wirklich ein Duplikat ist. Falls neue Variante: leicht anderen Startpunkt wählen.

**`Kein Name vorhanden`**
Weder `<metadata><name>` noch `<trk><name>` gesetzt. In der GPX-Datei oder im Sidecar korrigieren.
