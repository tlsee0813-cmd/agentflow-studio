# 프로젝트 홈15 — 작성자 v0 (Opus 홈 구현 세션)

**작성자 검사 결과이며 독립 검사가 아니다.** 기준 `16f6b71fda204ce8b79a75e3af5460367704ed82`(app은 `6061205`와 동일). 고정 diff `home15-author-v0.diff`(sha256 `diff.sha256`), 변경 파일 `CHANGED_FILES.txt`. 실제 `app/continuity`에만 구현했다. 새 프레임워크·의존성·schema·server·AI·저장 형식 변경 없음.

## 바뀐 것
- **홈 배치(홈 전용 CSS, `body[data-route="projects"]`·`.projects-view` 범위)**: 홈에서 상단바·MY PROJECTS·설명문·상단 ‘내 프로젝트’ 링크를 없애고 제목 한 곳(`내 프로젝트` + 개수) 오른쪽에 모드 표시와 `＋ 새 프로젝트`. 사이드바의 ‘지금 이어가는 프로젝트/첫 작업을 기다림’과 하단 안내 문단은 홈에서만 숨김. 카드는 `auto-fill minmax(296px,1fr)`·간격16, 목록 폭 최대1096(1760 이상 1480)이라 1개여도 같은 블록 폭.
- **카드 정보**: 이니셜 표시 · 이름(2줄) · 실제 목적 `space.brief.text`(2줄, 전체는 title) · `작업 기록 · {시각}` + 낮은 강조 `영역 N개`. 목적 없으면 `목적을 아직 적지 않았어요`. 마지막 요청·요청/결과 건수·관리 버튼은 카드에서 제거. 시각은 기존 `lastActivity`(원문·작업문 내보내기) 그대로이며 라벨을 ‘작업 기록’으로 좁혔고 범위 설명은 title 한 줄에만 둠(카드 본문에 늘리지 않음).
- **진입**: 이름이 카드의 유일한 열기 버튼(Enter/Space), 본문 클릭도 열기. 중첩 컨트롤 없음. 공간이 있으면 목록 진입은 `openEntry(entry,true)`로 **recallPlace를 쓰지 않고 전체 공간**으로 가며 제목에 초점. 새로고침은 기존대로 탭 위치 유지. 공간 없는 프로젝트는 기존 작업 시작 경로. 지도 보기 기억은 탭 sessionStorage에 프로젝트별(최대12)로 남겨 B를 다녀와도 A의 배율/위치를 자동 맞춤으로 덮지 않음.
- **복귀**: 목록으로 오면 방금 떠난 프로젝트 카드의 열기 버튼에 초점, 목록에서 열었던 경우 그때 스크롤 위치.
- **더보기**: 카드마다 `⋯`(details/summary) 안에 `휴지통으로 옮기기`. 메뉴 안 클릭·Enter는 카드를 열지 않음, 바깥 클릭은 메뉴만 닫음(그 클릭으로 다른 카드가 열리지 않음), Esc는 닫고 `⋯`로 초점. 기존 확인창·되돌리기·휴지통 영역·복원은 그대로.
- 불러오기·예제는 카드 아래 보조 줄, 저장 위치 사실은 왼쪽 ‘이 브라우저의 프로젝트’와 하단 footer에 유지. 읽기 오류·저장불가 알림은 그대로 목록 위에 표시.

## 측정(작성자, 합성 fixture)
| | 제목 | 첫 카드 x/y | 카드 폭×높이 | 열 | 보조 줄 하단 |
|---|---|---|---|---|---|
| 1280×720 6개 | x250 y39 | 250 / 104 | 323.3×176 | 3 | 528 |
| 1440×900 6개 | x250 y39 | 250 / 104 | 354.7×176 | 3 | 528 |
| 1개(두 PC) | 동일 | 250 / 104 | 323.3 / 354.7 ×176 | 1칸(전폭 아님) | 336 |

좌측 탐색 뒤 28px 시작, 본문 여백18, 이름16·목적13.5·보조12px. 원자료 `raw/home15-observations.jsonl`(조건 224개 기록).

**계약 대비 이탈 1건**: 사이드바 폭은 222px로 유지(목표224~240). 홈에서만 넓히면 프로젝트 진입 때 폭이 바뀌고, 전체를 넓히면 공간13 내부 폭이 바뀌어 ‘홈 CSS로 내부 불변’ 원칙과 충돌하기 때문. 총괄 판단으로 224 전역 변경 가능(2px).
**선택 사항**: 사이드바 항목 이름은 기존 ‘내 프로젝트’ 유지(알림 문구 여러 곳이 이 이름을 가리킴). 홈에서 상단바를 숨기고 모드 표시를 제목 줄로 옮김(같은 요소를 이동, 프로젝트 안에서는 원래 위치).

## 검사(실제 종료값)
| 명령(app/에서) | 종료 |
|---|---|
| `node continuity/scripts/check.mjs` (tsc·구문·경계) | 0 |
| `node continuity/scripts/build.mjs` | 0 |
| `python3 continuity/tests/home15_browser.py` — 1280·1440 각 7, 390 1 = 15 | 0 (OK) |
| `flow083_browser.py` 12 | 0 |
| `spatial102_browser.py` 11 | 0 |
| `flow090_browser.py` 18 | 0 |
| `pc12_browser.py` 15 | 0 |
| `pc13_browser.py` 14 | 0 |
| `node --test continuity/tests/*.test.mjs` 210 | 0 |

home15: 0/1/6·긴 제목/목적·목적 없음 두 PC 배치·정보, A/B(서로 다른 목적·수동 문장·미전송 초안) 카드 클릭→A 공간, 키보드 Tab→B Enter→B 공간, 내용 혼합 없음, 열기·복귀로 저장 envelope 바이트 불변, 복귀 초점, A 작업 화면에서 떠나도 목록 진입은 전체 공간, B 경유 후 A 지도 transform 유지, 새로고침 위치 유지, 메뉴 클릭/여백/바깥/Esc/Enter, 휴지통 거절·수락·되돌리기, 공간 없는 D·F 기존 경로(초안 보존), 읽기 오류 표시, 빈 저장소의 기존 새 프로젝트 시작과 플레이스홀더 미저장, 390 가로 넘침 없음.
기존 검사 수정은 의도된 변경에 따른 최소한: flow083 카드 문구 기대(마지막 요청→목적/작업 기록), 휴지통 클릭 전에 `⋯` 열기; spatial102 카드 본문 클래스명. 전체 과거 검사 일괄 재실행은 하지 않음.

**한계**: 화면 판단은 작성자 눈과 수치뿐이다. 실제 Windows·125% 확대·실사용자 자료·임의 긴 목록 성능은 미확인. 카드 이니셜 표시는 장식(aria-hidden)이다. 작업 중 테스트 클릭 좌표 오류(둥근 모서리 밖) 1건을 검사 쪽에서 고쳤고, Esc가 메뉴 밖 초점에서도 메뉴를 닫도록 제품 쪽을 보강했다.

## 대표 화면
`home15-1280-six.png`, `home15-1440-six.png`, `home15-1440-one.png`, `home15-1280-zero.png`(활성0·휴지통1).

## 재현
```sh
git checkout 16f6b71fda204ce8b79a75e3af5460367704ed82 && git apply docs/transfer/project-home-15/author-v0/home15-author-v0.diff
cd app && npm ci --ignore-scripts --no-audit --no-fund && npm run build && node continuity/scripts/build.mjs
python continuity/tests/home15_browser.py      # fixture 생성 포함, 화면은 continuity/test-results/home15-*.png
node continuity/server/index.mjs --mock         # 직접 보기: localStorage에 test-results/home15-six.json 값을 agentflow.idea015.workspace로 넣고 새로고침
```
환경: Linux, Node 22.22.0, Playwright Chromium headless. Pro 홈 연구의 후속 교정을 받을 수 있다.
