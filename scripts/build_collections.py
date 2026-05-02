#!/usr/bin/env python3
"""Baut Scenic-ZIP-Collections aus catalog.json."""
import json
import zipfile
from pathlib import Path

COUNTRIES = ["de", "be", "nl", "fr", "it"]
TYPES = ["offroad", "touring", "scenic"]


def make_zip(name: str, routes: list[dict]) -> None:
    if not routes:
        return
    with zipfile.ZipFile(f"collections/{name}.zip", "w") as z:
        for r in routes:
            p = Path(r.get("gpx_url", ""))
            if p.exists():
                z.write(p, p.name)


def main() -> None:
    Path("collections").mkdir(exist_ok=True)
    routes = json.loads(Path("catalog.json").read_text())["routes"]

    for c in COUNTRIES:
        for t in TYPES:
            make_zip(f"{c}-{t}", [r for r in routes if r.get("country") == c and r.get("type") == t])

    make_zip("all-offroad", [r for r in routes if r.get("type") == "offroad"])
    make_zip("all-routes", routes)
    print(f"Collections gebaut: {len(list(Path('collections').glob('*.zip')))} ZIPs")


if __name__ == "__main__":
    main()
