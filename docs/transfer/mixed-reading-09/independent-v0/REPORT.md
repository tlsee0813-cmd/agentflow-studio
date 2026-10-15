# cycle09 fix1 — 독립 DOM·실제 브라우저 관측

고정 원본/계약은 SOURCE.json. **54524B / SHA256 90141c4c5cfc509cafef3c038a9c1c14f0062f7e009e4359f5f97bd5541e3173**. 기존 독립 Cloud의 Playwright **1.57.0**, 실제 system Chromium **154.0.8037.57**(동적 기록). GitHub 고정 원본을 그대로 loopback HTTP로 제공: 세 최초 응답 200·body bytes/SHA 일치, 파일 전후 SHA 일치. 정확 UTC/실제URL/viewport는 run02/result.json. 설치·환경/TLS·인증 변경 없음.

**최신 한 실행 run02: 1280×720·390×844의 A/B/C 6/6 + 1440×900 초기 별도 완료. 반복 검사 91 PASS / 0 FAIL.** actual child **0**, 종료한 외부 collector를 launcher subprocess로 실측 **0**. launcher도 외부 실행 도구에서 종료0 관측(launcher-observation.json). 자기종료 예정값을 외부 실제 종료로 세지 않는다. fatal/pageerror/cleanup 없음. favicon.ico 404 console resource 오류 1개는 pageerror와 구분했다. 과거/작성자 수치와 합산하지 않는다.

## 범위별 관측

- **A:** 새 페이지 depth0/1/0. 다섯 묶음 이름/짧은 역할, G3 두 자식 이름/역할과 C32 변경 단서의 비공백 글자별 Range·모든 조상 clip·hit를 측정했다. 양성 표본(first/middle/last), 모든 음성 표본과 raw box/clip를 회수 가능하게 저장했다. 최초 무선택→C32 선택 전후 카드/선/깊이 원시 쌍과 실제 screen 시작·끝/대표 카드 대응을 남겼다. 변화 소유를 묶음 전체/새 미결로 올리지 않았다. 1440은 이 초기 범위만 실행했다.
- **B:** G3 접힘의 C32 한 곳 집계→실제 R2/R3 bundle 선의 화면 hit를 mouse click→R3만 선택→실제 C32 끝 선택. G3만 펼쳐지고 G2/G4 유지. 관계 ID 원래 배열을 중복 제거 전에 기록했고 R1–R6의 DOM title 실제 양끝·전달 종류/현재 대표 끝/포함 ID를 독립 기대값과 대조했다. G3 참고 머리말은 ‘지도 선택은 전달할 내용 그대로 · 참고는 준비문을 바꾸지 않음’이며 준비 대상을 발명하지 않았다. G3 집중에는 준비 버튼이 없고 세부 선택만 있다. C32 R3 참고는 실제 C21→C32/명시 새 요청 때 그 요청의 사본 조건. 실제 wheel로 머리말·보내는 쪽·받는 쪽·조건 문구에 순차 접근해 글자 Range/clip/hit를 남겼다. 한 화면 동시 전체 노출 주장 아님. 버튼닫기/Escape 직후 xpeek DOM 부재(본문·링크·버튼 함께 제거), aria-expanded false, source R3 focus, typed C32·깊이 유지. 이름 있는 명시 이동 버튼만 C21 선택/G2 펼침으로 이어졌다.
- **C:** 사용자 조정 depth0/1/1 + 실제 matrix1.15. 실제 지도 wheel 델타는 1280 x74→136(+62), y0→0(maxY0); 390 x29→31(+2), y42→132(+90). 이동 여유 없는 1280 main/지도 세로 축은 0이며 이동 성공으로 세지 않았다. 390 main은 실제 접근 wheel을 통해 진입 전275(max293), 지도31/132(max31/148). 진입 전 raw와 복귀 직후(보조 이동 전) typed 선택·깊이·matrix·main/map/panel scroll·전체 카드와 선을 둘 다 저장했다. 카드 raw delta0, 호출 ‘자세히…’ 버튼 focus 복귀. **선 d 최대 변화는1280 0.14999999999997726 / 390 0.16200000000000614 world 단위, 허용0.5**. exact 동일이라고 하지 않는다. 관계별 수치 차이와 screen rect 차이는 JSON/derived-summary에 남겼다.

C32 집중의 F1 근거 참고를 실제 열고 본문에 접근한 뒤 버튼닫기; 편집·재진입 후에는 다시 열고 Escape. 근거 본문 글자 근거, 제거된 panel/link/close, 원래 집중 scroll/anchor/focus를 기록했다. 집중 대상은 렌더된 제목으로 구분했고, 모바일 fpath 문구 전체의 별도 글자 판정으로 확대하지 않는다. 준비는 대상별4필드이며 target에 **‘이번 확인은 배경 블록의 유무와 요청 당시 사본 유지까지만 다룬다.’**를 실제 키 입력으로 추가했다. 다른3필드는 그대로. 지도복귀·재진입·집중 근거 참고 후 E 유지. 지도에서 생성된 **새 panel R3 xref**를 버튼닫기/Escape 각각 실행: 닫기 직후 DOM focus/depth/typedsel을 기록하고, 이어 실제 집중·준비 재열기로 E 보존을 확인했다(숨은 준비 상태를 읽어 즉시 E가 있다고 주장하지 않음). 1280에서 C21 준비 기본값에 E가 섞이지 않고 다시 C32 E가 살아 있음도 확인했다.

## 경계·보존

DOM truth만 사용: typed sel은 aria/패널 제목/관계 행으로, 유효 focusId는 렌더된 집중 제목·준비 제목으로 추론해 `*DOM`으로 기록했다. 숨은 내부 focusId/state/API는 읽지 않았고 숨긴 집중 화면의 마지막 제목도 raw에 별도 남겼다. 실제 CSS/자식 숨김과 깊이 attrs를 함께 기록했다. DOM scrollIntoView/scroll 주입/force click/복귀 보정/앱 함수 호출 없음. 모든 overflow 조상·축·변환 비율·자체 content clip·실제 glyph Range와 대표/글자 hit를 분리했다. 글자 layout 노출이 잉크 품질·사람 이해 성공을 뜻하지 않는다.

첫 run01도 완주·exit0이었으나 일부390 xref의 펼침 순간 머리말이 아래 경계 밖이고 끝/조건의 글자 근거가 부족했다. 원본 코드·결과·로그 보존 후 같은 흐름에 실제 wheel 접근과 글자 관측을 추가한 run02만 최신 기준으로 삼았다. 앱/HTML 수정·실패 판정 완화는 없었다. 첫 FAIL/fatal은 없으며 instrumentation 보완을 제품 수정으로 세지 않는다. 코드 snapshot은 해시별1벌, PNG는 최신4장만 저장했다.

**중요 기능 결함은 이번 범위에서 발견하지 않았다. 남은 UI 한계:** G3의 R2/R3 항목이 열기 전 같은 ‘받음←새 요청의 배경 고정’ 모양이라 받는 세부 구분이 약하다(원시 labels 기록). 390 inline 참고는 길어 실제 scroll 접근이 필요하며 기본 지도/참고를 동시에 모두 보장하지 않는다. 일부 접힘의 회색 자식 요약 전체는 초기 필수 이름/짧은 역할 검사 대상과 구분한다. 터치·사람 이해/사용성·큰 지도·실제 AI 송신/수락·외부 원문 왕복은 NOT_RUN. MOCK 개발 계약 보고를 사용자 발화/실제 AI 준수 성공으로 바꾸지 않았다.

PNG4: initial-1280, initial-390, R3-reference-390, edited-preparation-1280. source HTML은 중복 없음. 재현: 고정 HTML을 site/mixed-reading-study.html에 추출 후 기존 venv Python으로 `launch.py 새run이름 snapshots/check-<hash>.py`. child-exit.json이 실제 실행 코드 SHA를 고정한다. FAIL·미완주·fatal·pageerror·cleanup·source hash 불일치는 nonzero. collector/launcher 두 실제 subprocess 종료와 JSON을 대조한다. 이전 증거/README/제품·연구/main/gh-pages·공유 index 불변, 새 독립 경로만 추가했다.
