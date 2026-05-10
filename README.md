# MotoAtlas

Kuratierte Motorrad-GPX-Routensammlung für DE, BE, NL, FR, IT — direkt importierbar in [Scenic](https://scenic.app).

**Live:** https://moto.buettgen.app

## Was es macht

- Browse und Filter nach Land und Typ (Offroad / Touring / Scenic)
- MapLibre GL Karte mit allen Routen, Klick-Popup mit Metadaten
- GPX-Download pro Route, ZIP-Collections pro Land/Typ für Scenic Bulk-Import
- CI prüft bei jedem PR: Schema, Elevation, Duplikate, Pflichtfelder

## Starten

```bash
pnpm install
python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
python scripts/build_catalog.py
pnpm dev   # http://localhost:5173
```

## Route hinzufügen

```bash
# 1. Sammeln (URL oder lokale Datei → drafts/)
bash scripts/collect.sh <url-oder-pfad> --country de --type offroad

# 2. Nach Review promoten
bash scripts/promote.sh drafts/de/meine-route.gpx
```

Jede Route braucht eine `.gpx` + `.json` Sidecar-Datei. Minimales Sidecar:

```json
{
  "name": "Routenname",
  "country": "de",
  "source_url": "https://example.org/meine-tour",
  "source_name": "Eigene Tour",
  "gpx_redistribution": "allowed"
}
```

Nur echte, von Menschen gefahrene oder geplante Routen — vorzugsweise eigene Tracks oder Tracks aus dem Freundeskreis. Keine algorithmisch generierten Tracks. **Keine Inhalte aus AGB-geschützten Quellen** (ADAC NavBikeTour, Wikiloc, Komoot, BikeMap) — auch nicht als Hotlink. `source_url`, `source_name`, `gpx_redistribution` sind Pflicht.

## Struktur

```
routes/{land}/{typ}/   ← Live (GPX + JSON)
drafts/{land}/         ← Gesammelt, noch nicht reviewed
archive/{land}/        ← Geparkt, nie gelöscht
scripts/               ← collect.sh, promote.sh, archive.sh, build_catalog.py, …
tests/                 ← 18 Tests (pytest)
.github/workflows/     ← validate.yml, build-deploy.yml
src/                   ← Vite-Frontend (MapLibre GL)
```

## Tests

```bash
source .venv/bin/activate && pytest tests/ -v
```

## Nächste Schritte

- `docs/` — Architektur, Datenmodell, CI/CD-Pipeline
- Plan 3: Agent-Review GitHub Action + OSM-Crawler

## Lizenz

MIT
