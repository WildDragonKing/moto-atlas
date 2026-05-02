#!/usr/bin/env bash
set -euo pipefail
[[ $# -lt 1 ]] && { echo "Usage: $0 <drafts/country/route.gpx>"; exit 1; }
GPX="$1"; JSON="${GPX%.gpx}.json"
[[ ! -f "$GPX" ]] && { echo "Nicht gefunden: $GPX"; exit 1; }
[[ ! -f "$JSON" ]] && { echo "Sidecar fehlt: $JSON"; exit 1; }
COUNTRY=$(python3 -c "import json; print(json.load(open('$JSON')).get('country',''))")
TYPE=$(python3 -c "import json; print(json.load(open('$JSON')).get('type','touring'))")
[[ -z "$COUNTRY" ]] && { echo "Kein 'country' im Sidecar"; exit 1; }
TARGET="routes/$COUNTRY/$TYPE"
mkdir -p "$TARGET"
mv "$GPX" "$TARGET/" && mv "$JSON" "$TARGET/"
echo "✅ Promoted → $TARGET/"
