# 홈15 후속 — 진입 전 이름·목적 전체 읽기 (작성자 read-full-v1)

**작성자 검사이며 독립 검사가 아니다.** 정확한 제품 기준 `1e51f0f9b56ed51e9ec4c529ca518aa256ad1ecf`(작업 전 이 기준이 홈15 v0와 바이트 단위로 같음을 확인). 고정 diff `home15-read-full-v1.diff`가 이 기준에 `git apply --check` 통과. 파일목록 `CHANGED_FILES.txt`, 해시 `MANIFEST.sha256`.

이번 개선은 **진입 전 전체 확인 경로**다. 카드 자체만으로 같은 접두사 프로젝트를 구별할 수 있게 됐다고 주장하지 않는다. 카드의 3열·높이·2줄 생략은 그대로다.

## 구현
- 기존 카드 `⋯` 메뉴 첫 항목으로 `이름·목적 전체 보기`를 추가했다. 카드에 새 버튼은 없다.
- 현재 소스에 전용 대화상자 패턴이 없어, 브라우저 기본 `<dialog>.showModal()` 하나로 구현했다. 새 프레임워크·schema·저장은 없다.
- 순서는 메뉴 닫기 → 창 열기다. 메뉴 항목이 초점을 메뉴 버튼으로 돌리는 처리는 창이 열려 있으면 건너뛴다. 전역 메뉴용 Escape 처리도 창이 열려 있으면 관여하지 않는다(총괄 보조 지적 1·2 반영).
- 열 때 `workspace.read()`로 그 entryId의 활성 프로젝트를 새로 읽는다. 다른 탭에서 휴지통으로 옮겼거나 없어졌으면 창을 열지 않는다. 기존 카드 열기와 같은 ‘다른 탭에서 바뀌어’ 알림을 내고 목록을 다시 그리며, 초점은 목록 제목으로 간다.
- 창은 읽기 전용 스냅샷이다. 저장 경로가 없어 외부 변경을 되돌리거나 다른 카드에 붙이지 않는다.
- 내용은 `textContent`로만 넣는다. HTML로 해석하지 않고, 선택·복사가 가능하며, 줄바꿈·공백은 `pre-wrap`으로 유지한다. 공백 없는 긴 문자열은 `overflow-wrap:anywhere`로 줄을 바꾼다.
- 목적이 없으면 `목적을 아직 적지 않았어요`를 표시하고, 요청으로 채우지 않는다.
- 초점은 본문 맨 위(이름부터)에서 시작한다(WAI dialog 패턴의 큰 내용 경우).
  - PageDown/End/Home/화살표/Space로 바로 내부 스크롤된다.
  - 끝(또는 맨 위)에서 같은 키를 눌러도 뒤 목록은 움직이지 않는다. 휠은 `overscroll-behavior:contain`, 머리글·여백·배경 휠은 막는다.
- Tab/Shift+Tab은 본문과 닫기 사이만 순환한다.
- `aria-describedby`는 짧은 ‘읽기만 해요’ 안내만 가리키고, 긴 본문을 한꺼번에 읽히게 하지 않는다.
- 닫는 방법은 닫기 버튼, Escape(기본 cancel), 배경 클릭이다.
  - 닫으면 열 때의 목록 스크롤로 돌아간다.
  - 그 entryId 카드가 현재 DOM에 있으면 그 카드의 `⋯`로 초점을 보내고, 없으면 목록 제목으로 보낸다(지적 3).
  - 숨겨진 메뉴 항목으로는 초점을 보내지 않는다.
- 내용은 닫을 때 비우고, 열 때는 `showModal` 뒤에 내부 스크롤을 0으로 맞춘다. 닫힌 dialog는 배치되지 않아 이전 스크롤이 남는 것을 실제로 발견해 고쳤다.

## 검사(실제 종료값, app/에서)
| 명령 | 종료 |
|---|---|
| `node continuity/scripts/check.mjs` | 0 |
| `node continuity/scripts/build.mjs` | 0 |
| `python3 continuity/tests/home15_browser.py` — 19개 = 1280·1440 각 9 + 390 1 | 0 |
| 카드 진입·휴지통 회귀 `flow083_browser.py` 12 | 0 |
| 카드 진입·휴지통 회귀 `spatial102_browser.py` 11 | 0 |
| 목록→공간 진입 `pc13_browser.py` 14 | 0 |

새 HOME15 검사는 test_08·09, 390에서 창 최소 확인을 다룬다.

**test_08 — 같은 긴 접두사 A(…· 강남 지점) / B(…· 마포 지점)**
- 카드 이름이 실제로 잘림을 확인했다(scrollHeight>clientHeight).
- 목록을 스크롤한 뒤 마우스로 `⋯` → `이름·목적 전체 보기`를 열었다. 창이 열리고, 메뉴는 닫히고, 화면은 목록 그대로다.
- 전체 이름·목적이 저장값과 같다.
- 접미사 `· 강남 지점`은 DOM이나 title 존재가 아니라 Range 사각형이 본문의 보이는 영역 안에 있고 hit-test가 맞는 것으로 확인했다.
- 키보드: PageDown으로 스크롤, End로 목적 끝 문장이 실제로 보임, Home으로 이름 복귀. 휠로도 끝 확인.
- 배경 목록 스크롤은 변하지 않았다. 세 번 클릭으로 선택한 이름이 선택 문자열에 들어갔다.
- Tab/Shift+Tab 6회 모두 창 안에 머물렀다.
- Escape로 닫으면 같은 스크롤, A의 `⋯`에 초점, 저장 envelope 불변.
- B는 키보드만으로 열었다(Enter→Tab→Space). 본문 스크롤 0, A 내용 없음. Tab→Enter로 닫으면 B의 `⋯`에 초점.
- HTML처럼 보이는 이름·목적은 문자 그대로 표시됐다. img·b·script 요소는 생기지 않았고 스크립트도 실행되지 않았다. 공백 없는 긴 문자열에서도 가로 넘침이 없었다.
- 목적 없는 카드는 ‘목적을 아직 적지 않았어요’를 표시하고 요청 문구는 없다. 배경 클릭으로 닫힌다.
- 같은 카드 본문 클릭으로 공간에 진입한다.

**test_09 — 다른 탭과의 동시 변화**
- A 창을 열어 둔 채 다른 탭에서 A를 휴지통으로 옮겼다. 창을 닫아도 아무것도 저장되지 않았다.
- 오래된 A 카드에서 다시 열면 창을 열지 않고 알림을 띄우며 초점은 제목으로 간다. 이때도 저장은 없다.
- 저장소에서 B의 목적을 바꾼 뒤 열면 새 값을 보여준다. 닫아도 이 탭이 다시 쓰지 않는다.

조건별 기록은 `raw/home15-observations.jsonl`에 있다. 이전 전체 시험(pc12, flow090, node 단위 등)은 변경 영향이 없어 다시 돌리지 않았다.

**작업 중 고친 실제 문제 2개**
- 1280에서 본문 끝 이후 휠·키 입력이 뒤 목록을 120→272로 스크롤했다.
- 이전 창의 내부 스크롤(38)이 다음 카드에 남았다.

**한계**
- 화면 판단은 작성자 확인과 수치뿐이다.
- 실제 Windows·125% 확대·스크린리더 낭독은 미확인이다.
- 열린 창은 스냅샷이라, 열어 둔 동안 다른 탭에서 바뀐 내용은 다시 열어야 보인다(새 동기화 체계는 만들지 않음).

## 대표 화면
`home15-1280-read-open.png`, `home15-1440-read-open.png`: 같은 접두사 카드 A를 연 직후 모습으로, 이름 끝 `· 강남 지점`이 보인다. 뒤 카드들은 2줄로 잘린 상태다.

## 재현
```sh
git checkout 1e51f0f9b56ed51e9ec4c529ca518aa256ad1ecf && git apply docs/transfer/project-home-15/author-read-full-v1/home15-read-full-v1.diff
cd app && npm ci --ignore-scripts --no-audit --no-fund && npm run build && node continuity/scripts/build.mjs
python continuity/tests/home15_browser.py   # fixture(home15-read.json 포함) 생성 후 실행, 화면은 continuity/test-results/
```
환경: Linux, Node 22.22.0, Playwright Chromium headless.
