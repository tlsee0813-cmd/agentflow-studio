#!/bin/sh
# 상위 실행: 수집기(run_checks.py)를 돌리고 수집기 자신의 종료코드를 별도 파일에 남긴다.
# 사용: sh run_all.sh <html> <run_dir>
HERE=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$2"
python3 "$HERE/run_checks.py" "$1" "$2"
RC=$?
echo "$RC" > "$2/collector_exit.txt"
echo "collector_exit=$RC"
exit $RC
