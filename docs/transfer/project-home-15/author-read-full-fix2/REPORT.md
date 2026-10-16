# 홈15 읽기창 fix2 — 모달 안 어느 초점에서도 배경 목록 키 스크롤 없음

작성자 검사다. 정확한 기준은 `53d1cb2f1906e6d575f08f4533ac1644a2904894`이다. 원래 v1(`author-read-full-v1`)은 그대로 두고, 이 diff는 53d1cb2 대비 fix2만 담는다(`git apply --check` 통과).

## 결함과 원인
독립 실행에서 닫기 버튼에 초점을 두고 PageDown/End를 누르면, 창이 열린 채로 배경 Y가 움직였다(1280: 0→272, 1440: 0→92). 원인은 v1의 키 처리가 `event.target===본문`일 때만 스크롤을 다뤘다는 점이다. 닫기 버튼이나 창 자체에 초점이 있으면 기본 키 스크롤이 뒤 문서로 넘어갔다.

## 수정(app.ts 한 곳)
창의 keydown에서 스크롤 키(PageDown·PageUp·End·Home·↑·↓·Space)를 다음처럼 처리한다.
- 초점이 본문이면 기존과 같다. 본문을 스크롤하고, 끝 또는 맨 위에 닿았을 때만 기본 동작을 막는다.
- 초점이 본문 밖(닫기 버튼, 창 자체 등)이면 기본 스크롤을 막는다.
- 단 버튼 위 Space는 막지 않아 닫기가 그대로 동작한다. Enter는 스크롤 키가 아니라 영향이 없다.

`body` 전역 overflow는 바꾸지 않았다. 열기·닫기 때 스크롤 보존과 폭 변화 문제를 피하는 더 단순한 방법이다. UI·3열·전체 읽기 기능은 그대로이며, 화면이 바뀌지 않아 새 PNG는 없다.

## 검사(실제 종료값, app/에서)
| 명령 | 종료 |
|---|---|
| `node continuity/scripts/check.mjs` | 0 |
| `node continuity/scripts/build.mjs` | 0 |
| `python3 continuity/tests/home15_browser.py` — 21개(기존 19 + test_10 × 1280·1440) | 0 |
| 같은 test_10 두 개를 수정 전 53d1cb2 app.ts로 실행 | 1(결함 재현) |

수정 전 실행값은 다음과 같다. 독립 증거의 272·92와 같다.
- 1280: `[247,272,272,34,0,0]`
- 1440: `[82,92,92,11,0,0]`

test_10이 확인하는 것:
- 닫기에 초점을 두고 PageDown·End·↓·PageUp·Home·↑를 누를 때, 그리고 창 제목을 클릭해 초점이 창 자체에 있을 때 PageDown·End·Home을 누를 때 배경 scrollY 전후를 기록했다.
- 시작 위치는 목록 맨 위와 끝 두 가지다(검사가 위치를 직접 옮김).
- 1280은 0/0, 272/272, 1440은 0/0, 92/92로 모두 움직이지 않았고 창은 열린 상태였다.
- 회귀 확인: 본문 초점에서 End를 누르면 목적 끝 문장이 실제로 보이고(Range hit), 배경은 그대로다. 닫기에서 Space를 누르면 창이 닫히고 같은 카드 `⋯`에 초점이 가며, 목록은 창을 연 때의 위치로 돌아간다.
- 기존 test_08(본문 PageDown/End/Home, Tab 순환, Enter·Space 닫기 등)도 함께 통과했다.

이전 전체 검사는 반복하지 않았다(범위: check/build와 HOME15). 실제 Windows와 스크린리더는 미확인이다.

## raw
- `raw/fix2-check.log`, `raw/fix2-build.log`, `raw/fix2-home15.log`: 종료값을 끝에 표기했다.
- `raw/fix2-before-on-53d1cb2.log`: 수정 전 재현 실행이다.
- `raw/home15-observations.jsonl`: 최종 실행의 조건별 기록이다.

## 재현
```sh
git checkout 53d1cb2f1906e6d575f08f4533ac1644a2904894 && git apply docs/transfer/project-home-15/author-read-full-fix2/home15-read-full-fix2.diff
cd app && npm ci --ignore-scripts --no-audit --no-fund && npm run build && node continuity/scripts/build.mjs
python continuity/tests/home15_browser.py
```
환경: Linux, Node 22.22.0, Playwright Chromium headless.
