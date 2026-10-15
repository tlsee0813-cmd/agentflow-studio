# cycle10 — 독립 관계 읽기 관측

고정 원본/계약은 SOURCE.json. **55724B / SHA256 96e791d25bcb8fadc41ba1e30351bddd4b0feb3d6ebe1e7ef70941bbd359ceae**. 변경 없는 HTML을 실제 loopback HTTP→Chromium으로 제공했다. 1280×720·390×844·1440×900 각각 최초 HTTP200, body bytes/SHA 및 파일 전후 SHA 일치. 실제 URL·UTC·raw는 run03/result.json. 동적 Playwright1.57.0 / system Chromium browser.version154.0.8037.57. 설치·TLS·인증/정책 변경 없음.

**최신 한 실행 run03: 두 폭 A/B/C 6/6 + 1440 초기 별도 완료. 152 PASS/0 FAIL(정적 감사 묶음1 + 브라우저 반복 검사151).** 검사 수는 장면 수/사람 성공이 아니며 작성자/이전 실행과 합산하지 않았다. 실제 child0·외부 collector0; JSON complete true, fatal/pageerror/cleanup 없음. 각 context는 goto 전 console/pageerror 감시를 등록했고 1440도 실제 HTTP/body 관측했다. 콘솔은 전체 실행 합산으로 favicon.ico404 resource 오류1개가 있으며 폭별0건으로 분할 주장하지 않는다.

## 직접 조작

- 초기5역할/C32 변경/0·1·0, 글자별 Range·모든 overflow 조상/clip·hit 양성 표본과 음성 raw, 최초 무선택→C32 raw 카드/선/대표 screen끝점/깊이를 기록했다. 1440은 이 초기만.
- **G3 열기 전:** ‘AI 입력’/‘작업문과 미리보기’ 실제 머리말의 글자와 화면 위치, 각 받음 버튼의 aria-describedby→머리말 참조를 함께 대조했다. 해당 화면 이름/받음 문구로 후보를 찾고 읽은 DOM의 버튼 종류별 순번으로 클릭했다. R ID는 클릭 결과가 맞는지 검사하는 기대값이며 선택 근거로 대체하지 않았다. 버튼 문구의 accessible name 자체가 다르다고 하지 않고 DOM 설명 참조·화면 구별만 확인했다. 스크린리더 사용성은 미검증.
- G3 R2→R3 바꿔 읽기, 같은 버튼닫기/재열기/상단닫기/Escape. R2는 C21→C31, R3는 C21→C32. 양끝·방향·소속·접힌 대표·선택 표시·조건 전문·종류·근거 줄과 정확href를 명시 기대값과 대조했다. 상단닫기는 실제 wheel 접근 후 glyph/clip/hit 및 당시 읽기 scroll을 남겼다. 다른 본문으로 전환하면 이전 DOM이 제거돼 하나만 남는다. 닫기 직후 본문 DOM/링크/버튼 부재, aria false·호출 focus·선택/깊이 유지. G3 집중에는 준비 버튼이 없다. 명시 이름의 이동만 C21 선택/G2 펼침으로 이어졌다.
- C21의 flat 보냄 목록에서도 실제 ‘AI 입력’/‘작업문과 미리보기’ 문구로 각각 골라 올바른 수신부·조건·‘지금 선택’ 위치를 확인했다. 중복 그룹 머리는 없다. 추가로 G2/G3/G4에서 나머지 R1/R4/R5/R6을 실제 열어 여섯 종류·실제 끝·각 조건과 href를 대조했다. 원래 ID 배열은 중복 제거 전에 저장, 실제/대표/포함 ID도 남겼다. **09와 달리 kind는 DOM title과 열린 참고에서 명시 기대 문자열로 자동 대조했다.**
- C32 네 필드 중 target에 **‘이번 확인은 배경 블록의 유무와 요청 당시 사본 유지까지만 다룬다.’**를 실제 입력; 다른3필드는 그대로. 비초기 depth0·1·1/computed1.15, native wheel 전후와 extent를 기록했다. 1280 지도 x74→136, 세로는 max0. 390 지도 x29→31/y42→132, main 진입 전275(max293). 이동 없는 축은 움직였다고 세지 않았다. 집중 근거 본문 실제 접근과 닫기/재진입 근거 Escape의 제거·읽기 scroll/anchor/focus 복원도 기록.
- 전체복귀 즉시 보조 이동 전 pre/post 카드·선·main/map/panel scroll·DOM typedsel/집중 제목/activeElement를 비교했다. 카드 delta0. 선 world 최대delta는1280 **0.14999999999997726**,390 **0.16200000000000614**, 허용 **0.5**와 구분(문자열 exact 아님). 새 panel R3 참고의 버튼닫기/Escape 각각 직후 snapshot을 남기고 실제 준비 재열기로 E를 읽었다. 1280 C21 준비에 E가 섞이지 않고 C32 재방문 E 유지.

## 정적 근거와 실행 경계

`static-audit.json`/`source09-to10.diff`: 고정09 대비 FACTS/N/RELS·buildMap·배치/배율·drawEdges·집중/복귀·기본 준비 함수 원문/해시 일치. 새 관계/포트/선 기하 변경 없음의 **정적** 근거이며 원 프로젝트 실행 결과가 아니다.
`fact-href-audit.json`: 모든 F1–F11의 정확 l/a와 SRC+anchor href를 **리터럴 기대값**으로 대조(단순 #L숫자 패턴 아님). F6은 L14·L55 설명/anchor#L14, 범위 F10/F11도 개별 대조. 실제 브라우저에서는 R1–R6에 연결된 F2/F7/F8/F6/F5/F4와 F1 peek의 표시 줄/href를 따로 확인했다. 다른 F 전체를 브라우저로 읽었다거나 외부 원문 왕복했다고 하지 않는다.

숨은 app state/API·DOM scrollIntoView/scroll 주입·force click·복귀 보정 없음. typedsel/focusId는 UI/DOM의 aria·패널/집중/준비 제목에서 추론한 `*DOM`, 내부 객체값이 아니다. 문자 Range·clip·hit는 DOM 객관 관측이며 글자 잉크 품질·사람 이해 증명 아님. 긴 참고는 필요한 문구에 **순차** wheel 접근했으며 지도와 참고 전부 동시 노출을 요구/보장하지 않았다.

## 첫 오류·남은 한계

run01: Playwright 전용 :has-text를 document.querySelector로 넘긴 검사기 오류. run02: 참고 삽입 뒤 nth-child 순번이 바뀐 검사기 오류. 둘 다 당시 코드·raw·combined stdout/stderr·실제 child/collector1 보존. 실제 이름/설명으로 고른 버튼을 표준 CSS nth-of-type으로 추적하도록 검사기만 수정한 run03이 최신이다. HTML/제품을 수정하지 않았다. 새로운 실패 probe는 추가하지 않았다. snapshot은 해시별1벌이며 기존09 snapshots를 복제 업로드하지 않았다.

**중요 기능 결함 미발견.** 같은 버튼 이름은 수신부 머리말/DOM 설명 참조에 의존한다. 상단닫기가 sticky라는 보장은 없으며 읽기 후 실제 wheel로 돌아올 수 있음을 확인한 범위다. 390 접힌 그룹의 회색 긴 자식 요약은 필수 이름/짧은 역할과 별개로 일부 잘린다. 터치·사람 이해/사용성·큰 지도·실제 AI 송신/수락·외부 원문 왕복은 NOT_RUN. MOCK 계약을 실제 사용자/AI 성공으로 바꾸지 않았다.

종료: child-exit은 child 종료 후 collector가 실측, actual-exit은 collector 종료 후 launcher가 실측. launcher-tool-summary는 도구 exit_code의 **전사 요약일 뿐 전체 tool 원문이 아니다.** 자기종료 예정값을 외부 실측으로 세지 않았다. PNG최종4장, source사본 중복 없음. 재현은 고정 HTML을 site/relation-reading-study.html에 놓고 기존 venv Python으로 launch.py 새run이름 snapshots/check-<hash>.py. 정적 감사 파일을 먼저 static_audit.py로 생성한다. FAIL/미완주/fatal/pageerror/cleanup/hash 불일치는 nonzero. 새 허용 경로만 추가하고 README/index/연구/기존 증거/제품/main/gh-pages는 변경하지 않았다.
