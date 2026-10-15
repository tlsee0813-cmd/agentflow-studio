#!/usr/bin/env bash
# 정상 실행과 의도적 실패 프로브의 실제 프로세스 종료 코드를 기록한다.
# 사용: run_exit_proof.sh <URL> <HTML 경로> <출력 폴더>
# (HTML 폴더에서 미리: python3 -m http.server 8765 --bind 127.0.0.1)
set -u
URL=$1; HTML=$2; OUT=$3
HERE=$(cd "$(dirname "$0")" && pwd)
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
if [ "$N" -eq 0 ] && [ "$P" -ne 0 ]; then echo "증명: 정상 exit 0, 의도적 실패 exit $P (기대대로)" >> "$REC"
else echo "증명 실패: 정상 exit $N, 프로브 exit $P" >> "$REC"; fi
cat "$REC"
