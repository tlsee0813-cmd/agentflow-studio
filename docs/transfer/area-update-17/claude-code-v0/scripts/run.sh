#!/usr/bin/env bash
# Usage: run.sh <label> <command...>   (cwd: app/). Writes raw/<label>.stdout.log, .stderr.log, .exit.json.
# Never overwrites an earlier label: a re-run needs a new label.
set -u
here="$(cd "$(dirname "$0")/.." && pwd)"; label="$1"; shift
out="$here/raw/$label"
if [ -e "$out.exit.json" ]; then echo "refusing to overwrite $label" >&2; exit 90; fi
start="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
"$@" >"$out.stdout.log" 2>"$out.stderr.log"; code=$?
end="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
python3 - "$out.exit.json" "$code" "$start" "$end" "$(git rev-parse HEAD)" "$(git status --porcelain -- . ":(exclude)../docs/transfer/area-update-17" | wc -l)" "$(node --version)" "$*" <<'PY'
import json,sys
f,code,start,end,head,dirty,node,cmd=sys.argv[1:]
json.dump({"command":cmd,"cwd":"app","exit":int(code),"start":start,"end":end,"head":head,"dirtyFiles":int(dirty),"node":node},open(f,"w"),indent=1)
PY
echo "$label exit=$code"; exit $code
