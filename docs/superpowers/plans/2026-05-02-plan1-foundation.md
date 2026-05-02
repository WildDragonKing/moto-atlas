# MotoAtlas Plan 1: Foundation + Scripts + CI/CD

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lauffähiges Repo mit GPX-Validierung, Katalog-Build und deployeter GitHub Pages Site — erste Route erscheint live auf moto.buettgen.app.

**Architecture:** Pure Static — GPX + JSON-Sidecars in Git, Python-Scripts für Validierung und Katalog-Build, GitHub Actions für CI/CD, Vite + MapLibre GL für die Site (aus Bosnien-Projekt adaptiert).

**Tech Stack:** Python 3.12, gpxpy, pytest, Vite 6, MapLibre GL 4, pnpm, GitHub Actions

---

## File Map

```
.github/workflows/
  validate.yml          — PR-Check für routes/** und drafts/**
  build-deploy.yml      — Merge auf main → build → gh-pages deploy

scripts/
  validate_gpx.py       — GPX-Validierung (Schema, ele, bounds, …)
  validate_sidecar.py   — JSON-Sidecar-Validierung (Pflichtfelder)
  check_duplicates.py   — Haversine-Duplikat-Check gegen catalog.json
  build_catalog.py      — Alle JSON-Sidecars → catalog.json
  collect.sh            — URL/Pfad → drafts/{country}/
  promote.sh            — drafts/ → routes/{country}/{type}/
  archive.sh            — routes/ oder drafts/ → archive/

tests/
  fixtures/
    valid.gpx           — Minimales valides GPX mit ele
    no_ele.gpx          — GPX ohne Elevation (soll fehlschlagen)
    out_of_bounds.gpx   — GPX außerhalb Europa (soll fehlschlagen)
    few_points.gpx      — Zu wenig Punkte (soll fehlschlagen)
    valid.json          — Vollständiger Sidecar
    minimal.json        — Nur Pflichtfelder
    missing_source.json — Kein source_url (soll fehlschlagen)
  test_validate_gpx.py
  test_validate_sidecar.py
  test_check_duplicates.py
  test_build_catalog.py

src/
  main.js               — Entry Point
  catalog.js            — catalog.json laden, Route-Cards via DOM-API rendern
  filter.js             — Filter-State (Land, Typ)
  style.css             — MotoAtlas Theme (Pergament, Fraunces)

index.html              — App-Shell (im Repo-Root, Vite-Einstieg)

public/
  CNAME                 — moto.buettgen.app

routes/de/offroad/ routes/de/touring/
routes/be/offroad/ routes/be/touring/
routes/nl/touring/
routes/fr/offroad/ routes/fr/touring/
routes/it/offroad/ routes/it/touring/
drafts/de/ drafts/be/ drafts/nl/ drafts/fr/ drafts/it/
archive/de/ archive/be/ archive/nl/ archive/fr/ archive/it/

.gitignore
package.json
vite.config.js
requirements.txt
```

---

## Task 1: Repo-Grundstruktur

**Files:**

- Create: `.gitignore`
- Create: `requirements.txt`
- Create: `package.json`
- Create: `vite.config.js`
- Create: `public/CNAME`

- [ ] **Ordnerstruktur anlegen**

```bash
mkdir -p routes/de/{offroad,touring} routes/be/{offroad,touring} \
  routes/nl/touring routes/fr/{offroad,touring} routes/it/{offroad,touring} \
  drafts/{de,be,nl,fr,it} archive/{de,be,nl,fr,it} \
  scripts tests/fixtures src public .github/workflows
touch routes/de/offroad/.gitkeep routes/de/touring/.gitkeep \
  routes/be/offroad/.gitkeep routes/be/touring/.gitkeep \
  routes/nl/touring/.gitkeep routes/fr/offroad/.gitkeep \
  routes/fr/touring/.gitkeep routes/it/offroad/.gitkeep \
  routes/it/touring/.gitkeep \
  drafts/de/.gitkeep drafts/be/.gitkeep drafts/nl/.gitkeep \
  drafts/fr/.gitkeep drafts/it/.gitkeep \
  archive/de/.gitkeep archive/be/.gitkeep archive/nl/.gitkeep \
  archive/fr/.gitkeep archive/it/.gitkeep
```

- [ ] **`.gitignore` erstellen**

```
node_modules/
dist/
.env*
*.DS_Store
catalog.json
collections/
.superpowers/
__pycache__/
.pytest_cache/
*.pyc
.venv/
```

- [ ] **`requirements.txt` erstellen**

```
gpxpy==1.6.2
pytest==8.3.5
jsonschema==4.23.0
```

- [ ] **`package.json` erstellen**

```json
{
  "name": "moto-atlas",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "vite": "^6.3.5"
  },
  "dependencies": {
    "maplibre-gl": "^4.7.1"
  }
}
```

- [ ] **`vite.config.js` erstellen**

```js
import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  publicDir: "public",
  build: { outDir: "dist" },
});
```

- [ ] **`public/CNAME` erstellen**

```
moto.buettgen.app
```

- [ ] **Dependencies installieren**

```bash
pnpm install
python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
```

Expected: `node_modules/` und `.venv/` angelegt, keine Fehler.

- [ ] **Commit**

```bash
git add -A
git commit -m "chore: repo foundation — Ordnerstruktur, Vite, Python-Deps"
```

---

## Task 2: Test-Fixtures

**Files:**

- Create: `tests/fixtures/valid.gpx`
- Create: `tests/fixtures/no_ele.gpx`
- Create: `tests/fixtures/out_of_bounds.gpx`
- Create: `tests/fixtures/few_points.gpx`
- Create: `tests/fixtures/valid.json`
- Create: `tests/fixtures/minimal.json`
- Create: `tests/fixtures/missing_source.json`

- [ ] **`tests/fixtures/valid.gpx` erstellen**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="motoatlas" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Test Route Eifel</name>
    <desc>Testroute durch die Eifel</desc>
  </metadata>
  <wpt lat="50.38" lon="6.74"><name>Camping Test</name><sym>Campground</sym><type>camp</type></wpt>
  <trk>
    <name>Test Route Eifel</name>
    <type>offroad</type>
    <trkseg>
      <trkpt lat="50.320" lon="6.510"><ele>412.0</ele></trkpt>
      <trkpt lat="50.325" lon="6.520"><ele>420.0</ele></trkpt>
      <trkpt lat="50.330" lon="6.530"><ele>435.0</ele></trkpt>
      <trkpt lat="50.335" lon="6.540"><ele>428.0</ele></trkpt>
      <trkpt lat="50.340" lon="6.550"><ele>415.0</ele></trkpt>
      <trkpt lat="50.345" lon="6.560"><ele>408.0</ele></trkpt>
      <trkpt lat="50.350" lon="6.570"><ele>422.0</ele></trkpt>
      <trkpt lat="50.355" lon="6.580"><ele>445.0</ele></trkpt>
      <trkpt lat="50.360" lon="6.590"><ele>438.0</ele></trkpt>
      <trkpt lat="50.365" lon="6.600"><ele>425.0</ele></trkpt>
      <trkpt lat="50.370" lon="6.610"><ele>418.0</ele></trkpt>
    </trkseg>
  </trk>
</gpx>
```

- [ ] **`tests/fixtures/no_ele.gpx` erstellen**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="motoatlas" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>No Elevation</name><desc>Fehlt ele</desc></metadata>
  <trk><name>No Elevation</name><trkseg>
    <trkpt lat="50.320" lon="6.510"></trkpt>
    <trkpt lat="50.325" lon="6.520"></trkpt>
    <trkpt lat="50.330" lon="6.530"></trkpt>
    <trkpt lat="50.335" lon="6.540"></trkpt>
    <trkpt lat="50.340" lon="6.550"></trkpt>
    <trkpt lat="50.345" lon="6.560"></trkpt>
    <trkpt lat="50.350" lon="6.570"></trkpt>
    <trkpt lat="50.355" lon="6.580"></trkpt>
    <trkpt lat="50.360" lon="6.590"></trkpt>
    <trkpt lat="50.365" lon="6.600"></trkpt>
    <trkpt lat="50.370" lon="6.610"></trkpt>
  </trkseg></trk>
</gpx>
```

- [ ] **`tests/fixtures/out_of_bounds.gpx` erstellen**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="motoatlas" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>New York Route</name><desc>Außerhalb Europa</desc></metadata>
  <trk><name>New York Route</name><trkseg>
    <trkpt lat="40.710" lon="-74.010"><ele>10.0</ele></trkpt>
    <trkpt lat="40.715" lon="-74.005"><ele>12.0</ele></trkpt>
    <trkpt lat="40.720" lon="-74.000"><ele>11.0</ele></trkpt>
    <trkpt lat="40.725" lon="-73.995"><ele>13.0</ele></trkpt>
    <trkpt lat="40.730" lon="-73.990"><ele>10.0</ele></trkpt>
    <trkpt lat="40.735" lon="-73.985"><ele>11.0</ele></trkpt>
    <trkpt lat="40.740" lon="-73.980"><ele>12.0</ele></trkpt>
    <trkpt lat="40.745" lon="-73.975"><ele>10.0</ele></trkpt>
    <trkpt lat="40.750" lon="-73.970"><ele>11.0</ele></trkpt>
    <trkpt lat="40.755" lon="-73.965"><ele>13.0</ele></trkpt>
    <trkpt lat="40.760" lon="-73.960"><ele>10.0</ele></trkpt>
  </trkseg></trk>
</gpx>
```

- [ ] **`tests/fixtures/few_points.gpx` erstellen**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="motoatlas" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>Tiny Route</name><desc>Zu wenig Punkte</desc></metadata>
  <trk><name>Tiny Route</name><trkseg>
    <trkpt lat="50.320" lon="6.510"><ele>412.0</ele></trkpt>
    <trkpt lat="50.325" lon="6.520"><ele>420.0</ele></trkpt>
    <trkpt lat="50.330" lon="6.530"><ele>435.0</ele></trkpt>
  </trkseg></trk>
</gpx>
```

- [ ] **JSON-Fixtures erstellen**

`tests/fixtures/valid.json`:

```json
{
  "id": "de-test-eifel-route",
  "name": "Test Route Eifel",
  "country": "de",
  "region": "eifel",
  "type": "offroad",
  "source_url": "https://wikiloc.com/trails/test-123",
  "source_name": "Wikiloc",
  "modified": false,
  "modification_notes": ""
}
```

`tests/fixtures/minimal.json`:

```json
{
  "name": "Minimal Route",
  "country": "de",
  "source_url": "https://example.com/route",
  "source_name": "Wikiloc"
}
```

`tests/fixtures/missing_source.json`:

```json
{
  "name": "No Source Route",
  "country": "de"
}
```

- [ ] **Commit**

```bash
git add tests/
git commit -m "test: GPX und JSON Fixtures für Validierungs-Tests"
```

---

## Task 3: validate_gpx.py

**Files:**

- Create: `scripts/validate_gpx.py`
- Create: `tests/test_validate_gpx.py`

- [ ] **Failing Tests schreiben** — `tests/test_validate_gpx.py`

```python
import subprocess
import sys
from pathlib import Path

FIXTURES = Path(__file__).parent / "fixtures"
SCRIPT = Path(__file__).parent.parent / "scripts" / "validate_gpx.py"


def run(gpx: Path) -> tuple[int, str]:
    result = subprocess.run(
        [sys.executable, str(SCRIPT), str(gpx)],
        capture_output=True, text=True
    )
    return result.returncode, result.stdout + result.stderr


def test_valid_gpx_passes():
    code, out = run(FIXTURES / "valid.gpx")
    assert code == 0, f"Expected pass, got:\n{out}"


def test_no_elevation_fails():
    code, out = run(FIXTURES / "no_ele.gpx")
    assert code != 0
    assert "ele" in out.lower() or "elevation" in out.lower()


def test_out_of_bounds_fails():
    code, out = run(FIXTURES / "out_of_bounds.gpx")
    assert code != 0
    assert "bounds" in out.lower() or "europa" in out.lower()


def test_too_few_points_fails():
    code, out = run(FIXTURES / "few_points.gpx")
    assert code != 0
    assert "punkt" in out.lower() or "point" in out.lower()


def test_missing_metadata_name_fails(tmp_path):
    gpx = tmp_path / "no_name.gpx"
    gpx.write_text("""<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="motoatlas" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><name>OK</name><trkseg>
    <trkpt lat="50.32" lon="6.51"><ele>412.0</ele></trkpt>
    <trkpt lat="50.33" lon="6.52"><ele>420.0</ele></trkpt>
    <trkpt lat="50.34" lon="6.53"><ele>435.0</ele></trkpt>
    <trkpt lat="50.35" lon="6.54"><ele>428.0</ele></trkpt>
    <trkpt lat="50.36" lon="6.55"><ele>415.0</ele></trkpt>
    <trkpt lat="50.37" lon="6.56"><ele>408.0</ele></trkpt>
    <trkpt lat="50.38" lon="6.57"><ele>422.0</ele></trkpt>
    <trkpt lat="50.39" lon="6.58"><ele>445.0</ele></trkpt>
    <trkpt lat="50.40" lon="6.59"><ele>438.0</ele></trkpt>
    <trkpt lat="50.41" lon="6.60"><ele>425.0</ele></trkpt>
    <trkpt lat="50.42" lon="6.61"><ele>418.0</ele></trkpt>
  </trkseg></trk>
</gpx>""")
    code, out = run(gpx)
    assert code != 0
    assert "metadata" in out.lower() or "name" in out.lower()
```

- [ ] **Tests laufen — müssen fehlschlagen**

```bash
source .venv/bin/activate && pytest tests/test_validate_gpx.py -v
```

Expected: Fehler (Script existiert noch nicht).

- [ ] **`scripts/validate_gpx.py` implementieren**

```python
#!/usr/bin/env python3
"""GPX-Validierung für MotoAtlas CI/CD."""
import sys
from pathlib import Path
import gpxpy

EUROPE_BOUNDS = {"min_lat": 35.0, "max_lat": 72.0, "min_lon": -10.0, "max_lon": 32.0}
MIN_TRACK_POINTS = 10
MAX_FILE_SIZE_MB = 50


def validate(path: Path) -> list[str]:
    errors: list[str] = []

    if path.stat().st_size > MAX_FILE_SIZE_MB * 1024 * 1024:
        errors.append(f"Datei zu groß: {path.stat().st_size / 1024 / 1024:.1f}MB > {MAX_FILE_SIZE_MB}MB")
        return errors

    try:
        with open(path, encoding="utf-8") as f:
            gpx = gpxpy.parse(f)
    except Exception as e:
        errors.append(f"GPX nicht parsebar: {e}")
        return errors

    if not (gpx.name or (gpx.metadata and gpx.metadata.name)):
        errors.append("Kein <metadata><name> vorhanden — Pflichtfeld")
    if not (gpx.description or (gpx.metadata and gpx.metadata.description)):
        errors.append("Kein <metadata><desc> vorhanden — Pflichtfeld")

    if not gpx.tracks:
        errors.append("Keine <trk>-Elemente gefunden")
        return errors

    for idx, track in enumerate(gpx.tracks):
        points = [p for seg in track.segments for p in seg.points]

        if len(points) < MIN_TRACK_POINTS:
            errors.append(f"Track {idx}: {len(points)} Punkte — min. {MIN_TRACK_POINTS} erforderlich")

        missing = [i for i, p in enumerate(points) if p.elevation is None]
        if missing:
            errors.append(f"Track {idx}: {len(missing)} Trackpunkte ohne <ele> (z.B. Index {missing[0]})")

        oob = [
            p for p in points
            if not (
                EUROPE_BOUNDS["min_lat"] <= p.latitude <= EUROPE_BOUNDS["max_lat"]
                and EUROPE_BOUNDS["min_lon"] <= p.longitude <= EUROPE_BOUNDS["max_lon"]
            )
        ]
        if oob:
            errors.append(
                f"Track {idx}: {len(oob)} Punkte außerhalb Europa-Bounds "
                f"(z.B. lat={oob[0].latitude}, lon={oob[0].longitude})"
            )

    return errors


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: validate_gpx.py <file.gpx> [...]", file=sys.stderr)
        return 1

    all_ok = True
    for arg in sys.argv[1:]:
        path = Path(arg)
        if not path.exists():
            print(f"ERROR: nicht gefunden: {path}", file=sys.stderr)
            all_ok = False
            continue
        errors = validate(path)
        if errors:
            print(f"\n❌ {path.name}:")
            for e in errors:
                print(f"   • {e}")
            all_ok = False
        else:
            print(f"✅ {path.name}")

    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Tests laufen — müssen grün sein**

```bash
source .venv/bin/activate && pytest tests/test_validate_gpx.py -v
```

Expected: `5 passed`

- [ ] **Commit**

```bash
git add scripts/validate_gpx.py tests/test_validate_gpx.py
git commit -m "feat: validate_gpx.py — Schema, ele, bounds, min-Punkte"
```

---

## Task 4: validate_sidecar.py

**Files:**

- Create: `scripts/validate_sidecar.py`
- Create: `tests/test_validate_sidecar.py`

- [ ] **Failing Tests schreiben** — `tests/test_validate_sidecar.py`

```python
import subprocess, sys, json, tempfile
from pathlib import Path

FIXTURES = Path(__file__).parent / "fixtures"
SCRIPT = Path(__file__).parent.parent / "scripts" / "validate_sidecar.py"


def run(p: Path) -> tuple[int, str]:
    r = subprocess.run([sys.executable, str(SCRIPT), str(p)], capture_output=True, text=True)
    return r.returncode, r.stdout + r.stderr


def tmp_json(data: dict) -> Path:
    f = tempfile.NamedTemporaryFile(suffix=".json", mode="w", delete=False)
    json.dump(data, f)
    f.close()
    return Path(f.name)


def test_valid_passes():
    code, out = run(FIXTURES / "valid.json")
    assert code == 0, out


def test_minimal_passes():
    code, out = run(FIXTURES / "minimal.json")
    assert code == 0, out


def test_missing_source_fails():
    code, out = run(FIXTURES / "missing_source.json")
    assert code != 0
    assert "source_url" in out.lower() or "source" in out.lower()


def test_invalid_country_fails():
    p = tmp_json({"name": "X", "country": "xx", "source_url": "https://x.com", "source_name": "X"})
    code, out = run(p)
    p.unlink()
    assert code != 0
    assert "country" in out.lower()


def test_missing_name_fails():
    p = tmp_json({"country": "de", "source_url": "https://x.com", "source_name": "X"})
    code, out = run(p)
    p.unlink()
    assert code != 0
    assert "name" in out.lower()
```

- [ ] **Tests laufen — müssen fehlschlagen**

```bash
source .venv/bin/activate && pytest tests/test_validate_sidecar.py -v
```

- [ ] **`scripts/validate_sidecar.py` implementieren**

```python
#!/usr/bin/env python3
"""JSON-Sidecar-Validierung für MotoAtlas CI/CD."""
import sys, json
from pathlib import Path

REQUIRED = {"name", "country", "source_url", "source_name"}
VALID_COUNTRIES = {"de", "be", "nl", "fr", "it"}
VALID_TYPES = {"offroad", "touring", "scenic"}


def validate(path: Path) -> list[str]:
    errors: list[str] = []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        return [f"JSON nicht parsebar: {e}"]

    for field in REQUIRED:
        if field not in data or not data[field]:
            errors.append(f"Pflichtfeld fehlt oder leer: '{field}'")

    if "country" in data and data["country"] not in VALID_COUNTRIES:
        errors.append(f"Ungültiges country '{data['country']}' — erlaubt: {', '.join(sorted(VALID_COUNTRIES))}")

    if "type" in data and data["type"] not in VALID_TYPES:
        errors.append(f"Ungültiger type '{data['type']}' — erlaubt: {', '.join(sorted(VALID_TYPES))}")

    if data.get("modified") and not data.get("modification_notes"):
        errors.append("modified=true aber modification_notes ist leer")

    return errors


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: validate_sidecar.py <file.json> [...]", file=sys.stderr)
        return 1
    all_ok = True
    for arg in sys.argv[1:]:
        path = Path(arg)
        if not path.exists():
            print(f"ERROR: nicht gefunden: {path}", file=sys.stderr)
            all_ok = False
            continue
        errors = validate(path)
        if errors:
            print(f"\n❌ {path.name}:")
            for e in errors:
                print(f"   • {e}")
            all_ok = False
        else:
            print(f"✅ {path.name}")
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Tests grün**

```bash
source .venv/bin/activate && pytest tests/test_validate_sidecar.py -v
```

Expected: `5 passed`

- [ ] **Commit**

```bash
git add scripts/validate_sidecar.py tests/test_validate_sidecar.py
git commit -m "feat: validate_sidecar.py — Pflichtfelder, country, type"
```

---

## Task 5: check_duplicates.py

**Files:**

- Create: `scripts/check_duplicates.py`
- Create: `tests/test_check_duplicates.py`

- [ ] **Failing Tests schreiben** — `tests/test_check_duplicates.py`

```python
import json, sys, subprocess, tempfile
from pathlib import Path

SCRIPT = Path(__file__).parent.parent / "scripts" / "check_duplicates.py"
FIXTURES = Path(__file__).parent / "fixtures"


def catalog(routes: list) -> Path:
    p = Path(tempfile.mktemp(suffix=".json"))
    p.write_text(json.dumps({"routes": routes, "drafts": []}))
    return p


def run(gpx: Path, cat: Path) -> tuple[int, str]:
    r = subprocess.run(
        [sys.executable, str(SCRIPT), str(gpx), "--catalog", str(cat)],
        capture_output=True, text=True
    )
    return r.returncode, r.stdout + r.stderr


def test_no_duplicate_passes(tmp_path):
    cat = catalog([{"id": "other", "bounds": {"north": 48.0, "south": 47.0, "east": 10.0, "west": 9.0}}])
    code, out = run(FIXTURES / "valid.gpx", cat)
    cat.unlink()
    assert code == 0, out


def test_duplicate_fails(tmp_path):
    # valid.gpx centroid ~50.345, 6.56 — place existing route right on top
    cat = catalog([{"id": "existing", "bounds": {"north": 50.37, "south": 50.32, "east": 6.60, "west": 6.51}}])
    code, out = run(FIXTURES / "valid.gpx", cat)
    cat.unlink()
    assert code != 0
    assert "existing" in out or "duplikat" in out.lower()


def test_empty_catalog_passes():
    cat = catalog([])
    code, out = run(FIXTURES / "valid.gpx", cat)
    cat.unlink()
    assert code == 0, out
```

- [ ] **Tests laufen — müssen fehlschlagen**

```bash
source .venv/bin/activate && pytest tests/test_check_duplicates.py -v
```

- [ ] **`scripts/check_duplicates.py` implementieren**

```python
#!/usr/bin/env python3
"""Duplikat-Check gegen catalog.json via Haversine-Schwerpunkt."""
import sys, json, math, argparse
from pathlib import Path
import gpxpy

THRESHOLD_KM = 0.5


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def gpx_centroid(path: Path) -> tuple[float, float]:
    with open(path, encoding="utf-8") as f:
        gpx = gpxpy.parse(f)
    pts = [p for t in gpx.tracks for s in t.segments for p in s.points]
    if not pts:
        return 0.0, 0.0
    return sum(p.latitude for p in pts) / len(pts), sum(p.longitude for p in pts) / len(pts)


def bounds_centroid(entry: dict) -> tuple[float, float] | None:
    b = entry.get("bounds")
    if not b:
        return None
    return (b["north"] + b["south"]) / 2, (b["east"] + b["west"]) / 2


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("gpx_file")
    parser.add_argument("--catalog", default="catalog.json")
    args = parser.parse_args()

    cat_path = Path(args.catalog)
    if not cat_path.exists():
        print(f"✅ {Path(args.gpx_file).name} (kein Katalog — kein Duplikat-Check)")
        return 0

    lat, lon = gpx_centroid(Path(args.gpx_file))
    catalog = json.loads(cat_path.read_text(encoding="utf-8"))
    for entry in catalog.get("routes", []) + catalog.get("drafts", []):
        c = bounds_centroid(entry)
        if c and haversine(lat, lon, c[0], c[1]) < THRESHOLD_KM:
            print(f"❌ Mögliches Duplikat von '{entry['id']}' (Distanz < {THRESHOLD_KM}km)")
            return 1

    print(f"✅ {Path(args.gpx_file).name} (kein Duplikat)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Tests grün**

```bash
source .venv/bin/activate && pytest tests/test_check_duplicates.py -v
```

Expected: `3 passed`

- [ ] **Commit**

```bash
git add scripts/check_duplicates.py tests/test_check_duplicates.py
git commit -m "feat: check_duplicates.py — Haversine-Duplikat-Check"
```

---

## Task 6: build_catalog.py

**Files:**

- Create: `scripts/build_catalog.py`
- Create: `tests/test_build_catalog.py`

- [ ] **Failing Tests schreiben** — `tests/test_build_catalog.py`

```python
import json, subprocess, sys
from pathlib import Path
import shutil

SCRIPT = Path(__file__).parent.parent / "scripts" / "build_catalog.py"
FIXTURES = Path(__file__).parent / "fixtures"


def run(root: Path) -> tuple[int, str]:
    r = subprocess.run([sys.executable, str(SCRIPT), "--root", str(root)], capture_output=True, text=True)
    return r.returncode, r.stdout + r.stderr


def make_repo(tmp: Path) -> Path:
    (tmp / "routes/de/offroad").mkdir(parents=True)
    (tmp / "drafts/de").mkdir(parents=True)
    shutil.copy(FIXTURES / "valid.gpx", tmp / "routes/de/offroad/de-test.gpx")
    (tmp / "routes/de/offroad/de-test.json").write_text(json.dumps({
        "id": "de-test", "name": "Test", "country": "de", "region": "eifel",
        "type": "offroad", "source_url": "https://x.com", "source_name": "X",
        "rating": 4.5, "distance_km": 42,
        "bounds": {"north": 50.4, "south": 50.3, "east": 6.6, "west": 6.5}
    }))
    shutil.copy(FIXTURES / "valid.gpx", tmp / "drafts/de/draft.gpx")
    (tmp / "drafts/de/draft.json").write_text(json.dumps({
        "name": "Draft", "country": "de", "source_url": "https://x.com", "source_name": "X"
    }))
    return tmp


def test_contains_live_route(tmp_path):
    make_repo(tmp_path)
    code, out = run(tmp_path)
    assert code == 0, out
    cat = json.loads((tmp_path / "catalog.json").read_text())
    assert cat["total"] == 1
    assert any(r["id"] == "de-test" for r in cat["routes"])


def test_contains_draft(tmp_path):
    make_repo(tmp_path)
    run(tmp_path)
    cat = json.loads((tmp_path / "catalog.json").read_text())
    assert len(cat["drafts"]) == 1


def test_collections_built(tmp_path):
    make_repo(tmp_path)
    run(tmp_path)
    cat = json.loads((tmp_path / "catalog.json").read_text())
    de_offroad = next((c for c in cat["collections"] if c["id"] == "de-offroad"), None)
    assert de_offroad is not None and de_offroad["count"] == 1


def test_generated_at_present(tmp_path):
    make_repo(tmp_path)
    run(tmp_path)
    cat = json.loads((tmp_path / "catalog.json").read_text())
    assert "generated_at" in cat
```

- [ ] **Tests laufen — müssen fehlschlagen**

```bash
source .venv/bin/activate && pytest tests/test_build_catalog.py -v
```

- [ ] **`scripts/build_catalog.py` implementieren**

```python
#!/usr/bin/env python3
"""Generiert catalog.json aus allen GPX-JSON-Sidecar-Paaren."""
import sys, json, argparse
from pathlib import Path
from datetime import datetime, timezone

COUNTRIES = ["de", "be", "nl", "fr", "it"]
TYPES = ["offroad", "touring", "scenic"]


def load_sidecars(folder: Path, status: str, repo_root: Path) -> list[dict]:
    entries = []
    for jp in sorted(folder.rglob("*.json")):
        if jp.name.startswith("."):
            continue
        try:
            data = json.loads(jp.read_text(encoding="utf-8"))
        except Exception:
            continue
        data["status"] = status
        if "id" not in data:
            data["id"] = jp.stem
        gpx = jp.with_suffix(".gpx")
        if gpx.exists():
            data["gpx_url"] = str(gpx.relative_to(repo_root))
        entries.append(data)
    return entries


def build_collections(routes: list[dict]) -> list[dict]:
    cols: list[dict] = []
    for c in COUNTRIES:
        for t in TYPES:
            m = [r for r in routes if r.get("country") == c and r.get("type") == t]
            if m:
                cols.append({"id": f"{c}-{t}", "name": f"{c.upper()} {t.capitalize()}", "count": len(m), "zip_url": f"collections/{c}-{t}.zip"})
    offroad = [r for r in routes if r.get("type") == "offroad"]
    if offroad:
        cols.append({"id": "all-offroad", "name": "Alle Offroad", "count": len(offroad), "zip_url": "collections/all-offroad.zip"})
    cols.append({"id": "all-routes", "name": "Alle Routen", "count": len(routes), "zip_url": "collections/all-routes.zip"})
    return cols


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".")
    args = parser.parse_args()
    root = Path(args.root)

    live = load_sidecars(root / "routes", "live", root) if (root / "routes").exists() else []
    drafts = load_sidecars(root / "drafts", "draft", root) if (root / "drafts").exists() else []

    catalog = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total": len(live),
        "routes": live,
        "drafts": drafts,
        "collections": build_collections(live),
    }
    (root / "catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"✅ catalog.json: {len(live)} Routen, {len(drafts)} Drafts")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Alle Tests zusammen grün**

```bash
source .venv/bin/activate && pytest tests/ -v
```

Expected: `17 passed`

- [ ] **Commit**

```bash
git add scripts/build_catalog.py tests/test_build_catalog.py
git commit -m "feat: build_catalog.py — catalog.json aus Sidecars"
```

---

## Task 7: Helper-Scripts

**Files:**

- Create: `scripts/collect.sh`
- Create: `scripts/promote.sh`
- Create: `scripts/archive.sh`

- [ ] **`scripts/collect.sh` erstellen**

```bash
#!/usr/bin/env bash
set -euo pipefail

usage() { echo "Usage: $0 <url-or-path> --country <de|be|nl|fr|it> [--type <offroad|touring|scenic>]"; exit 1; }

SOURCE="" COUNTRY="" TYPE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --country) COUNTRY="$2"; shift 2 ;;
    --type)    TYPE="$2"; shift 2 ;;
    --*)       usage ;;
    *)         SOURCE="$1"; shift ;;
  esac
done
[[ -z "$SOURCE" || -z "$COUNTRY" ]] && usage
[[ ! " de be nl fr it " == *" $COUNTRY "* ]] && { echo "Ungültiges country: $COUNTRY"; exit 1; }

TARGET="drafts/$COUNTRY"
mkdir -p "$TARGET"

if [[ "$SOURCE" == http* ]]; then
  FILENAME=$(basename "$SOURCE" | sed 's/[^a-zA-Z0-9._-]/-/g')
  [[ "$FILENAME" != *.gpx ]] && FILENAME="${FILENAME}.gpx"
  curl -fsSL "$SOURCE" -o "$TARGET/$FILENAME"
else
  FILENAME=$(basename "$SOURCE")
  cp "$SOURCE" "$TARGET/$FILENAME"
fi

BASE="${FILENAME%.gpx}"
JPATH="$TARGET/${BASE}.json"

if [[ ! -f "$JPATH" ]]; then
  python3 - "$JPATH" "$BASE" "$COUNTRY" "$SOURCE" "$TYPE" <<'PYEOF'
import json, sys
out, name, country, src, t = sys.argv[1:]
d = {"name": name, "country": country, "source_url": src, "source_name": "Manuell"}
if t: d["type"] = t
open(out, "w").write(json.dumps(d, indent=2))
PYEOF
fi

echo "✅ $TARGET/$FILENAME"
echo "   Bearbeite: $JPATH"
echo "   Dann: git add $TARGET && git push → PR öffnen"
```

- [ ] **`scripts/promote.sh` erstellen**

```bash
#!/usr/bin/env bash
set -euo pipefail
[[ $# -lt 1 ]] && { echo "Usage: $0 <drafts/country/route.gpx>"; exit 1; }
GPX="$1"; JSON="${GPX%.gpx}.json"
[[ ! -f "$GPX" ]] && { echo "Nicht gefunden: $GPX"; exit 1; }
[[ ! -f "$JSON" ]] && { echo "Sidecar fehlt: $JSON"; exit 1; }
COUNTRY=$(python3 -c "import json; print(json.load(open('$JSON')).get('country',''))")
TYPE=$(python3 -c "import json; print(json.load(open('$JSON')).get('type','touring'))")
[[ -z "$COUNTRY" ]] && { echo "Kein 'country' im Sidecar"; exit 1; }
TARGET="routes/$COUNTRY/$TYPE"
mkdir -p "$TARGET"
mv "$GPX" "$TARGET/" && mv "$JSON" "$TARGET/"
echo "✅ Promoted → $TARGET/"
```

- [ ] **`scripts/archive.sh` erstellen**

```bash
#!/usr/bin/env bash
set -euo pipefail
[[ $# -lt 1 ]] && { echo "Usage: $0 <route.gpx> [\"Grund\"]"; exit 1; }
GPX="$1"; REASON="${2:-}"; JSON="${GPX%.gpx}.json"
[[ ! -f "$GPX" ]] && { echo "Nicht gefunden: $GPX"; exit 1; }
COUNTRY=$(echo "$GPX" | grep -oE '/(de|be|nl|fr|it)/' | tr -d '/' | head -1)
[[ -z "$COUNTRY" && -f "$JSON" ]] && \
  COUNTRY=$(python3 -c "import json; print(json.load(open('$JSON')).get('country','de'))" 2>/dev/null) || true
[[ -z "$COUNTRY" ]] && COUNTRY="de"
mkdir -p "archive/$COUNTRY"
mv "$GPX" "archive/$COUNTRY/" && { [[ -f "$JSON" ]] && mv "$JSON" "archive/$COUNTRY/"; }
echo "✅ Archiviert → archive/$COUNTRY/"
[[ -n "$REASON" ]] && echo "   Grund: $REASON"
```

- [ ] **Scripts ausführbar machen**

```bash
chmod +x scripts/collect.sh scripts/promote.sh scripts/archive.sh
```

- [ ] **Commit**

```bash
git add scripts/collect.sh scripts/promote.sh scripts/archive.sh
git commit -m "feat: collect/promote/archive Shell-Scripts"
```

---

## Task 8: GitHub Actions

**Files:**

- Create: `.github/workflows/validate.yml`
- Create: `.github/workflows/build-deploy.yml`

- [ ] **`.github/workflows/validate.yml` erstellen**

```yaml
name: Validate GPX Routes

on:
  pull_request:
    paths:
      - "routes/**"
      - "drafts/**"

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: "pip"

      - run: pip install -r requirements.txt

      - name: Find changed GPX files
        id: gpx
        run: |
          FILES=$(git diff --name-only origin/${{ github.base_ref }}...HEAD | grep '\.gpx$' || true)
          echo "files<<EOF" >> $GITHUB_OUTPUT
          echo "$FILES" >> $GITHUB_OUTPUT
          echo "EOF" >> $GITHUB_OUTPUT

      - name: Validate GPX
        if: steps.gpx.outputs.files != ''
        run: echo "${{ steps.gpx.outputs.files }}" | xargs python scripts/validate_gpx.py

      - name: Validate JSON sidecars
        if: steps.gpx.outputs.files != ''
        run: |
          echo "${{ steps.gpx.outputs.files }}" | sed 's/\.gpx$/.json/' | xargs python scripts/validate_sidecar.py

      - name: Check duplicates
        if: steps.gpx.outputs.files != ''
        run: |
          python scripts/build_catalog.py
          echo "${{ steps.gpx.outputs.files }}" | while read gpx; do
            [ -n "$gpx" ] && python scripts/check_duplicates.py "$gpx" --catalog catalog.json
          done
```

- [ ] **`.github/workflows/build-deploy.yml` erstellen**

```yaml
name: Build and Deploy

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: "pip"

      - run: pip install -r requirements.txt

      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - uses: pnpm/action-setup@v4
        with:
          version: latest

      - run: pnpm install

      - name: Build catalog.json
        run: python scripts/build_catalog.py

      - name: Build Scenic ZIP collections
        run: |
          mkdir -p collections
          python3 - <<'PYEOF'
          import json, zipfile
          from pathlib import Path
          routes = json.loads(Path("catalog.json").read_text())["routes"]

          def zzip(name, subset):
              if not subset: return
              with zipfile.ZipFile(f"collections/{name}.zip", "w") as z:
                  for r in subset:
                      p = Path(r.get("gpx_url", ""))
                      if p.exists(): z.write(p, p.name)

          for c in ["de","be","nl","fr","it"]:
              for t in ["offroad","touring","scenic"]:
                  zzip(f"{c}-{t}", [r for r in routes if r.get("country")==c and r.get("type")==t])
          zzip("all-offroad", [r for r in routes if r.get("type")=="offroad"])
          zzip("all-routes", routes)
          print("✅ Collections gebaut")
          PYEOF

      - name: Vite build
        run: pnpm build

      - name: Copy assets to dist
        run: |
          cp catalog.json dist/
          [ -d routes ] && cp -r routes dist/ || true
          [ -d collections ] && cp -r collections dist/ || true

      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist/

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/deploy-pages@v4
        id: deployment
```

- [ ] **Commit**

```bash
git add .github/
git commit -m "ci: validate.yml + build-deploy.yml"
```

---

## Task 9: Frontend

**Files:**

- Create: `index.html`
- Create: `src/main.js`
- Create: `src/catalog.js`
- Create: `src/filter.js`
- Create: `src/style.css`

- [ ] **`index.html` erstellen (Repo-Root)**

```html
<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#c4501e" />
    <title>MotoAtlas — Motorrad-Routen DE, BE, NL, FR, IT</title>
    <meta
      name="description"
      content="Kuratierte Motorrad-GPX-Routen — direkt importierbar in Scenic."
    />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link
      href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,700;0,9..144,900;1,9..144,400&family=JetBrains+Mono:wght@400;600&family=Lato:wght@300;400&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="/src/style.css" />
  </head>
  <body>
    <nav id="nav">
      <div class="nav-logo">Moto<span>Atlas</span></div>
      <div class="nav-links">
        <a href="#/">Routen</a>
        <a href="#/map">Karte</a>
      </div>
    </nav>

    <section class="hero">
      <div class="hero-eyebrow">Motorrad · Offroad · 5 Länder</div>
      <h1>Die <em>besten</em><br />Routen.<br />Kuratiert.</h1>
      <p class="hero-desc">
        Offroad-Tracks und Touren für DE, BE, NL, FR und IT — agent-reviewed,
        direkt in Scenic importierbar.
      </p>
      <div class="hero-stats">
        <div class="stat">
          <div class="stat-num" id="stat-routes">–</div>
          <div class="stat-label">Routen</div>
        </div>
        <div class="stat">
          <div class="stat-num" id="stat-km">–</div>
          <div class="stat-label">Kilometer</div>
        </div>
        <div class="stat">
          <div class="stat-num">5</div>
          <div class="stat-label">Länder</div>
        </div>
      </div>
    </section>

    <section class="catalog-section">
      <div class="section-header">
        <h2 class="section-title">Routen</h2>
      </div>
      <div class="country-tabs" id="country-tabs"></div>
      <div class="route-grid" id="route-grid">
        <div class="loading">Lade Routen…</div>
      </div>
    </section>

    <section class="drafts-section" id="drafts-section" style="display:none">
      <div class="section-header">
        <h2 class="section-title">In Bearbeitung</h2>
        <span class="section-sub" id="draft-count"></span>
      </div>
      <div class="route-grid" id="draft-grid"></div>
    </section>

    <section class="collections-section">
      <h2 class="section-title">Scenic Collections</h2>
      <p class="section-sub" style="margin-bottom:24px">
        ZIP-Downloads direkt in Scenic importierbar
      </p>
      <div class="collections-grid" id="collections-grid"></div>
    </section>

    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

- [ ] **`src/filter.js` erstellen**

```js
const COUNTRIES = [
  { id: "all", label: "Alle", flag: "🌍" },
  { id: "de", label: "Deutschland", flag: "🇩🇪" },
  { id: "be", label: "Belgien", flag: "🇧🇪" },
  { id: "nl", label: "Niederlande", flag: "🇳🇱" },
  { id: "fr", label: "Frankreich", flag: "🇫🇷" },
  { id: "it", label: "Italien", flag: "🇮🇹" },
];

let state = { country: "all" };
const listeners = new Set();

export function getFilter() {
  return { ...state };
}

export function setFilter(patch) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn(state));
}

export function onFilterChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function filterRoutes(routes) {
  return routes.filter(
    (r) => state.country === "all" || r.country === state.country,
  );
}

export function renderCountryTabs(container, routes) {
  container.textContent = "";
  COUNTRIES.forEach((c) => {
    const count =
      c.id === "all"
        ? routes.length
        : routes.filter((r) => r.country === c.id).length;
    if (count === 0 && c.id !== "all") return;
    const btn = document.createElement("button");
    btn.className = "country-tab" + (state.country === c.id ? " active" : "");

    const flagSpan = document.createElement("span");
    flagSpan.className = "flag";
    flagSpan.textContent = c.flag;

    const countSpan = document.createElement("span");
    countSpan.className = "count";
    countSpan.textContent = `·${count}`;

    btn.appendChild(flagSpan);
    btn.append(` ${c.label} `);
    btn.appendChild(countSpan);

    btn.addEventListener("click", () => {
      setFilter({ country: c.id });
      renderCountryTabs(container, routes);
    });
    container.appendChild(btn);
  });
}
```

- [ ] **`src/catalog.js` erstellen**

Verwendet `textContent` und DOM-API für alle Benutzerdaten — kein `innerHTML` mit externem Inhalt.

```js
import { filterRoutes, renderCountryTabs, onFilterChange } from "./filter.js";

const TYPE_COLOR = {
  offroad: "#c4501e",
  touring: "#2d5016",
  scenic: "#d4882a",
};

function animCount(el, target) {
  let start = null;
  const step = (ts) => {
    if (!start) start = ts;
    const p = Math.min((ts - start) / 1600, 1);
    el.textContent = Math.floor(p * target);
    if (p < 1) requestAnimationFrame(step);
  };
  setTimeout(() => requestAnimationFrame(step), 300);
}

function starsText(rating) {
  const n = Math.round(rating);
  return "★".repeat(n) + "☆".repeat(5 - n);
}

function el(tag, cls) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

function renderCard(route) {
  const isDraft = route.status === "draft";
  const color = TYPE_COLOR[route.type] || "#9b8b6e";

  const card = el("div", "route-card" + (isDraft ? " draft" : ""));
  card.style.setProperty("--card-color", color);

  const bar = el("div", "card-top-bar");
  card.appendChild(bar);

  const body = el("div", "card-body");

  const country = el("div", "card-country");
  country.textContent = `${(route.country || "").toUpperCase()} · ${route.region || "–"}`;
  body.appendChild(country);

  const title = el("div", "card-title");
  title.textContent = route.name || "–";
  body.appendChild(title);

  if (isDraft) {
    const badge = el("div", "draft-badge");
    badge.textContent = "Draft · wird bewertet…";
    body.appendChild(badge);
  }

  if (route.agent_review) {
    const desc = el("div", "card-desc");
    desc.textContent = route.agent_review;
    body.appendChild(desc);
  }

  const meta = el("div", "card-meta");
  if (route.distance_km) {
    const mi = el("div", "card-meta-item");
    const val = el("span", "card-meta-val");
    val.textContent = route.distance_km;
    const key = el("span", "card-meta-key");
    key.textContent = "km";
    mi.appendChild(val);
    mi.appendChild(key);
    meta.appendChild(mi);
  }
  if (route.elevation_gain_m) {
    const mi = el("div", "card-meta-item");
    const val = el("span", "card-meta-val");
    val.textContent = route.elevation_gain_m;
    const key = el("span", "card-meta-key");
    key.textContent = "Hm";
    mi.appendChild(val);
    mi.appendChild(key);
    meta.appendChild(mi);
  }
  if (route.rating) {
    const rating = el("div", "card-rating");
    const stars = el("span", "stars");
    stars.textContent = starsText(route.rating);
    const rval = el("span", "rating-val");
    rval.textContent = route.rating;
    rating.appendChild(stars);
    rating.appendChild(rval);
    meta.appendChild(rating);
  }
  body.appendChild(meta);
  card.appendChild(body);

  if (!isDraft && route.gpx_url) {
    const footer = el("div", "card-footer");
    const btn = el("button", "card-btn primary");
    btn.textContent = "↓ GPX";
    btn.addEventListener("click", () => {
      window.open("/" + route.gpx_url);
    });
    footer.appendChild(btn);
    card.appendChild(footer);
  }

  return card;
}

function renderCollections(collections, container) {
  container.textContent = "";
  collections
    .filter((c) => c.id !== "all-routes")
    .forEach((col) => {
      const card = el("div", "collection-card");
      const name = el("div", "col-name");
      name.textContent = col.name;
      const count = el("div", "col-count");
      count.textContent = `${col.count} Routen`;
      const btn = el("button", "card-btn primary");
      btn.textContent = "↓ ZIP";
      btn.addEventListener("click", () => {
        window.open("/" + col.zip_url);
      });
      card.appendChild(name);
      card.appendChild(count);
      card.appendChild(btn);
      container.appendChild(card);
    });
}

export async function loadCatalog() {
  const res = await fetch("/catalog.json");
  if (!res.ok) throw new Error(`catalog.json nicht gefunden (${res.status})`);
  return res.json();
}

export function initCatalog(catalog) {
  const { routes = [], drafts = [], collections = [] } = catalog;

  const statRoutes = document.getElementById("stat-routes");
  const statKm = document.getElementById("stat-km");
  if (statRoutes) animCount(statRoutes, routes.length);
  if (statKm)
    animCount(
      statKm,
      routes.reduce((s, r) => s + (r.distance_km || 0), 0),
    );

  const collectionsGrid = document.getElementById("collections-grid");
  if (collectionsGrid) renderCollections(collections, collectionsGrid);

  const draftsSection = document.getElementById("drafts-section");
  const draftGrid = document.getElementById("draft-grid");
  const draftCount = document.getElementById("draft-count");
  if (drafts.length > 0 && draftsSection) {
    draftsSection.style.display = "";
    if (draftCount)
      draftCount.textContent = `${drafts.length} Routen warten auf Review`;
    if (draftGrid) drafts.forEach((d) => draftGrid.appendChild(renderCard(d)));
  }

  const grid = document.getElementById("route-grid");
  const tabs = document.getElementById("country-tabs");

  const render = () => {
    if (!grid) return;
    grid.textContent = "";
    const filtered = filterRoutes(routes);
    if (!filtered.length) {
      const msg = el("div", "loading");
      msg.textContent = "Keine Routen für diesen Filter.";
      grid.appendChild(msg);
      return;
    }
    filtered.forEach((r) => grid.appendChild(renderCard(r)));
  };

  if (tabs) {
    renderCountryTabs(tabs, routes);
    onFilterChange(() => {
      render();
      renderCountryTabs(tabs, routes);
    });
  }
  render();
}
```

- [ ] **`src/main.js` erstellen**

```js
import { loadCatalog, initCatalog } from "./catalog.js";

async function init() {
  try {
    const catalog = await loadCatalog();
    initCatalog(catalog);
  } catch (err) {
    const grid = document.getElementById("route-grid");
    if (grid) {
      grid.textContent = "";
      const msg = document.createElement("div");
      msg.className = "loading";
      msg.textContent = `Fehler: ${err.message}`;
      grid.appendChild(msg);
    }
    console.error(err);
  }
}

init();
```

- [ ] **`src/style.css` erstellen**

```css
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
:root {
  --cream: #f5efe0;
  --parchment: #ede0c4;
  --ink: #1c1208;
  --terracotta: #c4501e;
  --amber: #d4882a;
  --forest: #2d5016;
  --dust: #9b8b6e;
  --paper: #faf6ec;
  --border: rgba(155, 139, 110, 0.25);
}
body {
  background: var(--cream);
  color: var(--ink);
  font-family: "Lato", sans-serif;
  font-weight: 300;
}

nav {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 32px;
  background: rgba(245, 239, 224, 0.92);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border);
}
.nav-logo {
  font-family: "Fraunces", serif;
  font-weight: 900;
  font-size: 22px;
}
.nav-logo span {
  color: var(--terracotta);
  font-style: italic;
}
.nav-links {
  display: flex;
  gap: 24px;
}
.nav-links a {
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--dust);
  text-decoration: none;
  transition: color 0.2s;
}
.nav-links a:hover {
  color: var(--terracotta);
}

.hero {
  padding: 64px 64px 48px;
}
.hero-eyebrow {
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--terracotta);
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.hero-eyebrow::before {
  content: "";
  display: block;
  width: 28px;
  height: 1px;
  background: var(--terracotta);
}
h1 {
  font-family: "Fraunces", serif;
  font-weight: 900;
  font-size: clamp(48px, 6vw, 80px);
  line-height: 0.95;
  letter-spacing: -2px;
  margin-bottom: 24px;
}
h1 em {
  font-style: italic;
  font-weight: 300;
  color: var(--terracotta);
}
.hero-desc {
  font-size: 16px;
  line-height: 1.7;
  color: var(--dust);
  max-width: 520px;
  margin-bottom: 36px;
}
.hero-stats {
  display: flex;
  gap: 32px;
  padding-top: 28px;
  border-top: 1px solid var(--border);
}
.stat-num {
  font-family: "Fraunces", serif;
  font-size: 32px;
  font-weight: 700;
  line-height: 1;
}
.stat-label {
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--dust);
  margin-top: 4px;
}

.catalog-section,
.drafts-section,
.collections-section {
  padding: 56px 64px;
}
.catalog-section {
  background: var(--parchment);
}
.section-header {
  display: flex;
  align-items: baseline;
  gap: 16px;
  margin-bottom: 32px;
}
.section-title {
  font-family: "Fraunces", serif;
  font-size: 36px;
  font-weight: 900;
  letter-spacing: -1px;
}
.section-sub {
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--dust);
}

.country-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 40px;
}
.country-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 16px;
  border: 1px solid var(--border);
  background: transparent;
  cursor: pointer;
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--dust);
  transition: all 0.2s;
}
.country-tab:hover {
  border-color: var(--terracotta);
  color: var(--ink);
}
.country-tab.active {
  background: var(--ink);
  color: var(--cream);
  border-color: var(--ink);
}
.country-tab .flag {
  font-size: 15px;
}
.country-tab .count {
  opacity: 0.6;
  font-size: 10px;
}

.route-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}
.loading {
  color: var(--dust);
  font-family: "JetBrains Mono", monospace;
  font-size: 12px;
  padding: 40px;
}

.route-card {
  background: var(--paper);
  border: 1px solid var(--border);
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}
.route-card:hover {
  transform: translateY(-3px) rotate(-0.2deg);
  box-shadow: 4px 8px 24px rgba(28, 18, 8, 0.1);
}
.route-card.draft {
  opacity: 0.65;
}
.card-top-bar {
  height: 4px;
  background: var(--card-color, var(--terracotta));
}
.card-body {
  padding: 16px;
}
.card-country {
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--terracotta);
  margin-bottom: 6px;
}
.card-title {
  font-family: "Fraunces", serif;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.2;
  margin-bottom: 8px;
}
.card-desc {
  font-size: 12px;
  line-height: 1.6;
  color: var(--dust);
  margin-bottom: 12px;
}
.draft-badge {
  font-family: "JetBrains Mono", monospace;
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  background: var(--amber);
  color: white;
  padding: 2px 6px;
  display: inline-block;
  margin-bottom: 8px;
}
.card-meta {
  display: flex;
  gap: 16px;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
.card-meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.card-meta-val {
  font-family: "Fraunces", serif;
  font-size: 20px;
  font-weight: 700;
  line-height: 1;
}
.card-meta-key {
  font-family: "JetBrains Mono", monospace;
  font-size: 9px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--dust);
}
.card-rating {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 4px;
}
.stars {
  color: var(--amber);
  font-size: 12px;
  letter-spacing: -1px;
}
.rating-val {
  font-family: "Fraunces", serif;
  font-size: 18px;
  font-weight: 700;
}
.card-footer {
  padding: 10px 16px;
  background: rgba(155, 139, 110, 0.05);
  border-top: 1px solid var(--border);
}
.card-btn {
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 7px 12px;
  border: 1px solid var(--border);
  background: transparent;
  cursor: pointer;
  color: var(--dust);
  transition: all 0.2s;
}
.card-btn.primary {
  background: var(--ink);
  color: var(--cream);
  border-color: var(--ink);
}
.card-btn.primary:hover {
  background: var(--terracotta);
  border-color: var(--terracotta);
}

.collections-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}
.collection-card {
  background: var(--paper);
  border: 1px solid var(--border);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.col-name {
  font-family: "Fraunces", serif;
  font-size: 16px;
  font-weight: 700;
}
.col-count {
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  color: var(--dust);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
```

- [ ] **Dev-Server starten**

```bash
pnpm dev
```

Expected: http://localhost:5173 lädt, zeigt "Fehler: catalog.json nicht gefunden (404)"

- [ ] **Lokalen Katalog generieren + nochmals prüfen**

```bash
source .venv/bin/activate && python scripts/build_catalog.py
pnpm dev
```

Expected: Site zeigt "Keine Routen für diesen Filter." (leerer Katalog korrekt).

- [ ] **Commit**

```bash
git add index.html src/
git commit -m "feat: Frontend — catalog.js, filter.js, MotoAtlas Theme"
```

---

## Task 10: Erste Route + End-to-End

**Files:**

- Create: `routes/de/offroad/de-eifel-volcanic-route.gpx`
- Create: `routes/de/offroad/de-eifel-volcanic-route.json`

- [ ] **Erste Route anlegen**

```bash
cp tests/fixtures/valid.gpx routes/de/offroad/de-eifel-volcanic-route.gpx
```

`routes/de/offroad/de-eifel-volcanic-route.json`:

```json
{
  "id": "de-eifel-volcanic-route",
  "name": "Volcanic Route Eifel",
  "country": "de",
  "region": "eifel",
  "type": "offroad",
  "source_url": "https://transeurotrail.org/germany/",
  "source_name": "Trans Euro Trail",
  "modified": false,
  "modification_notes": "",
  "rating": 4.8,
  "rating_source": "manual",
  "agent_review": "Klassischer Offroad-Einstieg in der Vulkaneifel — Schotterpisten zwischen Vulkankegeln, ruhige Waldwege und grandioser Blick auf den Laacher See.",
  "distance_km": 142,
  "elevation_gain_m": 1840,
  "difficulty": 3,
  "surface": "mixed",
  "offroad_pct": 40,
  "added_at": "2026-05-02",
  "reviewed_at": "2026-05-02",
  "bounds": { "north": 50.45, "south": 50.1, "east": 7.1, "west": 6.4 }
}
```

- [ ] **Vollständige Validierung lokal**

```bash
source .venv/bin/activate
python scripts/validate_gpx.py routes/de/offroad/de-eifel-volcanic-route.gpx
python scripts/validate_sidecar.py routes/de/offroad/de-eifel-volcanic-route.json
python scripts/build_catalog.py
```

Expected:

```
✅ de-eifel-volcanic-route.gpx
✅ de-eifel-volcanic-route.json
✅ catalog.json: 1 Routen, 0 Drafts
```

- [ ] **Frontend prüfen**

```bash
pnpm dev
```

Öffne http://localhost:5173 — Route-Card für "Volcanic Route Eifel" mit Rating 4.8, 142km, GPX-Button.

- [ ] **Alle Tests grün**

```bash
source .venv/bin/activate && pytest tests/ -v
```

Expected: `17 passed`

- [ ] **Commit**

```bash
git add routes/ catalog.json
git commit -m "feat: erste Route — Volcanic Route Eifel"
```

---

## Task 11: GitHub Repo + Deploy

- [ ] **Repo erstellen und pushen**

```bash
gh repo create moto-atlas \
  --public \
  --description "Kuratierte Motorrad-GPX-Routen für DE, BE, NL, FR, IT — Scenic-kompatibel"
git remote add origin https://github.com/lbuettge/moto-atlas.git
git push -u origin main
```

- [ ] **GitHub Pages auf Actions-Mode setzen**

```bash
gh api repos/lbuettge/moto-atlas/pages --method POST -f build_type=workflow
```

Falls Fehler (Pages already exists): GitHub.com → Repo → Settings → Pages → Source: "GitHub Actions"

- [ ] **ANTHROPIC_API_KEY Secret setzen (für Plan 3)**

```bash
gh secret set ANTHROPIC_API_KEY
```

- [ ] **Ersten Deploy beobachten**

```bash
gh run watch
```

Warte bis Build + Deploy grün. Dann: https://lbuettge.github.io/moto-atlas

- [ ] **Abschluss-Prüfung**

```
✅ 17 Python-Tests grün
✅ validate.yml + build-deploy.yml in GitHub Actions sichtbar
✅ https://lbuettge.github.io/moto-atlas zeigt Route-Card
✅ GPX-Download funktioniert
```

---

## Nach Plan 1 — nächste Pläne

- **Plan 2:** Rich Frontend — MapLibre Karte, Route-Detail-View, Elevation-Profil (SVG), Hero-Animationen
- **Plan 3:** Agent-Review GitHub Action + OSM-Overpass-Crawler + `scripts/research.sh`
