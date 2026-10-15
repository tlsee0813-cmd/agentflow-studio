#!/bin/sh
# 실제 HTTP: reading-study.html 안의 모든 원문 링크(GitHub 고정 커밋 blob URL)에 대해
#  (1) blob 페이지 자체와 (2) 같은 커밋·같은 경로의 raw 파일에 GET 요청을 보내 상태 코드를 기록한다.
# 판정은 raw 파일 200만 센다(대상 파일이 그 커밋에 존재하는지). blob 페이지 코드는 INFO로만 남긴다:
# 작성 환경의 GitHub 웹 프록시가 blob 페이지를 403으로 막을 수 있기 때문이다. 내용 대조·브라우저 표시는 하지 않는다.
# fix1: 추출한 링크 수가 기대값(기본 11, 두 번째 인자로 변경)과 다르거나 0개면 실패로 끝낸다.
HTML="${1:-reading-study.html}"
EXPECTED="${2:-11}"
fail=0; n=0
if [ ! -f "$HTML" ]; then echo "FATAL html not found: $HTML"; exit 2; fi
found=$(grep -o 'https://github.com/[^"]*' "$HTML" | sort -u | wc -l | tr -d ' ')
if [ "$found" -eq 0 ]; then echo "FAIL extracted 0 links (expected $EXPECTED)"; echo "links: pass 0 fail 1"; exit 1; fi
if [ "$found" -ne "$EXPECTED" ]; then echo "FAIL extracted $found links (expected $EXPECTED)"; fail=1; else echo "PASS extracted $found links (expected $EXPECTED)"; fi
for u in $(grep -o 'https://github.com/[^"]*' "$HTML" | sort -u); do
  raw=$(echo "$u" | sed -e 's#https://github.com/#https://raw.githubusercontent.com/#' -e 's#/blob/#/#')
  bc=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 30 "$u")
  rc=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 30 "$raw")
  n=$((n+1))
  if [ "$rc" = "200" ]; then echo "PASS raw=$rc $raw"; else echo "FAIL raw=$rc $raw"; fail=$((fail+1)); fi
  echo "INFO blob=$bc $u"
done
total=$((n+1))
echo "links: pass $((total-fail)) fail $fail (추출 수 검사 1 + 링크 $n개; INFO $n 별도, 검사 수 미포함)"
[ $fail -eq 0 ]
