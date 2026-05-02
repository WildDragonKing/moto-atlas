---
title: CI/CD Pipeline
date: 2026-05-02
status: current
owner: lbuettge
---

# CI/CD Pipeline

Drei GitHub Actions Workflows — alle unter `.github/workflows/`.

## validate.yml — PR-Check

**Trigger:** Pull Request mit Änderungen in `routes/**` oder `drafts/**`

Findet alle geänderten GPX-Dateien im PR und prüft sie der Reihe nach:

1. **GPX-Schema** — XML wohlgeformt, GPX 1.1, Name vorhanden (`<metadata><name>` oder `<trk><name>`)
2. **Elevation** — `<ele>` auf allen `<trkpt>` vorhanden
3. **Mindest-Trackpunkte** — ≥ 10 Punkte
4. **Dateigröße** — ≤ 50 MB
5. **Europa-Bounds** — alle Koordinaten in 35°N–72°N, 10°W–32°E
6. **JSON-Sidecar** — existiert, enthält Pflichtfelder (`name`, `country`, `source_url`, `source_name`), gültiges `country` und `type`
7. **Duplikat-Check** — Haversine-Abstand vom Schwerpunkt zur nächsten Route < 0,5 km → Fehler. Self-reference-safe (neue Route wird nicht gegen sich selbst geprüft)

Bei Fehler: PR-Check schlägt fehl mit Fehlerstelle. Bei Erfolg: PR kann gemergt werden.

## agent-review.yml — KI-Review _(Plan 3, noch nicht implementiert)_

**Trigger:** Nach `validate.yml` (nur bei Erfolg)
**Modell:** `claude-haiku-4-5-20251001` (~$0.001 pro Route)

Aufgaben:

- Stats berechnen: `distance_km`, `elevation_gain_m`, `duration_h`, `bounds`
- Route inhaltlich bewerten (Schönheit, Eigencharakter, Qualität der GPX-Daten)
- `rating` (1–5) und `agent_review` (2–3 Sätze Deutsch) schreiben
- `difficulty`, `surface`, `offroad_pct` schätzen
- JSON-Sidecar auf dem PR-Branch committen

Secret benötigt: `ANTHROPIC_API_KEY` in GitHub Repo Settings → Secrets.

## build-deploy.yml — Build und Deploy

**Trigger:** Push auf `main`

Schritte:

1. `python scripts/build_catalog.py` — liest alle JSON-Sidecars, extrahiert Geometrie aus GPX (max. 500 Punkte), schreibt `catalog.json`
2. ZIP-Collections bauen: `de-offroad.zip`, `de-touring.zip`, … `all-offroad.zip`, `all-routes.zip`
3. `pnpm build` — Vite-Build nach `dist/`
4. `catalog.json`, `routes/` und `collections/` nach `dist/` kopieren
5. GitHub Pages deployen (`gh-pages`-Branch via `actions/deploy-pages`)

Dauer: ~3–5 Minuten. Live-URL: https://moto.buettgen.app

## Lokaler Dry-Run

```bash
source .venv/bin/activate

# validate.yml simulieren
python scripts/validate_gpx.py routes/de/offroad/meine-route.gpx
python scripts/validate_sidecar.py routes/de/offroad/meine-route.json
python scripts/build_catalog.py && python scripts/check_duplicates.py routes/de/offroad/meine-route.gpx

# build-deploy.yml simulieren
python scripts/build_catalog.py
pnpm build
```

## Secrets

| Secret              | Zweck                     | Pflicht                     |
| ------------------- | ------------------------- | --------------------------- |
| `ANTHROPIC_API_KEY` | agent-review.yml (Plan 3) | Nein (Plan 1 läuft ohne)    |
| `VITE_MAPTILER_KEY` | Bessere Karten-Tiles      | Nein (Fallback auf CartoDB) |
