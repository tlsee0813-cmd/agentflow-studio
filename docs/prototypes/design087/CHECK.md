# DESIGN087 실행 체크 기록

- 대상: 이 폴더의 `index.html` (file:// 로 직접 열기)
- 도구: Playwright + Chromium (`/opt/pw-browsers/chromium`)
- 명령: `python docs/prototypes/design087/check.py [스크린샷 폴더]`
- 범위: 핵심 경로가 클릭으로 동작하는지, console 오류·경고, 가로 스크롤, 내부 ID 노출.
- 이 체크는 인간 사용성 검증이 아니고, 실제 AI 연결 검증도 아니다.

## 결과: 48개 PASS, console error/warning 0, pageerror 0
폭 1280px과 375px에서, A·B·C 각 시안마다:
- **예약:** 옛 결정 기준 API 지시 표시 → 확인 전 초안 버튼 비활성 → 변경 확인 → 그 API 작업 하나의 초안이 나옴(‘전송하지 않음’, 화면 담당 내용 없음).
- **선택 유지:** 다른 시안으로 바꿔도 예약 선택과 작업·세션 탭이 유지되고, 브라우저 뒤로가기로 원래 시안에 돌아옴.
- **취소:** ‘버튼 문구만’이 현재 요청으로 남고, 늦은 보고는 ‘이전 요청에 대한 보고 · 최신 요청보다 늦게 도착’, ‘직접 확인 안 함’으로 표시됨. 비교 표가 열림.
- **키보드:** 탭에서 ←/→/Home으로 포커스가 이동하고, Esc로 전체에 돌아옴.
- **목록 대체 보기:** 같은 상세가 열림.
- **가로 스크롤:** 문서 가로 스크롤 없음.
- **내부 ID:** 내부 ID가 보이지 않음.

P1 추가 검사 (1280×720, 1265×712 viewport):
- **A 첫 화면:** 4개 영역 노드가 모두 viewport 안에 있고 서로 겹치지 않음.
- **A 상세:** 예약 선택 후 페이지를 아래로 스크롤해도 지도의 예약 노드가 화면 안에 남음.
- **C 개요:** 4개 연결이 라벨과 함께 나열됨. 로그인 경로는 ‘이제 선택’으로 표시됨. 연결 목록 앞에 라벨 없는 화살표가 없음.
- **B 카드:** 예약 카드에 ‘연결: ← 회원 (선택) · → 취소 · → 알림’이 나옴.
- **상세:** A·B·C 모두 예약 상세 ‘구상·요구’ 탭에 같은 연결 목록이 나오고, 연결된 영역 링크로 이동함.

## 마지막 실행 로그
```
PASS 1280 A booking: stale API instruction -> change confirmed -> draft for that task only
PASS 1280 A selection kept when switching to B; Back returns to A
PASS 1280 A cancel: latest request kept, late report compared as related result
PASS 1280 A keyboard: arrows/Home move tabs, Escape returns to overview
PASS 1280 A list alternative opens the same detail
PASS 1280 A no horizontal page scroll
PASS 1280 B booking: stale API instruction -> change confirmed -> draft for that task only
PASS 1280 B selection kept when switching to C; Back returns to B
PASS 1280 B cancel: latest request kept, late report compared as related result
PASS 1280 B keyboard: arrows/Home move tabs, Escape returns to overview
PASS 1280 B list alternative opens the same detail
PASS 1280 B no horizontal page scroll
PASS 1280 C booking: stale API instruction -> change confirmed -> draft for that task only
PASS 1280 C selection kept when switching to A; Back returns to C
PASS 1280 C cancel: latest request kept, late report compared as related result
PASS 1280 C keyboard: arrows/Home move tabs, Escape returns to overview
PASS 1280 C list alternative opens the same detail
PASS 1280 C no horizontal page scroll
PASS 1280 no internal ids in visible text
PASS 375 A booking: stale API instruction -> change confirmed -> draft for that task only
PASS 375 A selection kept when switching to B; Back returns to A
PASS 375 A cancel: latest request kept, late report compared as related result
PASS 375 A keyboard: arrows/Home move tabs, Escape returns to overview
PASS 375 A list alternative opens the same detail
PASS 375 A no horizontal page scroll
PASS 375 B booking: stale API instruction -> change confirmed -> draft for that task only
PASS 375 B selection kept when switching to C; Back returns to B
PASS 375 B cancel: latest request kept, late report compared as related result
PASS 375 B keyboard: arrows/Home move tabs, Escape returns to overview
PASS 375 B list alternative opens the same detail
PASS 375 B no horizontal page scroll
PASS 375 C booking: stale API instruction -> change confirmed -> draft for that task only
PASS 375 C selection kept when switching to A; Back returns to C
PASS 375 C cancel: latest request kept, late report compared as related result
PASS 375 C keyboard: arrows/Home move tabs, Escape returns to overview
PASS 375 C list alternative opens the same detail
PASS 375 C no horizontal page scroll
PASS 375 no internal ids in visible text
PASS 1280x720 A first screen shows all four areas, not overlapping
PASS 1280x720 A map stays in view while the detail scrolls
PASS 1280x720 C overview lists the four links with labels; login path marked optional
PASS 1280x720 B cards show each area's links
PASS 1280x720 detail lists the same links in A/B/C and opens the linked area
PASS 1265x712 A first screen shows all four areas, not overlapping
PASS 1265x712 A map stays in view while the detail scrolls
PASS 1265x712 C overview lists the four links with labels; login path marked optional
PASS 1265x712 B cards show each area's links
PASS 1265x712 detail lists the same links in A/B/C and opens the linked area
ERRORS []
```

## 눈으로 확인한 것 / 하지 않은 것
- 스크린샷으로 확인함(저장소에는 넣지 않음):
  - P1: A 첫 화면 1280×720·1265×712, A 선택 후 스크롤, B·C 개요 1280×720. 연결 라벨이 노드에 가리는 문제를 찾아 행 간격을 넓히고 축소 시 담당 줄을 숨기도록 고쳤다.
  - A 넓은 화면의 선택 상태.
  - B에서 항목에 초점을 둔 상태.
  - C 375px 다크 모드.
- 1차 스크린샷에서 A 노드 겹침과 B 결과 연결선 가림을 발견해 좌표와 열 순서를 고쳤다.
- 하지 않음: 스크린리더 실기, 터치 기기, Firefox/Safari, 인간 사용성 관찰.
