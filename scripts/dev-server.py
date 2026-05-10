#!/usr/bin/env python3
"""Dev-Server mit Hot-Reload fuer MotoAtlas.

Watch'd index.html, public/, catalog.json, routes/, drafts/.
Bei Aenderungen reloaded jeder verbundene Browser automatisch.
Symlinks in public/ (index.html, catalog.json, routes, drafts) sollten
vor dem Start eingerichtet sein — siehe .claude/launch.json fuer den
einmaligen Setup.
"""
from livereload import Server
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent


def rebuild_catalog():
    """Catalog neu bauen wenn ein Sidecar oder eine GPX-Datei sich aendert."""
    subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "build_catalog.py")],
        check=False,
    )


def main() -> int:
    server = Server()

    # Frontend-Files: simpler Reload
    server.watch(str(ROOT / "index.html"))
    server.watch(str(ROOT / "public/*.jsx"))
    server.watch(str(ROOT / "public/*.css"))
    server.watch(str(ROOT / "public/config.js"))

    # Catalog-Quellen: erst Catalog neu bauen, dann Reload
    server.watch(str(ROOT / "routes/**/*.json"), rebuild_catalog)
    server.watch(str(ROOT / "routes/**/*.gpx"), rebuild_catalog)
    server.watch(str(ROOT / "drafts/**/*.json"), rebuild_catalog)
    server.watch(str(ROOT / "drafts/**/*.gpx"), rebuild_catalog)

    # Catalog-Output: nur Reload (kein Rebuild noetig)
    server.watch(str(ROOT / "catalog.json"))

    print("MotoAtlas Dev-Server: http://localhost:5173 (Hot-Reload aktiv)")
    server.serve(port=5173, root=str(ROOT / "public"), host="localhost", open_url_delay=None)
    return 0


if __name__ == "__main__":
    sys.exit(main())
