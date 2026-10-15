#!/usr/bin/env bash
# 합성 집계 프로브 — UI·브라우저 실행이 아니다.
# 대상 wrapper 파일을 바이트 그대로 임시 폴더에 복사하고, 같은 폴더에 가짜 orientation_check.py(종료값만 반환)를 둔다.
# 가짜 검사기는 출력 폴더 이름이 final이면 STUB_N, probe_hash_mismatch면 STUB_P로 종료한다.
# 사용: aggregation_probe.sh <검사할 run_with_exit.sh> <결과 폴더>
set -u
WRAP=$1; OUT=$2
mkdir -p "$OUT"
REC="$OUT/aggregation_probe.txt"
echo "대상 wrapper: $(basename "$WRAP") sha256=$(sha256sum "$WRAP" | cut -d' ' -f1)" > "$REC"
echo "종류: 합성 집계 프로브(가짜 검사기). 브라우저·UI 실행 없음." >> "$REC"
FAILS=0
for PAIR in "0 1 0" "0 2 1" "1 1 1" "0 0 1" "2 1 1"; do
  set -- $PAIR; N=$1; P=$2; WANT=$3
  T=$(mktemp -d)
  cp "$WRAP" "$T/run_with_exit.sh"
  cat > "$T/orientation_check.py" <<'PY'
import os, sys
sys.exit(int(os.environ["STUB_N"] if os.path.basename(sys.argv[3].rstrip("/")) == "final" else os.environ["STUB_P"]))
PY
  echo stub > "$T/a.html"; echo other > "$T/b.html"
  STUB_N=$N STUB_P=$P bash "$T/run_with_exit.sh" http://stub "$T/a.html" "$T/b.html" "$T/out" > "$T/wrapper_stdout.txt" 2>&1
  GOT=$?
  [ "$(sha256sum "$T/run_with_exit.sh" | cut -d' ' -f1)" = "$(sha256sum "$WRAP" | cut -d' ' -f1)" ] || { echo "복사본 해시 불일치" >> "$REC"; FAILS=$((FAILS+1)); }
  OK=$([ "$GOT" -eq "$WANT" ] && echo 일치 || echo 불일치)
  [ "$GOT" -eq "$WANT" ] || FAILS=$((FAILS+1))
  echo "가짜 종료 정상=$N 프로브=$P → 실제 wrapper exit=$GOT (기대 $WANT) $OK" >> "$REC"
  rm -rf "$T"
done
echo "기대와 다른 쌍: $FAILS" >> "$REC"
cat "$REC"
[ "$FAILS" -eq 0 ]
