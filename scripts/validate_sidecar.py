#!/usr/bin/env python3
"""JSON-Sidecar-Validierung fuer MotoAtlas CI/CD."""
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
        errors.append(f"Ungueltigtes country '{data['country']}' — erlaubt: {', '.join(sorted(VALID_COUNTRIES))}")

    if "type" in data and data["type"] not in VALID_TYPES:
        errors.append(f"Ungueltiger type '{data['type']}' — erlaubt: {', '.join(sorted(VALID_TYPES))}")

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
