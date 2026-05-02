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
