# cycle07 fix1 独립 실제 브라우저 검사

고정 HTML/bytes/SHA/계약은 SOURCE.json. GitHub 고정 커밋을 기존 인증 git으로 추출해 수정 없이 loopback HTTP로 제공했다. 각 폭 최초 HTTP 200 / body 42420B / SHA 일치, 파일 전후 SHA 일치. 실제 URL·UTC·동적 환경·console/pageerror는 각 result.json에 있다. Playwright 1.57.0 / system Chromium browser.version 154.0.8037.57. 설치·환경·TLS 변경 없음.

**최신 단일 run03: 1440×900 및 390×844 × 세 경로 6/6 완주, 60 PASS / 0 FAIL.** child/외부 collector/launcher 실제 exit 0. fatal/pageerror/cleanup 오류 없음. favicon.ico 404 resource console 오류 1개는 pageerror와 구분한다. 과거 부분 성공·작성자 검사와 합산하지 않는다. 수집기 경계는 기존 방식을 재사용했으며 새 합성 실패 probe는 만들지 않았다.

- **경로1:** 원래 DOM ID 배열의 중복 및 원래 edge 배열 R1/R2 중복을 사전 변환 전에 검사. 두 비교 보기의 P1/P2/P3와 P1→P3·P2→P3 유지, 카드 raw rect와 선 d/rect/matrix·문구를 전후 모두 저장했다. 책임은 두 메뉴의 진행 정보 누락 확인·경과 계산에서 기존 공통 계산으로 이동하며, 표시 문구/분기와 추정 본체는 남는다. 실제 wheel로 각 카드에 접근하고 이름·책임행의 clip/hit를 기록했다. 목적·고정 1/16 범위·후속 요청/PR 미병합 안내와 실제 후속 창을 대조했다. 새 기능·새 호출·메뉴 삭제나 최종 제품 상태로 세지 않았다.
- **경로2:** P3에서 실제 reader wheel로 top100(1440 max312 / 390 max399) 후 관련 P2 위치 확인. 390 ‘읽던 곳으로’, 1440 reader 유지 UI 그대로 복귀 직후 행 x/y/w/h·reader top delta 모두 0, 출발 버튼 focus·P3 선택 유지. 코드 근거 및 후속 기록 각각 버튼닫기→재열기→Escape로 panel·링크·닫기버튼 실제 부재, reader/anchor/focus 복원 확인. 외부 링크는 열지 않았다. P3 기본 준비는 현재 함수 입력/두 호출 확인 후 수정 필요·선택지 제안, 다른 파일은 범위 밖 제안이고 영향없음을 보장하지 않는다.
- **경로3:** 변경 전 지도에서 실제 115% matrix(1.15,0,0,1.15,0,0), native 이동과 P1 선택을 기준 A로 저장. 기본 목적/선택 범위/후속 미확인 확인→의미 있는 E 편집→1/16 비교 전환→재열기 E 보존→전체복귀 B 즉시 기록. 변경 전 보기/책임·선 설명으로 복원, 세 카드 rect와 native scroll delta 0. P2는 별도 A2/B2를 저장·대조했고 대상/워크벤치 파일 후속 요청 범위가 맞는 기본문에 E 누출 없음. 다시 P1에 들어가 E 유지 확인. 원시 3카드와 두 선 pre/post를 둘 다 보존했으며 두 기준을 섞지 않았다. wide P1/P2 map left34/top0(maxX94/maxY0), narrow P1 left24/top0(maxX24/maxY535), P2 left0/top535. 이동 여유 없는 wide 세로는 0이다. 좌표 복원은 모든 카드가 동시에 보인다는 주장이 아니다.

**요청칸:** 편집 전 P3·P1·P2의 native clientHeight/scrollHeight/scrollTop와 prepScroll을 각각 기록. 1440 요청칸 106/106으로 내부 overflow 없음(내부 스크롤 경로 미관측). 390 P3 106/111, P1/P2 106/149. Ctrl+End 뒤 실제 입력칸 안 mouse.wheel로 top5/43/43 최대에 도달, caret 끝과 입력칸 clip/hit 확인. outer prepScroll top은 0 유지. 준비 PNG는 직접 편집 전 390 P1 기본문이며 자연 native 스크롤 뒤 마지막 문장이 보인다. 값 전체 존재와 한 화면 전체 가독성을 동일시하지 않았다.

**첫 실패 보존:** 독립 run01은 선 경로의 부동소수점 문자열 동등 조건이 실제 동일한 선 좌표를 실패로 셌고, 390 P2 카드 테두리 bottom668.25 vs clip668의 0.25px 경계에서 ‘전체 박스 아니면 접근 불가’로 중단했다. 실제 border의 부분 노출은 원시값으로 유지하며 잉크 잘림/내용 접근 실패로 단정하지 않는다. 이름·책임행은 clip 안이고 hit가 가능했다. 검사기만 선 수치(.01 단위 이하)·실제 pathRect 비교, 이름/책임행 노출과 클릭 hit 구분으로 수정했다. run02는 6/6 완주했으나 Ctrl+End가 아래 패딩까지 scroll 최대에 닿아야 한다는 3개 검사 실패(390 P3 top0/max5, 메뉴 top35/max43). 이 기록을 보존한 뒤 요청된 실제 wheel 끝접근을 추가한 run03에서 확인했다. 실행 당시 코드/정확 JSON/로그/실제 nonzero를 모두 보존. HTML은 변경하지 않았다. 이번 좁은 관측에서 중요한 기능 결함은 발견하지 않았다.

clip은 viewport와 **모든 overflow 조상**을 축별로 교차하고 실제 transform/offset 비율을 반영한다. 대상 자체 content clip·Range·표본 hit는 별도 raw 데이터다. hit는 대표점 접근 가능이지 문자 전체 잉크 가독성/사람 이해 성공이 아니다. hidden app API/state 호출·변조, DOM scroll 주입, force click, 복귀 직후 보정 없음. 비교 전환이 hidden인 390 reader에서는 정상 관련 위치 보기→지도 비교 버튼→읽던 곳 복귀로 전환했다.

PNG 4장: 초기1440 / 변경 전1440 / 390 P3 후속 / 편집 전390 P1 준비. 기본 화면의 나머지 카드/문장은 자연 지도 scroll로 접근하며 모두 한 화면에 동시에 보인다고 하지 않는다.
**NOT_RUN:** 큰 프로젝트 조망·사람 사용성/이해·원 프로젝트 실제 실행/CI/수용/인계 성공·실제 AI 송신·외부 원문 왕복·터치/핀치. 공개 사람–Copilot 기록의 정적 책임 변화 시안 검사다.

재현: SOURCE.json의 고정 원본을 check.py 옆 site/change-record-study.html에 추출 후 기존 venv Python으로 launch.py <새run이름>. collector는 child subprocess returncode와 JSON을 대조하고 launcher는 collector의 실제 returncode를 기록한다. 실패·미완주·fatal·pageerror·cleanup·해시 불일치는 nonzero. 환경/기존 증거·제품/연구 브랜치 불변, 이번 delivery 허용 경로만 추가한다.
