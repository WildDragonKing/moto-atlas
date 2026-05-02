#!/usr/bin/env bash
set -euo pipefail

usage() { echo "Usage: $0 <url-or-path> --country <de|be|nl|fr|it> [--type <offroad|touring|scenic>]"; exit 1; }

SOURCE="" COUNTRY="" TYPE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --country) COUNTRY="$2"; shift 2 ;;
    --type)    TYPE="$2"; shift 2 ;;
    --*)       usage ;;
    *)         SOURCE="$1"; shift ;;
  esac
done
[[ -z "$SOURCE" || -z "$COUNTRY" ]] && usage
[[ ! " de be nl fr it " == *" $COUNTRY "* ]] && { echo "Ungültiges country: $COUNTRY"; exit 1; }

TARGET="drafts/$COUNTRY"
mkdir -p "$TARGET"

if [[ "$SOURCE" == http* ]]; then
  FILENAME=$(basename "$SOURCE" | sed 's/[^a-zA-Z0-9._-]/-/g')
  [[ "$FILENAME" != *.gpx ]] && FILENAME="${FILENAME}.gpx"
  curl -fsSL "$SOURCE" -o "$TARGET/$FILENAME"
else
  FILENAME=$(basename "$SOURCE")
  cp "$SOURCE" "$TARGET/$FILENAME"
fi

BASE="${FILENAME%.gpx}"
JPATH="$TARGET/${BASE}.json"

if [[ ! -f "$JPATH" ]]; then
  python3 - "$JPATH" "$BASE" "$COUNTRY" "$SOURCE" "$TYPE" <<'PYEOF'
import json, sys
out, name, country, src, t = sys.argv[1:]
d = {"name": name, "country": country, "source_url": src, "source_name": "Manuell"}
if t: d["type"] = t
open(out, "w").write(json.dumps(d, indent=2))
PYEOF
fi

echo "✅ $TARGET/$FILENAME"
echo "   Bearbeite: $JPATH"
echo "   Dann: git add $TARGET && git push → PR öffnen"
