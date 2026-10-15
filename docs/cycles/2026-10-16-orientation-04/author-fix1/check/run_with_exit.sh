#!/usr/bin/env bash
# 정상 실행과 의도한 실패 1건(응답 body 해시 불일치)의 실제 프로세스 종료 코드를 기록한다.
# 사용: run_with_exit.sh <페이지 URL> <orientation-study.html> <다른 HTML(불일치용)> <출력 폴더>
# (HTML 폴더에서 미리: python3 -m http.server 8770 --bind 127.0.0.1)
set -u
URL=$1; HTML=$2; OTHER=$3; OUT=$4
HERE=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$OUT/final" "$OUT/probe_hash_mismatch"
REC="$OUT/process_exit.txt"
{
  echo "served HTML file sha256: $(sha256sum "$HTML" | cut -d' ' -f1)"
  echo "python: $(python3 --version 2>&1)"
  echo "--- final: $(date -Iseconds)"
} > "$REC"
python3 "$HERE/orientation_check.py" "$URL" "$HTML" "$OUT/final" > "$OUT/final/stdout.txt" 2> "$OUT/final/stderr.txt"
N=$?
echo "cmd: orientation_check.py <URL> $(basename "$HTML") final/" >> "$REC"
echo "exit_code=$N" >> "$REC"
echo "--- probe_hash_mismatch: $(date -Iseconds)" >> "$REC"
echo "의도: 서버는 $(basename "$HTML")을 주지만 기대 파일로 $(basename "$OTHER") ($(sha256sum "$OTHER" | cut -d' ' -f1))를 넘긴다" >> "$REC"
python3 "$HERE/orientation_check.py" "$URL" "$OTHER" "$OUT/probe_hash_mismatch" > "$OUT/probe_hash_mismatch/stdout.txt" 2> "$OUT/probe_hash_mismatch/stderr.txt"
P=$?
echo "cmd: orientation_check.py <URL> $(basename "$OTHER") probe_hash_mismatch/" >> "$REC"
echo "exit_code=$P" >> "$REC"
echo "served HTML file sha256 (after): $(sha256sum "$HTML" | cut -d' ' -f1)" >> "$REC"
# 집계: 정상 실행은 정확히 0, 의도한 해시 불일치 프로브는 정확히 1이어야 wrapper가 0으로 끝난다(임의 nonzero 불인정)
if [ "$N" -eq 0 ] && [ "$P" -eq 1 ]; then echo "결과: 정상 exit 0, 의도한 해시 불일치 exit 1" >> "$REC"; RC=0
else echo "결과 이상: 정상 exit $N (기대 0), 의도한 실패 exit $P (기대 1)" >> "$REC"; RC=1; fi
echo "wrapper_exit=$RC" >> "$REC"
cat "$REC"
exit "$RC"
