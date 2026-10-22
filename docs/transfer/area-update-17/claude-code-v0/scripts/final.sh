#!/usr/bin/env bash
# Author re-run on the committed source (cwd: app/). Node 22.16.0 / npm 10.9.2 from the official tarball (SHA256 checked
# against nodejs.org SHASUMS256.txt) is put first on PATH. Chromium: the environment's preinstalled build (playwright 1.57.0
# expects a newer build; the environment forbids 'playwright install'), passed through the existing BROWSER_EXECUTABLE hook.
# Usage: final.sh <label-prefix>   e.g. final.sh 30
set -u
P="$1"; here="$(cd "$(dirname "$0")/.." && pwd)"; R="$here/scripts/run.sh"; E="/tmp/claude-0/final-browser-$P"  # all suite artifacts; only AREA17 observations and representative PNGs are copied into evidence
export PATH=/tmp/claude-0/node2216/node-v22.16.0-linux-x64/bin:$PATH BROWSER_EXECUTABLE=${BROWSER_EXECUTABLE:-/opt/pw-browsers/chromium-1194/chrome-linux/chrome}
export AI_MODE=mock ALLOW_PAID_AI=false DEEPSEEK_API_KEY= BROWSER_TRANSPORT=direct-http PYTHONUTF8=1 PYTHONIOENCODING=utf-8
mkdir -p "$E"; rc=0; step(){ "$R" "$@" || rc=1; }
step ${P}-00-env bash -c 'git rev-parse HEAD; node --version; npm --version; python3 --version; python3 -c "from importlib.metadata import version;print(\"playwright\",version(\"playwright\"))"; "$BROWSER_EXECUTABLE" --version'
step ${P}-01-npm-ci npm ci --ignore-scripts --no-audit --no-fund
step ${P}-02-parent-check npm run check
step ${P}-03-parent-test npm test
step ${P}-04-continuity-check node continuity/scripts/check.mjs
step ${P}-05-continuity-build node continuity/scripts/build.mjs
step ${P}-06-continuity-units bash -c 'node --test continuity/tests/*.test.mjs'
step ${P}-07-static-build node continuity/scripts/build-static.mjs
step ${P}-08-parent-browser env EVIDENCE_DIR="$E/parent" python3 tests/browser.py
step ${P}-09-continuity-browser env IDEA015_EVIDENCE_DIR="$E/continuity" python3 continuity/tests/browser.py
for f in ui001 fresh033 select035 connect039 flow049 ai055 flow083 flow090 guide097 spatial102 use106 pc12 pc13 home15 report16 static understanding17; do
  step ${P}-10-browser-$f env IDEA015_EVIDENCE_DIR="$E/$f" FRESH033_EVIDENCE="$E/$f" UI001_SCREENSHOTS="$E/$f/screenshots" SELECT035_MATERIALS=continuity/tests/fixtures/select035 \
    SELECT035_MATERIALS_SOURCE='synthetic CI fixture created with public domain APIs; no coordinator reports' python3 continuity/tests/${f}_browser.py
done
exit $rc
