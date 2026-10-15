# cycle06 fix1 — 비초기 X2 맥락 복귀 추가관측

기존 68d357d 결과를 수정하거나 합산하지 않은 **한 경로 × 두 폭**의 별도 실행이다. 기존 준비·peek·전체복귀 6장면은 재실행하지 않았다.

원본: https://raw.githubusercontent.com/tlsee0813-cmd/agentflow-studio/fbea41f245c4020bc044c7e0c7502d106fc900ae/docs/transfer/purpose-06/author-fix1/purpose-study.html
33944 bytes, SHA256 `d3cc065a3f26f7f64a0d42c5fda9551d8ff3cd270f66badf7c262829375bc2cd`.
기존 읽기 전용 추출 원본을 그대로 제공했다. 각 새 context 최초 page.goto의 실제 loopback HTTP 200 / response body 33944 bytes·SHA 일치, 파일 전후 SHA 일치. URL·UTC·응답 상세는 result.json.

Playwright 패키지 1.57.0 / 실제 browser.version 154.0.8037.57 / /usr/bin/chromium. 환경 설정·설치·TLS 변경 없음.

## 실제 결과

각 폭 새 context에서 P1 선택→역할 읽기→reader 안 실제 mouse.wheel(0,100)→X2 위치 보기. 390에서만 ‘읽던 곳으로’ 클릭. 1440은 reader가 남는 UI 그대로 측정했다. 전후 보조 wheel/DOM scroll/가짜 여백/app state 접근은 없었다.

| 폭 | reader top 전→후 / max | X2 행 raw x,y,width,height (전=후) | delta x/y/w/h |
|---|---|---|---|
|1440×900|100→100 / 119|1063, 503.234375, 355, 80.0625|0/0/0/0|
|390×844|100→100 / 183|16, 514.484375, 358, 80.0625|0/0/0/0|

X2 출발 버튼은 왕복 전 실제 clip 안에 있고 대표점 hit가 확인된 상태에서 정상 mouse click. 지도 X2 face는 viewport와 모든 overflow 조상 clip 안에 드러났고 대표점 hit가 대상/후손이었다. 대상 자체 content clip도 별도 기록했다. 복귀 직후 출발 [data-loc=X2] 버튼 focus, 선택 P1 유지, 출발 버튼 실제 접근 가능. 모든 raw 행 rect/clip/hit/focus와 정확 delta는 result.json에 있다. 코드의 허용오차는 ±1px이나 이번 실측 변화는 정확히 0이다.

필수 경로 **2/2 완료**, 이 추가 실행 반복 검사 **16 PASS / 0 FAIL**. 실제 child exit **0**, 실제 외부 wrapper exit **0**, launcher exit **0**, JSON complete true. pageerror/fatal/cleanup 오류 없음. favicon.ico HTTP404 console resource 오류는 pageerror와 분리한다. 기존 39 PASS와 하나의 실행으로 합산하지 않는다.

최초 코드에는 HTTP 관측 변수 `http`가 import http를 가려 서버 생성 전에 UnboundLocalError가 발생했다. 브라우저/UI 미실행, child/wrapper exit 1. first-harness-failure/에 당시 코드·JSON·로그·종료증거를 그대로 보존한 뒤 관측 변수명만 수정했다. 앱 결함이 아니다. 별도 실패 probe나 다른 경로는 실행하지 않았다.

이 좁은 비초기 맥락 왕복에서 행 높이/읽기 위치 손실은 재현되지 않았다. 기존 근거 읽기 검사와 별개이며 사람 이해·실제 효과 성공이나 모든 위치 일반화를 뜻하지 않는다. 대표 PNG는 필수가 아니므로 새 캡처는 만들지 않았다.

재실행 시 check.py의 SOURCE가 가리키는 경로에 고정 원본이 있어야 한다. 기존 venv Python으로 launch.py 실행: wrapper가 child의 실제 subprocess exit와 JSON을 비교하고, launcher가 wrapper의 실제 subprocess exit를 별도 기록한다. 정리 예외·미완주·해시/페이지오류·관측 실패는 nonzero. 원본 HTML/이전 evidence 불변.
