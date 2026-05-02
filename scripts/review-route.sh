#!/usr/bin/env bash
# Lokal ausgeführtes Route-Review via Claude Code CLI
# Usage: bash scripts/review-route.sh <pfad/zur/route.gpx>
set -euo pipefail

[[ $# -lt 1 ]] && { echo "Usage: $0 <route.gpx>"; exit 1; }
GPX="$1"
JSON="${GPX%.gpx}.json"
[[ ! -f "$GPX" ]] && { echo "GPX nicht gefunden: $GPX"; exit 1; }
[[ ! -f "$JSON" ]] && { echo "JSON-Sidecar fehlt: $JSON"; exit 1; }

# Stats aus GPX extrahieren
STATS=$(python3 - "$GPX" <<'PYEOF'
import sys, math, gpxpy
from pathlib import Path

with open(sys.argv[1]) as f:
    gpx = gpxpy.parse(f)

pts = [p for t in gpx.tracks for s in t.segments for p in s.points]
if not pts:
    print("Keine Trackpunkte")
    sys.exit(1)

def hav(a, b):
    R=6371; dlat=math.radians(b.latitude-a.latitude); dlon=math.radians(b.longitude-a.longitude)
    x=math.sin(dlat/2)**2+math.cos(math.radians(a.latitude))*math.cos(math.radians(b.latitude))*math.sin(dlon/2)**2
    return R*2*math.atan2(math.sqrt(x),math.sqrt(1-x))

dist = round(sum(hav(pts[i-1], pts[i]) for i in range(1, len(pts))))
elev = round(sum(max(0, pts[i].elevation - pts[i-1].elevation) for i in range(1, len(pts)) if pts[i].elevation and pts[i-1].elevation))
lats = [p.latitude for p in pts]; lons = [p.longitude for p in pts]
name = gpx.name or (gpx.tracks[0].name if gpx.tracks else "Unbekannt")

print(f"Name: {name}")
print(f"Distanz: {dist}km")
print(f"Höhenmeter: {elev}m")
print(f"Trackpunkte: {len(pts)}")
print(f"Bounds: N{max(lats):.3f} S{min(lats):.3f} E{max(lons):.3f} W{min(lons):.3f}")
PYEOF
)

SIDECAR=$(cat "$JSON")

PROMPT="Du bist ein Motorrad-Routen-Reviewer für MotoAtlas, eine kuratierte Sammlung schöner Motorradrouten in DE/BE/NL/FR/IT.

GPX-Datei: $(basename $GPX)
GPX-Stats:
$STATS

Sidecar-JSON:
$SIDECAR

Bewerte diese Route und antworte NUR mit einem validen JSON-Objekt (kein Text davor/danach):
{
  \"rating\": <1.0-5.0, eine Dezimalstelle>,
  \"rating_source\": \"agent-local\",
  \"agent_review\": \"<2-3 Sätze auf Deutsch: Was macht die Route besonders? Landschaft, Charakter, Besonderheiten. Ehrlich — nicht jede Route ist fantastisch.>\",
  \"difficulty\": <1-5, 1=einfach/flach, 5=anspruchsvoll/Offroad>,
  \"surface\": \"<paved|gravel|mixed>\",
  \"offroad_pct\": <0-100>,
  \"distance_km\": <aus Stats>,
  \"elevation_gain_m\": <aus Stats>,
  \"bounds\": {\"north\": <>, \"south\": <>, \"east\": <>, \"west\": <>},
  \"reviewed_at\": \"$(date +%Y-%m-%d)\"
}

Bewertungskriterien: Landschaft/Eigencharakter, GPX-Qualität, Interessantheit für Motorradfahrer.
Rating 4.5+ nur für wirklich herausragende Routen."

echo "🤖 Starte Claude Code Review für $(basename $GPX)..."
RESULT=$(claude -p "$PROMPT" 2>/dev/null)

# JSON aus Antwort extrahieren
PATCH=$(echo "$RESULT" | python3 -c "
import sys, json, re
text = sys.stdin.read()
# Finde JSON-Block
match = re.search(r'\{[^{}]*\}', text, re.DOTALL)
if match:
    try:
        obj = json.loads(match.group())
        print(json.dumps(obj))
    except:
        print('{}')
else:
    print('{}')
")

if [[ "$PATCH" == "{}" ]]; then
    echo "❌ Kein valides JSON in Claude-Antwort"
    echo "Raw response: $RESULT"
    exit 1
fi

# JSON-Sidecar mergen
python3 - "$JSON" "$PATCH" <<'PYEOF'
import sys, json
from pathlib import Path

path = Path(sys.argv[1])
patch = json.loads(sys.argv[2])

current = json.loads(path.read_text())
current.update(patch)
path.write_text(json.dumps(current, ensure_ascii=False, indent=2))
print(f"✅ {path.name} aktualisiert")
print(f"   Rating: {current.get('rating')} | Difficulty: {current.get('difficulty')} | Surface: {current.get('surface')}")
print(f"   Review: {current.get('agent_review', '')[:80]}...")
PYEOF
