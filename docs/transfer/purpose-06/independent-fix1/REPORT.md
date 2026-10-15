# cycle06 purpose fix1 — 독립 실제 브라우저 관측

고정 원본: https://raw.githubusercontent.com/tlsee0813-cmd/agentflow-studio/fbea41f245c4020bc044c7e0c7502d106fc900ae/docs/transfer/purpose-06/author-fix1/purpose-study.html
33944 bytes / SHA256 `d3cc065a3f26f7f64a0d42c5fda9551d8ff3cd270f66badf7c262829375bc2cd`.
GitHub 고정 커밋의 `git show`로 추출한 원본을 수정 없이 임시 site에 제공했다. 두 최초 page.goto 모두 실제 loopback HTTP 200, response.body SHA가 기대값과 일치. 파일 전후 SHA도 일치. 실제 URL/UTC는 run02/result.json에 있다. HTML은 중복 업로드하지 않는다.

계약: https://github.com/tlsee0813-cmd/agentflow-studio/blob/3738aa9469db0a8131b6220e50112c1a75d343ca/docs/cycles/2026-10-16-purpose-06/IMPLEMENTATION.md

## 실행과 범위

기존 Playwright **1.57.0**, 실제 system Chromium **154.0.8037.57**, 1440×900 / 390×844. 각각 새 브라우저 context. 패키지 버전과 browser.version을 동적으로 읽었다.
각 폭 P1(초기/프로그램 선택/115% 진입/역할·조건 경계), P2(X1→X2→X1 위치확인/원문 닫기·반복·Escape/기본 준비·편집), P3(전체복귀와 재진입 두 번/편집 보존). **필수 장면 6/6**, 최신 한 실행 run02의 반복 검사 **39 PASS / 0 FAIL**. 저장된 Escape scroll 값의 별도 읽기 전용 비교 2건은 별도 derived 파일이며 39에 합산하지 않았다.

run02 actual child exit **0**, 외부 collector actual exit **0**, JSON complete true, fatal/pageerror/cleanup 오류 없음. 서버 로그의 favicon.ico 404 및 console resource 오류 1개는 JavaScript pageerror와 구분한다.
작은 wrong-SHA probe는 별도 실행으로 브라우저 시작 전에 고의 불일치: fatal 기록, child **1**, collector **1**, complete false. UI 결과에 합산하지 않았다. actual-exit.json은 subprocess 결과, external-exit.json은 실행 도구가 관측한 collector 종료이다. finally는 정리 오류를 수집하고 실패·미완주를 0으로 덮지 않는다.

첫 실행 run01은 **검사기 오류**로 중단: 변환된 부모 clip에 미변환 clientWidth/Height를 섞어 X2 false FAIL을 만들었고, textarea 자신의 content 경계 안에 border box까지 요구해 정상 클릭을 거부했다. run01 코드·JSON·로그·종료 1을 그대로 보존했다. 수정은 측정기만: 변환 비율을 적용하고, 대상 border box의 조상 clip과 자체 content clip을 분리. 최신 통과는 run02 하나이며 과거 부분 통과를 합산하지 않았다. 원본 HTML 변경 없음.

## 실제 관측

- 원래 DOM ID 배열을 그대로 기록 후 중복 검사. P1 한 프로그램 제안, X1 업무 자료·X2 옮길 대상. AI 해석 관계, 자동 연동/게시 순서 아님이라는 실제 reader 문구와 역할·담당자 확인/게시 선택·운영 배포 금지·효과 미확인·주어지지 않은 것과 미결정의 차이를 기록했다.
- 위치 보기 세 번 모두 context target face가 viewport와 모든 조상 clip 안에 있고 대표점 hit가 실제 대상/후손이었다. 선택 P1 유지. 390의 ‘읽던 곳으로’는 그때 reader 위치와 해당 출발 버튼 focus를 복원했다. 이 별도 지도 위치가 최초 진입 snapshot을 덮지 않아 두 전체복귀 모두 원래 지도로 돌아왔다.
- mouse.wheel만 사용한 실제 비초기 reader 위치: 1440 **119 / max119**, 390 **160 / max183**. 이 수치는 목표값으로 주입하지 않았다. 같은 keep 근거를 정상 클릭해 열고 버튼닫기, 재열기/Escape. 닫힌 panel 자체가 DOM에서 제거됐고 링크/닫기버튼 0, aria-expanded false, 출발 버튼 focus, reader 위치와 버튼닫기 전후 기준 조건 상자 y 유지. 근거는 reader 내 짧은 inline panel이며 자체 내부 스크롤 컨테이너는 없다.
- 기본 준비문을 편집 **전** value·box·조상 clip·자체 content clip·hit와 PNG(prep-default-1440.png)로 남겼다. 재입력 줄일 작은 작업, 확인·게시 선택 뒤 공개, 운영 배포 금지가 보인다. 합성 편집문 ‘먼저 받은 소개글 한 편으로 재입력을 줄이는 작은 작업을 정리해 주세요. 게시 여부는 담당자가 선택합니다.’를 실제 입력 후 닫기/재열기 및 두 전체복귀 뒤 재진입에서 보존. 전송하지 않았다.
- 115%는 computed matrix(1.15, 0, 0, 1.15, 0, 0). 진입 직전 native map scroll은 1440 left138/top0(maxX156/maxY0), 390 left24/top137(maxX24/maxY470). 가능하지 않은 wide 세로 scroll은 0 그대로. P1/X1/X2 정확 rect, transform, 선택, map/main scroll을 복귀 즉시 보조 wheel 없이 측정: 두 왕복 각각 delta 0. focus n-P1 복원. 일부 대상은 원래 viewport 바깥이며 ‘좌표 복원’은 세 대상 모두 동시에 보인다는 뜻이 아니다.

## 측정 정의와 한계

모든 overflow 조상의 교집합과 viewport를 사용하고, 대상 자신의 overflow content clip은 별도 보존했다. transformed clip은 bounding box / offset size 비율 적용. 실제 대표점 elementFromPoint 결과는 bbox/clip과 별도 기록. derived-observations.json은 이미 저장된 값으로 자체 clip과 조상 clip을 다시 교차하고 기록 Range의 경계 분류를 남긴다. Range(최대16 rect)는 layout 범위로 글자잉크/사람 이해 판정이 아니다. textarea 값은 native control이므로 DOM Range로 본문 글자가 나오지 않으며 기본 contents + geometry + 원본 PNG로 확인했다. hidden app state/function, force click, DOM scroll/state 주입, 가짜 여백은 사용하지 않았다.

검증한 좁은 기능 경로에서 중요 정적 기능 결함은 발견하지 않았다. 이것은 사람 이해/효과 성공이 아니다. 실제 손가락·핀치, 실제 AI 준수/송신, 외부 원문 왕복은 NOT_RUN. 기존 환경만 재사용했고 설정/설치/게시·TLS 변경 없음. 기존 evidence와 제품 소스 수정 없음.

재현: 고정 HTML을 verify.py 옆 site/purpose-study.html에 정확 바이트로 추출 후 기존 venv Python으로 `collect.py <새출력폴더>` 실행. 서버/Chromium 시작과 정리는 verifier 소유. `--wrong-sha-probe`는 별도 합성 실패용이다. run01/run02/프로브의 verify.py는 실행 당시 snapshot이며 실제 실행 경로와 명령은 각 actual-exit.json에 기록했다.
