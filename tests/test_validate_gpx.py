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
