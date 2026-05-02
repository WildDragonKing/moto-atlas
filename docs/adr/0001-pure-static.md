---
title: "ADR 0001: Pure-Static-Architektur"
date: 2026-05-02
status: current
owner: lbuettge
---

# ADR 0001: Pure-Static-Architektur

## Kontext

MotoAtlas ist eine persönliche Motorrad-Routensammlung für eine Person mit gelegentlichen Beiträgen. Die Kernfrage: Wie speichern und veröffentlichen wir die Daten?

## Entscheidung

**Pure Static** — kein laufender Server, keine Datenbank. Git ist die einzige Source of Truth. GitHub Actions ist das Backend. GitHub Pages hostet die Site.

## Konsequenzen

**Positiv:**

- Null Wartungsaufwand und Betriebskosten
- Alle Routen vollständig versioniert mit History
- Jede Änderung durchläuft CI (Validierung, Review)
- Site läuft auch bei hohem Traffic ohne Skalierung
- Vollständiger Offline-Export jederzeit möglich (git clone)

**Negativ:**

- Keine Echtzeit-Community-Ratings (Nutzer können nicht selbst bewerten)
- Neue Routen brauchen einen PR-Zyklus (~5 min), kein sofortiges Hinzufügen
- Kein User-Login, keine persönlichen Sammlungen

## Alternativen erwogen

**Supabase (free tier):** Würde Echtzeit-Ratings ermöglichen. Aufwand: Datenbankschema, Auth, Backup-Strategie. Overhead nicht gerechtfertigt für Phase 1.

**Eigener Server (VPS):** Maximale Flexibilität, aber Wartungsaufwand (Updates, Backups, Monitoring). Nicht im Verhältnis zum Nutzen.

**Netlify/Vercel mit serverless Functions:** Mittelweg, aber immer noch externes Service-Dependency. Unnötige Komplexität.

## Nachfolger

Falls Community-Features gewünscht: Supabase als Ergänzung zu Git (nicht Ersatz). GPX-Dateien bleiben in Git, Ratings/Kommentare in Supabase.
