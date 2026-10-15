# run-01 — 첫 실행 (보존)
child exit 1. 두 폭 모두 경로1 선택 직후 **검사 코드 오류**로 중단(FATAL): Playwright 전용 `:visible` 선택자를 브라우저 `document.querySelector`에 넘겨 SyntaxError. 앱 HTML은 바꾸지 않음.
그 전까지 실행된 단언(HTTP SHA, 목적 표시, 초기 시야, 선택 시 지도 불변)은 PASS. 이후 장면은 이 run에서 미실행.
수정(run-02): 폭별 실제 선택자 사용. 좁은 폭 위치보기 ‘이동 여부’ 대조 기준을 숨겨진 지도의 DOM scroll 대신 앱이 보관한 마지막 지도 시야로 바꿈(숨겨진 요소 scroll은 기준이 될 수 없음).
