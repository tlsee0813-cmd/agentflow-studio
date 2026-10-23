# 37 첫 방문 프로젝트 홈과 비저장 공간 예제 — 작성자 보고

2026-10-23 KST · 작성자 역할(Claude Code). 독립 검증이나 통합 판단이 아니다. 범위는 [INPUT](INPUT.md), 판단은 [MECHANISM_REVIEW](MECHANISM_REVIEW.md)를 따른다. 부모 a17cbcf의 36은 **아직 CI·Cloud 검증 대기**이며 이 보고는 36 수용을 뜻하지 않는다.

## 기준과 결과 커밋
- 시작(base): `80d9d11f9aca473d2e45de8b96ab3dbebbe9299b` (제품 기반 `a17cbcf9804154b878ccf20dfa4d5155777ce7ca`, 그 뒤 37 문서만).
- 결과(final): 이 문서를 담은 `product/project-entry-37`의 커밋. 정확한 SHA는 push 뒤 세션 회신에 적는다(문서가 자기 SHA를 담을 수 없음).
- 검사한 빌드: continuity dist app.js `f81f7ed181b0…`, styles.css `887bb94df26d…`, index.html `8b3e61971e4a…`(sha256 앞 12자).

## 진입 계약 — 바뀐 분기

| 상황 | 이전 | 37 |
|---|---|---|
| 유효 session 복원(활성 entry) | 마지막 view·지도 복원 | 같음 |
| remembered=`legacy` | 읽기 전용 복원 | 같음 |
| `STORAGE_DENIED` | 메모리 시작 + 거부 안내 | 같음 |
| entry/legacy/readError 있음 | 홈 | 같음(오류 안내 유지, 빈 정상 홈 아님) |
| **정상 fresh + writable** | 빈 목적/요청 작업 폼 | **프로젝트 홈** |
| fresh + Web Locks 없음(writable=false) | 메모리 시작 | **같음**(홈으로 보내면 ‘새 프로젝트’가 비활성) |
| 예제 열기 | 단일 요청 작업 화면, 공간 메뉴 숨김 | **전체 공간에서 시작**, 공간 메뉴·작업 위치 표시줄 보임 |
| 예제 닫기 | 저장 항목 없으면 빈 작업 | **홈**(Locks 없음+저장 항목 없음만 기존 메모리 시작) |
| 예제 → 내 프로젝트 시작하기 | 빈 작성 흐름 | 같음 |

‘모든 fresh가 홈’이 아니다. 저장할 수 없는 브라우저는 기존 메모리 입구이고 영구 저장으로 표시하지 않는다(‘저장되지 않은 변경 있음’ 유지).

## 코드 변경 (`app/continuity`)
- `src/client/app.ts`
  - 초기 분기: `else if(workspace.writable)route='projects'` 한 줄. 위 복원·legacy·DENIED·readError 분기는 그대로다.
  - `exampleProject()`: 기존 domain API만으로 구성한다. `setBrief` → 상위 `예약하기`·`알림`(`addArea`) → `예약하기` 안에 `시간 고르기`·`예약 확인`(`addChildArea`) → 관계 1개(`addRelation`) → `시간 고르기`의 요청 1개(`submit`) → 기존 MOCK 정리(`begin`/`receive`) → `markHandoff` → 같은 returnId의 직접 쓴 예제 보고를 `importResultFile`(return.2, 그 부분의 설명 포함). ID·부모·소유·returnId는 domain이 만든다. 보고 원문 첫 줄이 ‘예제 보고 · 실제로 실행한 결과가 아니에요.’이고, ‘휴무일 처리는 아직’이라는 작은 미결 하나를 문장으로만 둔다.
  - 홈 예제 카드 `exampleCard()`: 기존 `projectSummary`(카드 읽기 순서: 이름→목적→정보 줄)를 재사용한다. 별도 `#example-list`에 두고 클래스도 따로 쓴다(`example-card`, 여는 버튼 `example-open`). 그래서 실제 프로젝트 수·`#project-list`·`.project-open`·초점 복귀 대상에 섞이지 않는다. 정보 줄은 ‘저장 안 됨 · 실제 실행 아님 · 영역 4개’. 더보기 메뉴(휴지통 등)는 없다. `projectSummary`에는 여는 버튼 클래스 인자만 더했다(기본값은 기존 `project-open`).
  - `openExample()`: 공간이 있으면 `view='space'`, `#space-title`에 초점을 둔다.
  - `closeExample(false)`: 홈으로 간다. 단, writable이 아니고 저장 항목·legacy·readError가 모두 없으면 기존 메모리 시작.
  - `rememberMap()`: 예제면 바로 반환한다. 예제를 열 때마다 새 project.id가 탭당 최대 12개 지도 memo 슬롯을 차지해 실제 프로젝트의 memo를 밀어내던 경로를 막는다.
  - 예제에서 숨기던 `nav-space`와 작업 위치 표시줄 `work-place`를 보이게 했다(지도 ↔ 부분 ↔ 작업 왕복). guide(AI 호출)·영역 지정란·백업/불러오기/휴지통 숨김은 보수적으로 그대로 둔다. `persist()`의 예제 무저장 반환도 그대로다.
  - 홈 하단의 `list-example` 버튼은 예제 카드로 대체해 뺐다. 빈 작업 화면의 `open-example`은 남긴다.
- `public/index.html`: 홈의 도구 줄 아래에 `#example-section`(제목 ‘둘러보기 · 공간 예제’, 작은 글씨 ‘프로젝트 목록과 따로 있고, 열어서 고쳐도 저장되지 않아요’)과 `#example-list`.
- `public/styles.css`: 파일 끝에 홈 예제 카드만의 국소 규칙(`.projects-view .example-*`). 카드 폭·최소 높이·여백·모서리는 홈 프로젝트 카드와 같고, 테두리는 점선으로 구별한다. 36 지도 카드 CSS·`readingReasons`·수량 의미는 건드리지 않았다.
- 새 저장 키·스키마·자동 복제·current/draft 규칙 변경 없음. 실제 AI·유료 호출 없음.

## 검사 변경 (`app/continuity/tests`)
- `browser.py`(공용 harness): 정상 fresh는 이제 홈이므로, 작성부터 시작하는 기존 여정의 초기화 전제를 제품의 기존 ‘새 프로젝트’ 클릭으로 좁게 보완했다(`start_new`). 실제 카드가 있는 홈은 그대로 둔다. `open_listed`도 빈 홈이면 같은 경로를 쓴다. 홈 자체를 보는 suite는 `start_at_home=True`로 끈다. 단언 삭제·표시 요소 제외·기하 완화는 없다.
- `use106_browser.py` test_11: 장애 주입 뒤 fresh 새로고침 직후 `base.start_new` 한 줄(아래 실행 표).
- `flow083_browser.py` test_01: 첫 화면 단언은 setUp의 ‘새 프로젝트’ 뒤 그대로다. 예제가 공간에서 열리므로 기존 작업 화면 단언 전에 `#nav-work`를 누른다. 예제 닫기의 기대를 빈 작업에서 **빈 홈(실제 카드 0, localStorage 키 0)**으로 바꾸고, 이어서 ‘새 프로젝트’로 기존 빈 시작을 확인한다.
- `home15_browser.py` test_02: 빈 저장소 새로고침의 기대를 `#empty`에서 **홈(빈 안내·실제 카드 0·예제 카드 1)**으로 바꾸고, ‘새 프로젝트’로 기존 시작 경로를 확인한다. 기존 홈 레이아웃 단언(제목 1회, 보조 도구 첫 화면 등)은 그대로이며 37 문구·배치를 거기에 맞췄다(아래 ‘작성 중 실패’).
- 새 `entry37_browser.py`(1280×720·1440×900 각 4건):
  1. fresh 홈 → 예제 카드 → 전체 공간(목적·상위/하위 4부분·‘소속 · 예약하기’/‘독립 영역’) → `시간 고르기` 부분 → 그 요청 읽기(예제 보고 표시) → 작업 화면(위치 표시줄) → ‘전체 공간’ 복귀(같은 카메라 transform) → 닫기 → 빈 홈. 전 과정 localStorage 키 0, 예제 지도 memo 없음. 기본 화면 텍스트에 시험 식별자(합성·E0n·검사N·H_/T_/A_ id) 없음.
  2. 예제의 ‘내 프로젝트 시작하기’: 빈 목적·빈 draft. 목적 저장 뒤 저장본은 entry 1개(origin new), areas/tasks/bases/sources/relations 모두 빈 배열, currentTaskId null, ‘미용실·시간 고르기·예약하기·예제’ 문자열 없음.
  3. 실제 6개 프로젝트 저장본(home15 fixture, 미전송 초안·수동 작업문 포함)에서 A의 지도를 확대해 memo를 남긴 뒤, 예제를 13회 열고 닫는다(4회는 부분→작업→작업문 수정까지). workspace 원문이 **바이트 동일**(현재 작업·별도 초안·seq 포함)하고, 카드 6개를 유지한다. 지도 memo id 집합은 `{A}`뿐이고, A를 다시 열면 같은 카메라다.
  4. 유효 session 복원(A의 부분 화면 새로고침 → 같은 부분), 저장본 손상(`{broken`: 읽기 오류 안내 홈, 빈 안내 없음, ‘새 프로젝트’ 비활성, 예제 닫기 뒤에도 안내·원문 유지), 저장소 거부(기존 메모리 시작+거부 안내, 예제 닫기 → 읽기 오류 안내 홈), Web Locks 없음(fresh 메모리 시작+Web Locks 안내, 예제 닫기 → 다시 메모리 시작, ‘저장되지 않은 변경 있음’, 키 0), Locks 없음+legacy 값(읽기 전용 카드, 연 뒤 새로고침에서 legacy 복원, 예제 닫기 → 홈, legacy 원문 바이트 동일·workspace 키 없음).
- **memo 경계의 회귀 확인:** `rememberMap` guard를 임시로 뺀 빌드에서 3번이 실제로 실패했다(`… not found in {12개 예제 id} : the real project map memo is kept`). guard를 되돌린 빌드에서는 통과했다.

## 작성 중 실패와 처리(숨기지 않음)
- home15 test_01·test_02(1280·1440, 4건): `title once` `[False, 2] != [False, 1]`. 37 소제목의 ‘**내 프로젝트** 목록과 따로…’가 제목 문자열을 한 번 더 만든 제품 문구 문제였다. 문구를 ‘프로젝트 목록과 따로…’로 바꿨다. 같은 수정에서 기존 ‘보조 도구가 첫 화면에 보임’ 계약을 지키려고 예제 구역을 도구 줄 아래로 옮겼다. 단언은 바꾸지 않았다.
- entry37 1차: 부분 화면 경로(`#space-crumb`)에 부모 이름이 있다고 가정했으나, 기존 제품은 ‘전체 공간 › 시간 고르기’만 보인다. 부분 renderer는 바꾸지 않았다. 부모 관계는 지도 카드의 ‘소속 · 예약하기’로 단언하고, 부분 화면은 그 부분의 설명 문장으로 확인하도록 내 검사를 고쳤다.
- PNG 판독으로 고친 것: 1280 홈 카드에서 머리줄 태그 ‘저장 안 됨’ 때문에 이름이 ‘예제 · 동네 미용실 예 / 약’으로 끊겼다. 태그를 정보 줄로 옮기고 이름 1줄 단언을 더했다.

## 작성자 실행

원격 컨테이너: Node **v22.22.0**(CI 고정 22.16.0 아님), npm 10.9.2 lock 설치, TypeScript 5.8.3, Python 3.13.16, Playwright 1.57.0, Chromium **141.0.7390.37**(`BROWSER_EXECUTABLE=/opt/pw-browsers/chromium-1194/...`; CI 143 아님). 모두 AI_MODE=mock, ALLOW_PAID_AI=false, 키 없음, direct-http, 외부 요청 0.

| 명령 | exit | 결과 |
|---|---|---|
| `npm run check` | 0 | 통과 |
| `npm test`(main app 빌드+node) | 1 | 278/279. 실패 1 = `retest-init006` I6R: `scripts/init006/run.mjs:63`이 `process.version==='v22.16.0'`을 요구, 이 환경 v22.22.0 → `INVALID_EVAL_OPTIONS`. 실행환경 차이이며 37 파일과 무관. 실제 호출 없음 |
| `node continuity/scripts/check.mjs` | 0 | 통과 |
| `node continuity/scripts/build.mjs` | 0 | 통과 |
| `node --test continuity/tests/*.test.mjs` | 0 | 279/279 |
| `build-static.mjs`, `build-static.mjs --preview` | 0, 0 | 통과 |
| entry37(새) | 0 | 8/8 (1280·1440 각 4) |
| flow083 / home15 / static | 0 / 0 / 0 | 12 / 21 / 3 |
| continuity browser / ui001 / fresh033 / select035 / connect039 / flow049 / ai055 | 모두 0 | 13 / 11 / 3 / 3 / 5 / 6 / 4 |
| flow090 / guide097 / spatial102 / pc12 / pc13 / report16 / understanding17 | 모두 0 | 18 / 8 / 11 / 19 / 14 / 13 / 12 |
| work-description29 / branch-records31 / hierarchy18 / workspace19 / received20 / blank21 / viewport30 | 모두 0 | 8 / 10 / 12 / 6 / 11 / 2 / 4 |
| use106 | 1 → 0 | 1차 10/11: test_11이 config 장애 주입 뒤 **fresh 새로고침**하므로 이제 홈에 도착해 숨은 `#brief-input` fill timeout(37 원인). 새로고침 뒤 `base.start_new` 한 줄로 전제만 보완 → 11/11 |
| map-priority36 | 1 | 6/12 실패 — **부모 36 known failure**, 아래 참고 |

- 모든 browser 결과는 같은 최종 app 빌드(위 dist 해시)다. use106만 검사 파일 수정 뒤 다시 돌렸다.
- **map-priority36 6건:** test_01~03 × 1280·1440. assertion은 `[{'sel': 'tag area-undecided', 'text': '구상 미기재', 'inside': False, …}] != []`와 `area-card-note '[합성34 …'` 경계다. 같은 환경에서 **기준 `80d9d11` 별도 worktree 빌드도 같은 6건, 같은 assertion으로 실패**했다. 37 변경과 무관한 부모 36의 P카드 tag/note 경계 실패가 Chromium 141에서도 재현된 것이다. 숨기거나 단언·표시 요소를 빼지 않았다.
- 미실행: main app `tests/browser.py`(37 무관), 양OS CI(Windows 포함), Chromium 143 정확 버전, Cloud 실제 조작, 사람 사용성, DOM-bridge 모드.
- `.github/workflows/verify.yml`: HOME15 단계 바로 뒤에 ENTRY37 단계 7줄을 추가했다(기존 CRLF 유지, yaml 파싱 확인). 최종 CI는 총괄이 36fix 통합 head에서 돌린다.

## 대표 화면(직접 읽음) — [author-v0](author-v0/)
- `entry37-1280-1-home.png`·`entry37-1440-1-home.png`: 빈 안내, 백업 불러오기, ‘둘러보기 · 공간 예제’ 점선 카드(이름 1줄, 목적 2줄, ‘저장 안 됨 · 실제 실행 아님 · 영역 4개’)가 첫 화면에 보인다.
- `entry37-1280-2-space.png`·`entry37-1440-2-space.png`: 예제 띠와 목적, 상위 2개·하위 2개 카드(‘소속 · 예약하기’), 관계 화살표, 하위의 ‘앱에서 이어갈 작업’ 표지가 보인다. 기록 요약은 36 기존 표시 ‘이어 볼 기록 1개 · 후속 작업문 없는 보고 1’이다. 37은 이를 미답 질문 수와 합치지 않았고 새 카운터를 만들지 않았다.
- `entry37-1280-3-part.png`: 부분 화면. 이름·설명, 전달 기록에서 정리한 설명(앱 미검증)이 보인다.
- `entry37-1280-4-task.png`·`entry37-1440-4-task.png`: 요청 원문, ‘구현 보고 도착 · 앱 미검증’, 돌아온 결과 1개(‘예제 보고 · 실제로 실행한 결과가 아니에요’), ‘작업 화면으로’, ‘출발한 지도 보기로’가 보인다.
- `entry37-1280-5-work-top.png`: 작업 화면 위치 표시줄 ‘전체 공간 › 시간 고르기 › 작업 01의 보고 · 후속 확인 작업문 초안’과 지도 복귀 버튼이 보인다.
- `entry37-1280-6-space-again.png`: 지도 복귀. 카메라는 같다(transform 동일 단언).
- `entry37-1280-7-closed.png`, `entry37-1280-8-start-own.png`, `entry37-1280-9-unreadable.png`, `entry37-1280-10-no-locks.png`: 닫은 뒤 빈 홈, 빈 목적 입력, 읽기 오류 안내 홈, Locks 없음 메모리 시작이다.

## 관측한 한계(이번에 고치지 않음)
- **작은 지도 글씨:** 1280 기본 맞춤이 78%라 카드 글자가 화면에서 작다. 1440은 120%다. 36의 기존 맞춤·글자 크기 한계이며, 37은 배율·카드 CSS를 바꾸지 않았다. 상자 통과를 가독성 통과로 대신하지 않는다.
- **이어가기 안내가 지도에 남음:** 작업 화면의 ‘작업 01 요청에서 이어가기…’ 안내가 지도 복귀 뒤에도 남아 지도를 아래로 민다. 1280에서는 하위 카드 아래쪽이 지도 틀 밖으로 나가 ‘화면 밖 영역 2개’ 표시가 생겼다. 카메라 값은 같다. 기존 `continueTask` 알림 동작이다.
- **부분 화면 경로:** 부분 화면의 경로는 부모 이름을 보이지 않는다(기존). 포함 관계는 지도에서 읽는다.
- **예제 안 새로고침:** 예제가 아니라 홈으로 돌아간다(OPEN_KEY 비움, 의도). 예제 편집은 메모리에만 있고 닫으면 사라진다.
- 사람 사용성, Cloud 실제 조작, 양OS CI, Windows 폰트, 모바일 재설계, 임의 배율은 이 보고의 범위 밖이다.

## 부모 36 known failure와의 구별
총괄 기록: 36 CI(Chromium 143)에서 P카드 tag/note 경계 6건이 실패하고 별도 Claude36 세션이 수정 중이다. 37은 그 카드 CSS·`readingReasons`·수량을 건드리지 않았다. 이 환경(Chromium 141)에서도 map-priority36이 6/12 실패했고, 기준 `80d9d11` 빌드에서도 같은 6건·같은 assertion이 나왔다(위 표). 37 결과로 그 실패를 덮지 않는다. 최종 판단은 36fix를 통합한 정확 head의 CI에서 한다.

## GitHub 근거 위치
INPUT은 delivery 새 접두사를 말하지만, 이번 지시는 `product/project-entry-37` 외 branch 갱신을 금지했다. 그래서 대표 PNG 13장(1.3MB)을 이 branch의 [author-v0](author-v0/)에만 두었다. 원 로그와 나머지 PNG는 원격 컨테이너 scratchpad에만 있고 커밋하지 않았다(개인 경로 포함 traceback).
