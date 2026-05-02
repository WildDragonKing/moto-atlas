#!/usr/bin/env python3
"""GPX-Validierung fuer MotoAtlas CI/CD."""
import sys
from pathlib import Path
import gpxpy

EUROPE_BOUNDS = {"min_lat": 35.0, "max_lat": 72.0, "min_lon": -10.0, "max_lon": 32.0}
MIN_TRACK_POINTS = 10
MAX_FILE_SIZE_MB = 50


def validate(path: Path) -> list[str]:
    errors: list[str] = []

    if path.stat().st_size > MAX_FILE_SIZE_MB * 1024 * 1024:
        errors.append(f"Datei zu gross: {path.stat().st_size / 1024 / 1024:.1f}MB > {MAX_FILE_SIZE_MB}MB")
        return errors

    try:
        with open(path, encoding="utf-8") as f:
            gpx = gpxpy.parse(f)
    except Exception as e:
        errors.append(f"GPX nicht parsebar: {e}")
        return errors

    # Name: metadata name OR first track name acceptable
    track_name = gpx.tracks[0].name if gpx.tracks else None
    effective_name = gpx.name or track_name
    if not effective_name:
        errors.append("Kein Name vorhanden — weder <metadata><name> noch <trk><name>")

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
                f"Track {idx}: {len(oob)} Punkte ausserhalb Europa-Bounds "
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
