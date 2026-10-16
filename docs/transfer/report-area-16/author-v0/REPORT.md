# REPORT16 구현 후보 (독립 검토용 고정본 · 제품 완성 선언 아님)

- 제품 기준: `a5a48a715c41d1f8ea928af48a33d264c295a128`
- 계약: `b818e45ded8f7fc73ddd3ac497c94b42d11f1273` (`docs/cycles/2026-10-16-report-area-16/` 아래 IMPLEMENTATION·ACCEPTANCE·INPUT)
- 후보 커밋: `71a72298bc1b23279ab4ac03f778b87eb18d145e`
  - 로컬 전용이며 push·PR은 하지 않았다. `candidate.patch`는 `git am`으로 적용할 수 있다.
- 실행 환경: 이 클라우드 작업공간. Node v22.22.0, npm 10.9.4(packageManager 10.9.2와 다름), Playwright Chromium headless. MOCK 모드이며 유료 AI 호출은 0건이다.

## 변경 파일
| 파일 | 내용 |
|---|---|
| `app/continuity/src/client/app.ts` | renderTaskView 재구성. 보고 선택(`reportsOf`·`pickReport`), 선택 보고(`pointedSection` 확장), 다음 동작(`nextAction`·`openUnsent`), 펼침 기억(`readOpen`·`keepReadOpen`). `areaIdea`에 label 인자 추가. `writeInArea` 안내문이 null과 `{area:null}`을 구분하도록 수정(`draftTargetLabel`) |
| `app/continuity/public/styles.css` | REPORT16 블록 37줄 추가. 기존 규칙은 바꾸지 않았다 |
| `app/continuity/tests/report16_browser.py` | 신규. 1280/1440/390, 12개 테스트 |
| `app/continuity/tests/pc12_browser.py`, `flow090_browser.py` | 사라진 `#task-view-results`(모든 보고를 한꺼번에 펼치던 블록) 참조만 '명시 선택 → 선택 보고 전문 펼침'으로 좁게 갱신. 원문 전문 일치·미선택·복귀·저장 불변 검사는 유지 |

schema, provider/server, 의존성, 홈, 지도는 변경하지 않았다. GUIDE107은 그대로 HOLD 상태다.

## 동작 요약
- **화면 구성:** PC(1000px 이상)는 좌우 2열이다.
  - 왼쪽: 지금의 영역 구상(Area.note, 기존 areaIdea)과 그 아래 다음 동작.
  - 오른쪽: 고른 보고의 실제 원문, 그 아래 선택 목록.
  - 요청 당시 구상 사본과 현재 구상이 다르면 한 줄로 알린다. 당시 사본은 기존 배경 사본에 그대로 있다.
- **보고 목록:**
  - `pointedReturn`/`rootRequest`와 같은 기준으로 만든다. 중첩 후속 보고는 포함하고, 다른 요청의 보고는 넣지 않는다.
  - 자동 선택은 없다. 1개뿐이어도 직접 골라야 한다.
  - 선택하지 않은 보고는 제목(기존 taskTitle 2줄)과 작업번호·종류·시각만 보인다.
- **선택 보고 표시:**
  - 짧으면 전문을, 길면 원문 앞부분(최대 6줄·300자, 줄바꿈 유지)을 보여주고 '위는 앞부분이에요 · 요약이 아니에요'라고 밝힌다. 전문은 명시적으로 펼친다.
  - 반환 Task의 모든 sourceIds를 종류별로 보여준다. 누락된 source는 경고로 표시하고 다른 원문으로 대체하지 않는다.
  - 연결 경로는 펼침 안에 둔다.
- **stale·foreign 보고 ID:** '찾을 수 없어요'를 표시하고 아무것도 눌림 상태로 두지 않는다. 사용자가 다른 보고를 직접 고르는 것은 가능하다.
- **다음 동작:**
  - 미전송 입력이 없고 영역이 활성이면 '이 영역에 새 요청'(기존 writeInArea)이다.
  - 미전송 입력이 있으면 버튼 이름부터 '작성 중인 요청/보고/관찰 열기'가 되고, 클릭 전에 대상이 그대로임을 알린다. null은 '지금 작업을 따라감', `{area:null}`은 '영역 없이'로 표시하고, 보고는 연결 예정 작업을 표시한다.
  - 보관 영역과 미지정 영역에서는 버튼을 비활성화하고 이유를 표시한다. 기존 미전송 입력을 여는 것은 가능하다.
  - 기존 '이 작업 이어서 하기/작업 화면으로'는 별도 보조 버튼으로 두었고 정책은 바꾸지 않았다.
- **복귀와 상태 유지:**
  - origin이 있으면 기존 '← 출발한 지도 보기로'를 쓴다. 없으면(예: 새로고침) '전체 공간으로'만 제공하고 출발점 복원을 약속하지 않는다.
  - 보고 선택과 펼침은 탭 메모리(viewReturn, readOpen)에만 둔다. 같은 요청·같은 보고에서는 다시 그려도 유지되고, 다른 보고로 넘어가면 이전 보고의 펼침은 넘어가지 않는다.

## 보완 전후 실제 좌표 (F10 실제 재서술 보고 선택, `READ_JS` 측정)
| 시점 | 폭 | idea.top | lead.top | 차이 | 다음 동작(top–bottom) |
|---|---|---|---|---|---|
| 보완 전(목록 → 선택 보고) | 1280×720·1440×900 | 388.375 | 585.406 | 197.0px | 1280: 556.6–601.6 |
| 최종 | 1280×720 | 387.016 | 405.516 | **18.5px** | 534.2–579.2 |
| 최종 | 1440×900 | 387.016 | 405.516 | **18.5px** | 512.0–557.0 |

**채택한 방법:**
- 선택 보고를 오른쪽 열 맨 위에 두고, 구상 라벨과 같은 높이의 낮은 강조 한 줄(고른 보고·작업·시각·외부 원문·앱 미검증)로 시작했다.
- 선택 목록은 그 아래로 옮겼다.
- 큰 TASK 헤더는 19px·최대 2줄로 줄였다.
- 중복 '미검증' 표기와 h3를 없앴다.
- 글씨 크기는 구상과 보고가 모두 14px로 같다. 줄여서 맞추지 않았다.

남은 18.5px는 F10 보고에 원문이 두 개(보고+합성 관찰)라 붙는 '구현자 보고' 종류 라벨 한 줄이다. row-overlap 검사를 완화한 것이 아니라 실제 배치를 바꿔서 줄였다. 화면 1·2에서 직접 확인할 수 있다.

## 검사 (실제 child 종료값)
실행 위치는 `app/`이다. 먼저 `node continuity/scripts/build.mjs`를 실행한다.

| 명령 | 결과 | 검사한 판본 |
|---|---|---|
| `node continuity/scripts/check.mjs` | 0 | 최종 직전(마지막 CSS 여백 2줄 전, TS 동일) |
| `python3 continuity/tests/report16_browser.py` | 0 (12/12) | 최종 |
| `spatial102_browser.py` / `pc12_browser.py` / `flow090_browser.py` | 0 / 0 / 0 | 최종 |
| `pc13_browser.py` / `home15_browser.py` / `guide097_browser.py` | 0 / 0 / 0 | 최종 직전(이후 변경은 `.task-pointed` 안의 CSS뿐) |
| `node --test continuity/tests/*.test.mjs` | 0 (210/210) | 최종 |

- 실패하면 비정상 종료한다. 실제로 개발 중 pc12와 flow090이 `#task-view-results` 부재로 exit 1이 났고, 위의 좁은 갱신 뒤 0이 되었다.
- 로그와 조건별 기대값/실측 JSONL은 `evidence/`에 있다.

## ACCEPTANCE 대응과 한계 (성공으로 숨기지 않음)
1. **ACCEPTANCE 1~3, 5, 6, 9, 11:** report16 test_01·02·05에서 양PC로 확인했다.
   - 저장본 전체 동일, POST 0건, 원점 matrix·카드 rect·선택·펼침·windowY·초점 복원을 검사했다.
   - 펼친 전문은 스크롤 박스 안에서 실제로 렌더되는지 확인했다(Range rect). 닫힌 상태는 `checkVisibility`와 details 높이(=summary 높이)로 확인했다.
2. **ACCEPTANCE 7·8:** test_03(양PC)에서 확인했다. 다른 영역 요청 → 영역 없이 → 따라감 → 미전송 보고(명시 연결 작업 A 유지, 선택 보고 R2를 대입하지 않음) 순서다.
3. **ACCEPTANCE 4·10:** test_04·06(1280)에서 확인했다. missing·foreign RB·비보고 B, 보관 영역, 영역 미지정 요청을 다뤘다.
4. **미실행 — source 누락 경로:** 코드 경로는 있지만 실행 검증은 하지 않았다. `parseProject`가 모든 sourceIds의 존재를 요구해 유효 데이터나 가져오기로는 만들 수 없다. 대신 원문 2개(결과 파일 보고+관찰) 접근만 실제로 검사했다.
5. **약한 검사 — ACCEPTANCE 12의 '출발 영역 소실 fallback':** test_07에서 실제로 실행되지 않았다. `place-area`로 영역에 들어가는 순간 기존 openArea가 origin을 비우므로 `if back.count()` 분기가 건너뛰어진다. 긴 구상 펼침→요청 초안 저장→복귀(펼침·초점·windowY·초안 유지)는 실행됐다. 소실 fallback 자체는 기존 PC12 검사 범위다.
6. **재렌더 유지:** 같은 보고를 다시 눌러 생기는 재그리기로만 검증했다. 다른 탭 storage 이벤트로 인한 재그리기는 검사하지 않았다.
7. **검토 포인트 — 목록 위치:** 선택 후 목록이 선택 보고 아래로 내려가는 배치는 비교 접점을 위한 선택이다. 초점은 누른 항목에 남지만 목록 위치가 바뀌는 것이 어색하지 않은지는 독립 검토가 필요하다.
8. **390:** 접근 가능 여부(가로 스크롤 없음, 선택·다음 동작 노출)만 확인했다.

## 화면 (screens/)
1. `1-pc1280-f10-idea-beside-picked-report.png`: 1280 F10 기본 비교 장면.
   - 왼쪽은 합성 구상, 오른쪽은 실제 보고 재서술(작성자 주장)과 합성 관찰이다.
   - 다른 영역 미전송 요청이 있어 버튼이 '작성 중인 요청 열기 · 대상 그대로 · 영역 ‘알림 설정’'이다.
2. `2-pc1440-f10-idea-beside-picked-report.png`: 같은 장면, 1440.
3. `3-pc1440-long-nested-report-opening.png`: 중첩 후속 긴 보고 R2의 앞부분, '위는 앞부분', 전문·연결 경로 접힘 상태.
4. `4-pc1280-other-area-unsent-request-opened-as-is.png`: 클릭 뒤 다른 영역 미전송 요청이 본문·대상 그대로 열린 화면.

**입력 구분:**
- REAL_R1은 PowerToys PR #51150 comment 4257710120(2026-10-13 10:51:30 UTC)을 한국어로 재서술한 것이다. 작성자 주장이며 앱·총괄 모두 검증하지 않았다. 사람 이름은 복제하지 않았다.
- 나머지는 모두 합성이다. 화면 안 라벨에도 [실제 보고 재서술·작성자 주장], [합성 …]으로 표시했다.

## 재현
```sh
git checkout a5a48a715c41d1f8ea928af48a33d264c295a128 && git am candidate.patch   # 또는 git apply source.diff
cd app && npm ci --ignore-scripts --no-audit --no-fund && npm run build
node continuity/scripts/build.mjs && node continuity/scripts/check.mjs
python3 continuity/tests/report16_browser.py      # PNG/JSONL → continuity/test-results/report16-*
python3 continuity/tests/pc12_browser.py; python3 continuity/tests/spatial102_browser.py; python3 continuity/tests/flow090_browser.py
```
