#!/usr/bin/env bash
# 정상 실행과 의도적 실패 프로브의 실제 프로세스 종료 코드를 기록한다.
# 사용: run_exit_proof.sh <URL> <HTML 경로> <출력 폴더> [원본 check 폴더]
# 이 별도 보완본은 네 번째 인자로 보존된 원본 check 폴더를 지정한다.
# (HTML 폴더에서 미리: python3 -m http.server 8765 --bind 127.0.0.1)
set -u
URL=$1; HTML=$2; OUT=$3
HERE=$(cd "${4:-$(dirname "$0")}" && pwd)
mkdir -p "$OUT/normal" "$OUT/probe_fail"
REC="$OUT/process_exit.txt"
{
  echo "HTML sha256 (실행 전): $(sha256sum "$HTML" | cut -d' ' -f1)"
  echo "python: $(python3 --version 2>&1)"
} > "$REC"

echo "--- normal: $(date -Iseconds)" >> "$REC"
python3 "$HERE/flow_check.py" "$URL" "$HTML" "$OUT/normal" > "$OUT/normal/stdout.txt" 2> "$OUT/normal/stderr.txt"
N=$?
echo "cmd: python3 flow_check.py $URL $(basename "$HTML") normal/" >> "$REC"
echo "exit_code=$N" >> "$REC"

echo "--- probe_fail: $(date -Iseconds)" >> "$REC"
python3 "$HERE/probe_fail_one_step.py" "$URL" "$HTML" "$OUT/probe_fail" > "$OUT/probe_fail/stdout.txt" 2> "$OUT/probe_fail/stderr.txt"
P=$?
echo "cmd: python3 probe_fail_one_step.py $URL $(basename "$HTML") probe_fail/" >> "$REC"
echo "exit_code=$P" >> "$REC"

echo "HTML sha256 (실행 후): $(sha256sum "$HTML" | cut -d' ' -f1)" >> "$REC"
RESULT=1
if [ "$N" -eq 0 ] && [ "$P" -eq 1 ] && python3 - "$OUT/normal/flow_log.json" "$OUT/probe_fail/flow_log.json" <<'PY'
import json, sys
from pathlib import Path
try:
    normal, probe = [json.loads(Path(p).read_text(encoding="utf-8")) for p in sys.argv[1:]]
    if normal["verdict"] != {"exit_code": 0, "failures": {}}:
        raise ValueError("normal verdict")
    if probe["verdict"] != {"exit_code": 1, "failures": {"d1440": ["단계 4 FAIL"]}}:
        raise ValueError("probe verdict")
    target = [s for s in probe["runs"]["d1440"]["steps"] if str(s["step"]) == "4"]
    if len(target) != 1 or target[0]["status"] != "FAIL":
        raise ValueError("probe target step")
    failed = [(name, str(s["step"]), c[0], c[2])
              for name, run in probe["runs"].items() for s in run["steps"]
              for c in s["checks"] if c[1] is False]
    if failed != [("d1440", "4", "PROBE: 의도적 실패(검사기 종료 코드 확인용)", "probe_fail_one_step.py")]:
        raise ValueError("probe failed check")
except Exception as e:
    print("프로브 증거 불일치: " + repr(e), file=sys.stderr)
    sys.exit(1)
PY
then
  RESULT=0
  echo "증명: 정상 exit 0, 의도한 단계 4 실패 exit 1 및 JSON 근거 일치" >> "$REC"
else
  echo "증명 실패: 정상 exit $N, 프로브 exit $P 또는 JSON 근거 불일치" >> "$REC"
fi
cat "$REC"
exit "$RESULT"
