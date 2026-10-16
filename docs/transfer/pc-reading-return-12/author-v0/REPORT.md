# PC 연결12 — 작성자 v0 보고 (Opus, 작성자 검사)

작성 2026-10-16 KST. 이 문서는 **작성자 구현과 작성자 검사**다. 독립 검증·후보 수용·공개 반영이 아니다. 숫자는 실행한 자동 검사 결과이며 사람의 이해도·사용성을 뜻하지 않는다.

## 기준과 입력
- 제품 기준: USE106 `618d9bd2b99ad433df35107d8902b15f45e30000` — clone 후 `git checkout` → `git rev-parse HEAD`가 같은 값임을 확인. `origin/product/pc-reading-return-12`도 같은 SHA(총괄이 만든 그대로, 손대지 않음). main 미사용.
- 계약: `f203ce0b…/docs/cycles/2026-10-16-product-reading-return-12/IMPLEMENTATION.md`, 연결 문서 `93f95855…/docs/cycles/2026-10-16-two-change-record-11/PRODUCT_INTEGRATION.md` 둘 다 고정 커밋에서 읽음.
- AGENTS.md/CLAUDE.md: 저장소 전체에 없음(검색 결과 0). 대신 루트 README, `app/continuity/README.md`의 실행·검사 절차를 따름.
- push/PR/배포/다른 브랜치 변경 없음. 로컬 작업 트리에서만 수정.

## 변경 파일과 이유 (원 repo 상대경로, `files/`에 동일 경로로 포함)
| 파일 | 변경 | 이유 |
|---|---|---|
| `app/continuity/src/client/app.ts` | +156/−37 | 흐름 연결(아래) |
| `app/continuity/public/styles.css` | +16/−0 | 새 요소 배치(기존 변수·클래스 재사용) |
| `app/continuity/tests/pc12_browser.py` | 새 파일 258줄 | 계약 핵심 두 경로·실패 경계 |
| `app/continuity/tests/flow090_browser.py` | +12/−9, 4개 장면 | 계약이 바꾼 기존 동작(편집 명시 진입, 패널의 최신 보고 자동 선택 제거)에 맞춤 |

shared domain/저장 스키마/서버/provider/AI 경로/의존성/index.html은 바꾸지 않았다. 새 파일은 검사 1개뿐이다.

### app.ts 구체
1. **영역 패널 읽기 기본**(`areaPanel`): 이름 + ‘사용자 구상’을 먼저 보인다. 160자 초과면 앞부분임을 밝히고 `구상 전체 보기` details에 전문. 빈 구상은 기존 ‘구상 미기재’ 그대로. 이름·구상 입력은 `이름·구상 고치기`(details `#panel-edit`)를 열어야 보이며, 저장 안 한 입력이 있으면 자동으로 열린 채 유지(기존 `panelDirty` 재사용). 기존 `#panel-name/#panel-note/#panel-save/#panel-cancel` ID 유지.
2. **최신 보고 자동 선택 제거**: 패널의 `#panel-report`(가장 최근 보고를 골라 발췌)를 없애고, 이 영역의 요청 목록(최신순 최대 5개, `#panel-task-<id>`)에서 사용자가 하나를 고르게 했다. 요청이 없으면 ‘아직 이 영역의 요청이 없어요.’만 표시.
3. **영역 화면** 긴 구상(320자 초과)은 앞부분+전문 details(`#area-idea`). 기존 `이름·설명 고치기`는 그대로.
4. **작업 읽기**(`renderTaskView`): 선택한 Task의 `currentWork(project, 선택Task)`로 짧은 이해/범위를 먼저 보이고, 각 줄 옆에 출처(`사용자 직접 수정` / `MOCK·AI 제안 · 원문과 다를 수 있음` / `이전 … 문구 · 기준 변경 전이라 작업문에서 제외됨`)를 둔다. 값이 없으면 ‘기록이 없어요… 만들어 넣지 않았어요’만. 요청 원문(`#task-view-request`), 작업문·완료 조건·유지할 조건(`#task-view-work`), 돌아온 결과(`#task-view-results`, ‘외부 원문 · 앱 미검증’), 배경 사본(`#task-view-background`, 기존 `backgroundPreview` 재사용, 사본 없음/그 뒤 구상 바뀜 구별), 기준(기존)은 닫힌 details. 원문·보고·조건은 제거하지 않고 한 번 클릭 거리.
5. **실제 이어갈 대상 표시**(`continueTarget`, `#task-view-target`): 기존 `continueTask` 정책을 그대로 반영한 문장. current=A면 A 편집, current=R(A의 직접 보고)면 “받은 현재 보고 R에서 계속 · R의 후속 확인 작업문을 고침 · A 작업문은 그대로”, 그 밖(RB 등)이면 “A로 바꾸고 A 작업문을 고침 · 지금 작업은 남음 · 이전 보고를 대신 고르지 않음”. 이어간 직후 같은 내용을 notice로 한 번 더 알림. **continueTask/focusTask의 상태 의미는 바꾸지 않았다**(알림만 추가).
6. **출발 지도 보기 복귀**(`origin`, `markOrigin`, `returnToOrigin`): space/area 보기에서 작업 읽기·이어가기로 떠날 때 탭 메모리에 출발점 하나(프로젝트, 층, 영역, `mapView` 좌표·배율, `mapSelected`, sheet, `scrollY`, 사용한 버튼 ID)를 기록. 작업 화면(`#task-return-origin`)과 work 화면 경로 막대(`#work-return-origin`)의 ‘← 출발한 지도 보기로 · …’가 보기만 되돌린다. currentTaskId·manual·draft는 건드리지 않는다. 다른 방법으로 지도/영역에 들어가면(`openSpace/openArea`) 그 보기가 새 출발점이 되어 이전 출발점은 버린다. 프로젝트 전환·목록 이동(`resetEphemeral`)에서 버린다. 출발 영역이 보관/없음이면 전체 공간으로, 선택 해제, 다른 대상 선택 없이 알림. 새 저장 필드·sessionStorage 키는 만들지 않았다.
7. `backgroundPreview(t,id)`에 id 인자만 추가(기본값 기존 ID, 열림 기억은 work 카드에만) — 같은 문서에 ID 중복을 피하려는 최소 변경.

## 실행한 명령과 실제 종료 (raw/ 로그·exit 파일)
환경: Linux, Node **v22.22.0**(문서 기준 22.16.0과 다름), npm 10.9.4, TypeScript 5.8.3(`npm ci --ignore-scripts` 잠금), Python 3.13, Playwright **1.56.0**(requirements 핀 1.57.0과 다름; 설치된 번들 Chromium 141.0.7390.37), 직접 HTTP + MOCK, 유료 호출 0. 모두 `app/`에서 실행.

기준선(수정 전, raw/base-exits.txt):
- `npx tsc --noEmit` 0 · `node continuity/scripts/check.mjs` 0 · `node continuity/scripts/build.mjs` 0
- `node --test continuity/tests/` **1** — 내 명령 오류(디렉터리 인자). 검사기 사용 오류, 코드 무관.
- `node --test continuity/tests/*.test.mjs` **1** (210 중 6 실패, `app/dist/public/shared/diagnostics.js` 없음) — **환경/절차 문제**: README대로 부모 앱 `npm run build`를 먼저 하지 않음. `npm run build` 0 후 재실행 **0 (210/210)**.
- 브라우저 `spatial102_browser.py` 0 (11), `flow090_browser.py` 0 (18).

새 검사 최초 실패 보존(raw/exits.txt):
- `pc12_browser.py`를 **수정 전 소스**(app.ts/styles.css stash 후 빌드)에서 실행: **1** (9 중 5 FAIL·4 ERROR — `#panel-idea`, `#panel-task-*`, ‘구상 미기재’ 패널 표시 등 없음). old-fail 기록: `raw/old-pc12-on-base.log`.
- 수정 후 첫 실행: **1** (`raw/new-pc12-run1.log`). 원인 두 가지 모두 **검사기 문제**: ① `get_by_text('ZZ-END-A')`가 숨은 work/기록 화면까지 8개를 잡아 strict 위반 → `#task-view-request .source-raw` 등 범위 지정, ② 이미 열린 작성 패널 summary를 다시 클릭해 닫음 → 열림 확인 후 클릭. 첫 실행 검사본은 `raw/pc12_browser.first-run-checker.py`. 이 실행에서도 A/R 편집·복귀 구간(150행 이전)은 두 폭 모두 통과했다.
- 재실행 0 (9/9).
- 기존 `flow090_browser.py`를 v0에서 원본 그대로 실행: **1** (test_07/15/17: 숨은 `#panel-name·#panel-note` 입력 시간초과, test_12: `#panel-report` 없음) — **계약에 따른 의도된 동작 변경**. 원본 `raw/flow090_browser.base.py`, 수정 후 재실행 0 (18/18).

최종(수정 완료 소스, raw/final-exits.txt): `npm run check` 0 · `check.mjs` 0 · `build.mjs` 0 · `node --test continuity/tests/*.test.mjs` 0 (210/210) · 브라우저 `pc12` 0 (9) · `spatial102` 0 (11) · `flow090` 0 (18) · `use106` 0 (11) · `guide097` 0 (8) · `browser.py` 0 (13) · `flow083` 0 (12). 마지막에 pc12 스크린샷 위치만 옮긴 검사본으로 다시 0 (9) — `final-pc12_browser.log`는 이 재실행.
그 밖 browser 검사(connect039·ui001·flow049·select035·fresh033·ai055·static)는 바뀐 화면 ID/함수를 참조하지 않아(grep) 실행하지 않았다.

HTTP 전후(같은 서버 경로 `continuity/server/index.mjs --mock`로 받은 바이트 vs 빌드 디스크, raw/*-http-disk-hashes.txt): 기준 `client/app.js` 50195fee…, `styles.css` 87e41e81…; v0 `client/app.js` 3e1f9a90…, `styles.css` ca5a7c0f…; `index.html` ef13135f… 불변. 모두 HTTP 200·디스크 일치.

## 새 검사 장면 (`pc12_browser.py`)
조작은 실제 click/key/wheel/pointer 끌기, 관측은 렌더·표시/숨김·focus·scroll·transform·저장 상태. 상태 직접 대입 없음. 자료 설치는 제품 UI로 하고 ‘fixture’로 표시, UI로 만들 수 없는 두 경우만 내보낸 백업을 고쳐 제품 ‘백업 파일 불러오기’로 넣는 **합성 fixture**(`raw/pc12-synthetic-fixture-import.json`).
- **읽기만**(1280×720, 1440×900 각각): 영역 ‘정보’ → 이름·구상 읽기(편집 닫힘, 긴 구상 앞부분/전문 숨김, 보고 자동 발췌 없음) → 지도 확대 2회·빈 배경 끌기·휠 140 → 패널에서 A 선택 → 짧은 맥락(MOCK 제안 표시) → 긴 원문 클릭 열기/닫기, 보고 summary 키보드 Enter 열기/닫기 → 출발 지도 복귀. transform·배율 문자열·선택 카드·scrollY(±2px)·focus=`panel-task-A` 일치, **저장 프로젝트 전체가 전후 동일**(currentTaskId=R, draftKind=request, draftTarget=알림, 미전송 초안, 모든 manual). 복귀한 focus에서 Enter로 같은 작업 재진입.
- **명시 편집**(두 폭 각각): (1) current=R(A의 직접 보고): 대상 문장이 ‘작업 02 후속 확인 작업문’, ‘작업 화면으로’ → current R 유지, R의 manual 4필드에 폭별 다른 값 입력 → 복귀(시야·선택·scroll·focus 일치) → R=새 값, A 불변, 초안 종류·대상·본문 불변. (2) UI로 B(알림)+RB 생성해 current=RB: A 대상 문장이 ‘A로 바꾸고… 이전 보고를 대신 고르지 않아요’ → current=A(R 아님), A 4필드 입력 → 복귀 일치 → A 새 값, R은 (1)의 값 유지, RB·B 전체 불변. 새로고침 뒤 저장 동일, 출발점 버튼은 사라짐(탭 메모리).
- **실패 경계**(1280): 빈 영역·빈 구상(가짜 목록·확인할 일·복귀 버튼 없음, 명시 편집 저장 후 닫힘) / 기준 수정으로 낡은 MOCK 문구가 ‘제외됨’ 표시·본문은 닫힌 details / 합성: 배경 사본 없음·AI 문구 없음 Task에서 ‘기록 없어요’, ‘원문 속 조건이 없다는 뜻은 아니’, ‘이 작업에는 없음’; UI로 구상 수정 후 A 사본 ‘그 뒤 구상이 바뀜’ + ‘코드’·‘지난 방문’ 표현 없음 / 새로고침·다른 프로젝트 전환 후 출발점 버튼 없음·currentTask 유지.
- **390 최소**: 목록 ‘정보’ → 시트에서 작업 열기 → 원문 열기 → 가로 넘침 없음 → 복귀 → 시트 닫기.

## 대표 PNG (`png/`, 4장)
`pc12-1280-01-area-read.png`(읽기 기본 패널), `pc12-1280-02-task-context.png`(짧은 맥락·출처·대상 문장), `pc12-1440-06-back-after-edit.png`(RB→A 편집 후 출발 지도: 160% 배율·이동한 시야·선택 패널), `pc12-390-task.png`.

## 한계·남은 위험
- 출발 영역 보관/삭제로 인한 무효 처리는 **코드상 방어 분기만** 있다. 한 탭 UI에서는 보관이 `openSpace`를 거쳐 출발점을 먼저 지우고, 다른 탭 변경은 이 탭이 다시 읽지 않아 그 분기에 도달하는 실제 조작을 만들지 못했다. 실제로 검증한 무효 경계는 새로고침·프로젝트 전환이다.
- 출발점은 탭 메모리라 새로고침하면 사라진다(복귀 버튼만 없어짐, 작업 화면 위치는 기존 탭 기억대로 유지).
- 영역 화면의 ‘이어서 작업’처럼 ID 없는 버튼에서 떠나면 복귀 초점은 제목으로 간다.
- 프로그램 초점 복귀는 `document.activeElement`로 확인했으나 마우스 사용 뒤에는 브라우저의 focus-visible 규칙상 초점 테두리가 화면에 보이지 않을 수 있다(PNG에도 없음).
- 패널 요청 목록은 최신순 5개로 자른다(나머지는 ‘영역 열기’). 긴 구상 발췌 길이(160/320자)는 임의 기준.
- Node·Playwright 판이 문서 기준과 다르다(위 환경). Windows/CI·실제 AI·사람 이해도·공개 적용은 확인하지 않았다. 모바일 배치 최적화는 범위 밖.
- 연결된 경로 뒤 notice는 다음 편집 저장 때 사라진다(대상은 work 헤더·경로 막대에 계속 표시).
