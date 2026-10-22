# 재현 배치

기존 승인 환경 `/workspace/browser-env`의 Node22/TS5.8.3, venv Playwright1.57/system Chromium 경로를 그대로 사용했다. 소스는 git archive exact head의 app/ 및 experiments/idea016/cases.mjs만 격리 추출한다. npm run check/build, node continuity/scripts/check.mjs/build.mjs가 준비 명령이다. 소스 사본/node_modules/빌드 결과는 이 증거에 중복하지 않는다.

실제 실행 코드 원형이 절대 scratch basename을 사용하므로 회수 시 `independent/*`를 `/workspace/browser-env/cycle19-independent/`에, source8c를 cycle19-candidate/,9fb를 cycle19-final-candidate/,81d를 cycle19-test-v1-candidate/에 배치한다. 원시 입력 `fixtures/`는 이미 만들어진 공개domain API 합성 fixture이며 UI file input으로 가져왔다. hidden app API/state를 호출하지 않는다. 생성기를 다시 실행하려면 cycle18 고정 evidence479658cc6748b7755b1423a9ef524e0b1b9c922d의 `fixtures/` 및 메타를 cycle18-fix4-independent/에 둔다. 측정 helper AST 재사용은 `measurement-reuse/cycle18-fix4-ui.py`를 cycle18-fix4-independent/ui.py로 둔다(이 파일의 UI 실행을 호출하지 않고 GEO 함수 literal만 읽음).

core-collector.py / boundaries-collector.py / purpose-followup-collector.py / minimum-collector.py / record-list-memo-collector.py가 각각 별도 실행과 출력 경로다. history 디렉터리는 실행 당시 코드/원시 결과이며 최신 코드와 합치지 않는다. 원본 W19 코드는 failure-first에 보존했고 SHA고정 GitHub에서도 회수가능하다. 회귀 collector는 regressions-9fb, 최종 W19 collector는 w19-81d 원형 코드다. source HEAD/출력경로만 설정하며 검사 본문 수정 금지.

독립 raw 측정은 DOM 읽기/normal click/key/mouse wheel·native background drag와 공개 domain API offline fixture 구성이다. scrollTop assignment/scrollIntoView/forceclick/app state injection/자동복귀보정은 하지 않았다. toggle event 진단 listener는 읽기전용이며 `open=false` 관측과 handler처리완료를 구분한다. 합성 composing/consumed Escape는 실제OSIME와 구별한다.
