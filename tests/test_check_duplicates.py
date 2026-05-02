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
    # valid.gpx centroid ~50.345, 6.56 — existing route direkt daneben
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


def test_self_reference_passes(tmp_path):
    """Katalog enthaelt dieselbe Route — darf kein Duplikat ausloesen."""
    cat = catalog([{
        "id": "de-test-eifel",
        "gpx_url": "tests/fixtures/valid.gpx",
        "bounds": {"north": 50.37, "south": 50.32, "east": 6.60, "west": 6.51}
    }])
    code, out = run(FIXTURES / "valid.gpx", cat)
    cat.unlink()
    assert code == 0, f"Selbst-Referenz faelschlicherweise als Duplikat erkannt:\n{out}"
