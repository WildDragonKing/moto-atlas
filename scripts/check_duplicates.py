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

    gpx_arg = str(Path(args.gpx_file))
    lat, lon = gpx_centroid(Path(args.gpx_file))
    catalog = json.loads(cat_path.read_text(encoding="utf-8"))
    for entry in catalog.get("routes", []) + catalog.get("drafts", []):
        # Selbst-Referenz ueberspringen
        if entry.get("gpx_url") and gpx_arg.endswith(entry["gpx_url"]):
            continue
        c = bounds_centroid(entry)
        if c and haversine(lat, lon, c[0], c[1]) < THRESHOLD_KM:
            print(f"❌ Moegliches Duplikat von '{entry['id']}' (Distanz < {THRESHOLD_KM}km)")
            return 1

    print(f"✅ {Path(args.gpx_file).name} (kein Duplikat)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
