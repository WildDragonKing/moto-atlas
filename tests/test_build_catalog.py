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
