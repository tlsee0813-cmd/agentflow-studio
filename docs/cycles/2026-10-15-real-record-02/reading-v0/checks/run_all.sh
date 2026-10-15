#!/bin/sh
# 재실행: 이 폴더의 상위(배포 폴더 루트)에서  sh checks/run_all.sh
# 필요: python3, Playwright(Python) + Chromium, curl. 결과는 logs/ 와 shots/ 에 다시 쓴다.
set -u
cd "$(dirname "$0")/.."
mkdir -p logs shots
python3 -I checks/static_check.py reading-study.html logs/static_results.json > logs/static.log 2>&1; s=$?
python3 checks/browser_check.py reading-study.html shots --shots > logs/browser.log 2>&1; b=$?
[ -f shots/browser_results.json ] && mv shots/browser_results.json logs/browser_results.json
sh checks/check_links.sh reading-study.html > logs/links_http.log 2>&1; l=$?
echo "static exit=$s  browser exit=$b  links exit=$l"
[ $s -eq 0 ] && [ $b -eq 0 ] && [ $l -eq 0 ]
