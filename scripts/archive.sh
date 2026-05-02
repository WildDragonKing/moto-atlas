#!/usr/bin/env bash
set -euo pipefail
[[ $# -lt 1 ]] && { echo "Usage: $0 <route.gpx> [\"Grund\"]"; exit 1; }
GPX="$1"; REASON="${2:-}"; JSON="${GPX%.gpx}.json"
[[ ! -f "$GPX" ]] && { echo "Nicht gefunden: $GPX"; exit 1; }
COUNTRY=$(echo "$GPX" | grep -oE '/(de|be|nl|fr|it)/' | tr -d '/' | head -1)
[[ -z "$COUNTRY" && -f "$JSON" ]] && \
  COUNTRY=$(python3 -c "import json; print(json.load(open('$JSON')).get('country','de'))" 2>/dev/null) || true
[[ -z "$COUNTRY" ]] && COUNTRY="de"
mkdir -p "archive/$COUNTRY"
mv "$GPX" "archive/$COUNTRY/" && { [[ -f "$JSON" ]] && mv "$JSON" "archive/$COUNTRY/"; }
echo "✅ Archiviert → archive/$COUNTRY/"
[[ -n "$REASON" ]] && echo "   Grund: $REASON"
