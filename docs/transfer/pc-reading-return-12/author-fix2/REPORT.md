# PC 연결12 — 작성자 fix2 보고 (Opus, 작성자 검사)

작성 2026-10-16 KST. 기준은 총괄이 고정한 fix1 product commit `c5fd2697f43c5ae2fe7155e63533e8569a5b6aa6`이다. 이를 fetch해 detached checkout했고, 내 로컬 fix1과 다섯 파일이 바이트 단위로 같음을 확인했다. 원본 fix1 묶음은 수정하지 않았다. 이 문서는 작성자 검사 기록이며 독립 검증이나 사람 사용성 판정이 아니다.

## 원인 (재현으로 확인)
영역 화면에서 출발해 명시 이어가기를 한 뒤 복귀하면, 호출 버튼 위쪽 내용 높이가 업무 상태에 따라 정상적으로 바뀐다. 원인 요소는 화면 상단 feedback 영역의 `#notice`이다.
- `continueTask`가 이어간 대상을 알리는 notice를 띄운다.
- 그 뒤 수동 편집을 저장하면 기존 `change()`가 notice를 지운다.

레이아웃 기록(`raw/fix1product-run2-observations.jsonl`의 `layout`)에서 다음이 확인된다.
- notice 높이는 출발 시 0, 이어가기만 하고 복귀하면 49.6px(+여백)이다. 문서 높이는 1543→1611로 바뀐다.
- 호출 버튼의 viewport y는 **정확히 67.59375px** 이동한다.
- 이는 Cloud가 보고한 1440 −67.59px와 같은 값이다.

방향은 경로에 따라 다르다.
- 출발 때 notice가 없고 돌아올 때 있으면, 위가 늘어 버튼이 아래로 밀린다.
- 출발 때 notice가 있고 편집 저장으로 사라지면, 위가 줄어 버튼이 위로 올라가고 문서 끝에서는 scrollY가 clamp된다.
- 지도 패널 경로에서도 같은 상단 영역이 있지만, 기존 13개 장면에서는 출발·복귀의 내용 높이가 같았다.

## 변경 (fix1 대비, `files/`에 원 repo 경로)
| 파일 | numstat | 내용 |
|---|---|---|
| `app/continuity/src/client/app.ts` | +11/−2 | 출발점에 호출 컨트롤 앵커 추가, 복귀 시 조건부 보정 |
| `app/continuity/tests/pc12_browser.py` | +66/−0 | 영역 화면 출발 장면(test_10, 두 폭) |

`fix1-to-fix2.diff`를 `c5fd2697` worktree에 `git apply`하면 두 파일과 바이트 단위로 같다.

제품 동작은 다음과 같다.
- `markOrigin`이 호출 컨트롤(이름 있는 버튼 ID)의 viewport top과 페이지 위치를 탭 메모리 `origin.anchor`에 함께 남긴다.
- `returnToOrigin`은 기존처럼 다시 그리고, 펼침을 복원한 뒤, 기존 `windowY`로 스크롤한다.
- 그 컨트롤의 페이지 위치가 1px 이상 달라졌을 때만 컨트롤이 출발 때의 viewport y에 오도록 한 번 스크롤한다. 그 뒤 기존 `focus({preventScroll:true})`를 부른다.

다음은 바꾸지 않았다.
- 내용이 같으면 `windowY`를 그대로 쓴다.
- currentTask, 수동값, notice 같은 업무 상태를 되돌려 높이를 맞추지 않는다.
- 지도 고유 좌표, 배율, 선택은 v0/fix1 그대로다.
- 앵커가 없거나(ID 없는 버튼) 영역이 사라진 경우는 기존 경로(`windowY`, 또는 상위 보기와 위치 0)를 따른다.
- padding, 새 엔진, 새 schema는 추가하지 않았다.

## 새 장면 test_10 (1280×720, 1440×900, 영역 화면 출발)
fixture는 UI로 만든다: 2000자 구상, A, R(A의 직접 보고), 이후 B와 RB. 매 출발마다 구상 전체보기를 열고, 휠로 `#task-open-A`가 화면 아래쪽에 오도록 내린 뒤 실제 클릭한다.

세 왕복을 차례로 한다.
- (0) current=R에서 A를 읽고 이어간 뒤(R 유지), 편집 없이 복귀한다. 위가 늘어나는 경우다. 저장 상태는 전후 동일하다.
- (1) notice가 보이는 채로 출발해 이어가기 → R의 4필드 편집 → 복귀한다. 편집 저장으로 위가 줄어드는 경우로, Cloud의 편집 복귀 장면에 해당한다.
- (2) current=RB에서 A로 전환 → A의 4필드 편집 → 복귀한다. 이 자료에서는 위쪽 내용 변화가 없다.

관측 방식은 다음과 같다.
- 복귀 직후 Playwright 스크롤이나 추가 focus 호출 없이 `evaluate`로 원시 값만 읽는다: 호출 버튼 rect, 중앙 `elementFromPoint`, `activeElement`, 열린 details, windowY, 문서 높이.
- 각 조건은 `pass`와 함께 JSONL에 기록하고, 실패를 모아 왕복이 모두 끝난 뒤 판정한다.

## 실행 기록 (`tools/collect.py` → `raw/collector.jsonl`, child별 실제 returncode·시각)
| child | rc | 설명 |
|---|---|---|
| fix1product-pc12-test10 | 0 | 첫 장면(왕복 (1)·(2)만, 출발 때 notice 없음)은 **fix1에서 재현되지 않음**. 문서 높이 불변 |
| fix1product-pc12-test10-run2 | 1 | 왕복 (0) 추가 → fix1에서 67.59375px 이동 재현. 첫 실패에서 중단 |
| fix2-*(check/build/pc12 15/spatial102 11/flow090 18) | 0 | fix2 첫 실행 |
| fix1product-pc12-test10-run3 | 1 | 조건을 모아 판정하도록 바꾼 검사로 **fix1 제품**(c5fd2697의 app.ts로 되돌려 빌드) 재실행. 세 왕복 모두 관측 |
| fix2final-*(npm check, check, build, pc12 15, spatial102 11, flow090 18) | 모두 0 | 최종 |

**fix1 제품 run3에서 실패한 조건** (`raw/fix1product-run3-observations.jsonl`, `pass:false`)
- 1280 (0): 버튼 y 572.17 → 639.77
- 1280 (1): 639.77 → 572.17
- 1440 (0): 812.17 → 879.77, 버튼이 viewport 밖으로 나가 클릭 불가
- 1440 (1): 790.77 → 723.17 (−67.59)
- 그 밖의 조건(초점, 펼침)은 통과했다. (2)는 위쪽 변화가 없어 통과했다.

**fix2 최종** (`raw/fix2final-observations.jsonl`): 26개 조건 모두 pass.
- 1280: (0)과 (1)에서 버튼 y는 572.17→571.77, 639.77→640.17로 정수 스크롤에 따른 0.5px 미만 차이만 있다. windowY는 600→668, 600→532로 보정되었다. 버튼은 클릭 가능하고 초점이 그 버튼에 있다.
- 1440: (0) 812.17→811.77(windowY 360→428), (1) 790.77→791.17(449→381).
- (2)는 두 폭 모두 내용 높이가 같아 windowY가 그대로다(550, 381).
- 기존 지도 패널 13개 장면은 fix2에서도 통과했다(pc12 15 = 기존 13 + test_10 두 폭).

HTTP와 디스크: fix2 `client/app.js`는 `f3e8b545…5b17`이고 HTTP 200 응답과 디스크가 일치한다. `styles.css`와 `index.html`은 fix1과 같다(`raw/fix2-http-disk-hashes.txt`).

검사기 판본은 다음 세 개다.
- `raw/pc12_browser.fix2-checks-run1.py`: notice 경로 없음.
- `raw/pc12_browser.fix2-checks-run2.py`: notice 경로 추가, 조건마다 즉시 실패.
- 최종 `files/` 판: 조건을 모아 판정.

## 정정
- v0·fix1 보고에서 초점 복귀를 출발 시 `activeElement` 문자열과의 동등으로 표현한 부분은 **“호출 버튼으로 초점이 돌아간다”**로 정정한다. 실제로 확인한 것은 복귀 후 `document.activeElement`가 호출 버튼 요소라는 사실이다. 출발 시 activeElement 기록은 비어 있거나 `main`인 경우가 있었다.
- Cloud가 보고한 새 전문 열람 검사 실패는 기존 검사기가 새 details를 열지 않아 생긴 실패로 총괄이 분류했다. 이번 제품 변경과 섞지 않았다.

## 한계
- 실제 이유가 있는 변화(이번은 notice) 앞에서도 읽던 자리를 맞추는 보정이다. 호출 컨트롤 자체가 없어졌거나 ID가 없으면 기존 windowY를 쓴다.
- 문서가 짧아져 목표 위치까지 스크롤할 수 없으면 브라우저가 clamp한다. 이번 자료에서는 일어나지 않았다.
- Cloud의 영역 화면 수치(1280 y900, 1440 y450)와 같은 자료를 쓰지 않았다. 같은 원인값 67.59375는 일치하지만, 그 정확한 장면의 재실행은 독립 검사에 맡긴다.
- 390 최소 장면은 pc12(test_07)에 들어 있어 이번에도 통과했다. Windows, CI, 그 밖의 browser 회귀는 다시 돌리지 않았다. 바뀐 함수는 pc12, spatial102, flow090이 덮는다.
- 마우스 사용 뒤에는 초점 테두리가 화면에 보이지 않을 수 있다(PNG에도 없음).

## 대표 PNG (2장)
`pc12-1280-12-area-back-R.png`, `pc12-1440-12-area-back-R.png`: notice가 사라진 편집 복귀 직후 영역 화면. 2000자 구상 전체보기가 열려 있고, A 호출 링크가 출발 때의 viewport 위치에 있다.
