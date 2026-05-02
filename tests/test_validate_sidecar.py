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
