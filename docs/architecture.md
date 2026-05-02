---
title: MotoAtlas — Architektur
date: 2026-05-02
status: current
owner: lbuettge
---

# Architektur

## Überblick

MotoAtlas ist eine **Pure-Static**-Anwendung. Es gibt keinen laufenden Server und keine Datenbank. Git ist die einzige Source of Truth. GitHub Actions ist das einzige "Backend".

```mermaid
flowchart LR
    A[Du / Agent\nGPX + JSON per PR] --> B[Git Repo\nroutes/ drafts/ archive/]
    B --> C[GitHub Actions\nvalidate → build → deploy]
    C --> D[GitHub Pages\nmoto.buettgen.app]
    D --> E[Browser\ncatalog.json einmalig laden]
```

## Routen-Lifecycle

```mermaid
stateDiagram-v2
    [*] --> DRAFT: collect.sh
    DRAFT --> LIVE: promote.sh\nnach PR-Review
    DRAFT --> ARCHIV: archive.sh\n(Duplikat / veraltet)
    LIVE --> ARCHIV: archive.sh\n(abgelöst)
    ARCHIV --> [*]: nie gelöscht
```

| Zustand | Pfad                   | Sichtbar auf Site     | GPX-Download |
| ------- | ---------------------- | --------------------- | ------------ |
| DRAFT   | `drafts/{land}/`       | Ja, mit "Draft"-Badge | Nein         |
| LIVE    | `routes/{land}/{typ}/` | Ja, vollständig       | Ja           |
| ARCHIV  | `archive/{land}/`      | Nein                  | Nein         |

## Build-Pipeline

```mermaid
flowchart TD
    A[GPX-Dateien\nroutes/ + drafts/] --> B[build_catalog.py]
    B -->|Geometrie-Extraktion\nvereinfacht auf max 500 Punkte| C[catalog.json]
    C --> D[Vite Build\ndist/]
    A -->|ZIP-Collections| E[collections/*.zip\nde-offroad.zip etc.]
    D --> F[GitHub Pages\nmoto.buettgen.app]
    E --> F
```

`catalog.json` enthält für jede Route:

- Alle Metadaten aus dem JSON-Sidecar
- Vereinfachte Geometrie (GeoJSON LineString) aus der GPX-Datei
- Berechnete Stats (distance_km, elevation_gain_m, bounds)

Der Browser lädt **eine einzige Datei** und rendert alles sofort — kein Warten, keine weiteren Requests.

## Frontend: Hash-Navigation

```
moto.buettgen.app/          → Katalog-View (Route-Cards, Filter, Collections)
moto.buettgen.app/#/map     → Karten-View (MapLibre GL, alle Routen als Layer)
```

Hash-Routing funktioniert auf GitHub Pages ohne Server-Konfiguration.

## CI/CD: Drei Workflows

| Workflow                      | Trigger                             | Zweck                                        |
| ----------------------------- | ----------------------------------- | -------------------------------------------- |
| `validate.yml`                | PR auf `routes/**` oder `drafts/**` | GPX + Sidecar validieren, Duplikat-Check     |
| `agent-review.yml` _(Plan 3)_ | Nach validate.yml                   | KI-Review, Rating schreiben                  |
| `build-deploy.yml`            | Push auf `main`                     | Katalog bauen, Vite-Build, gh-pages deployen |

## Warum kein Server?

- Null Wartungsaufwand, keine Kosten
- Alles versioniert in Git (inkl. History jeder Route)
- GitHub Actions als vollständiges CI/CD-System
- Kompromiss: Keine Echtzeit-Community-Ratings (kommt in Phase 2 via Supabase)
