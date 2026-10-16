# cycle11 fix1 — 독립 PC 검증

**최종 판정: 지정 범위 통과, 중요한 추가 기능 결함 미발견.** 고정 v0 5runtime에 `c4354dc…/app/engine.js`만 새 폴더로 덮어 조립했다. engine34004B/SHA `d3699ac75671b000cb4561ae137073aa73a18c74fefe6fbaa0bd3489c438ff8f`, overlay manifest SHA `f3d9a0deb20a0d7b715300224c1f0bfa6ab8aad04e3fd4bcf0c4e4bad7789644` 확인. 나머지4runtime 및 원v0 불변. 정확 경로/계약은 SOURCE.json, 파일별 expected hash는 runtime-manifest JSON.

## 실제 실행·계획 대조

고정 PLAN의 **20/20**: PC1280×720·1440×900 × 두 사례 본경로4, 사례왕복2, 별도 P2 회귀4, 별도 시험입력8,390 최소smoke2. **FINAL_RESULT.json**이 계획/완료ID를 raw와 매핑하며 missing 없음. 시험 입력을 세 번째 실제 사례나 모바일 전체 통과로 세지 않는다.
- 최신 **fix1-main-run02**: 본검사16장면 완주, 반복검사223 PASS/0 FAIL(정적 literal 묶음 포함), 실제 child0/외부 collector0. **fix1-p2-run01**: 같은 P2 검사코드로4경로 완주,56 PASS/0 FAIL, 실제 child0 및 외부 실행 도구가 관측한 collector0. 서로 다른 실행을 단일 브라우저 실행/과거 부분 성공 합산으로 포장하지 않는다. final_gate는 두 정확-source 결과의 고정 계획과 복사 payload를 **읽기 전용 후처리**로 대조해 exit0.
- 실제 환경: Python venv Playwright1.57.0, `/usr/bin/chromium` browser.version154.0.8037.57(동적). 설치·설정·TLS·인증/권한 변경 없음. 실제 loopback HTTP에서 index/engine/CSS/두fixture 각각 response body bytes/SHA 대조. 각 runtime/test JSON 파일 전후 hash 일치. URL·UTC·viewport·오류는 실행별 result.json에 있다. 최신 main HTTP48개는 본페이지/시험입력 포함이며, 실제 두 사례는 같은 renderer/style hash를 쓴다. pageerror/major console/fatal/cleanup 오류 없음. main의 favicon404 resource1개는 별도 구분했다.

## P2: old fail / fix pass

원v0 **v0-p2-run02**는 PC 두 폭×두 사례에서 열린 preview가 E1, 현재 입력/실제 복사 버튼→키보드 붙여넣기는 E2로 불일치:4실패, 완주/child1/도구 collector1. 같은 checker SHA로 fix1 네 경로는통과. E1→열기→중간 공백 삭제 없이 nonempty E2 대체→whitespace→empty→retype. fix1 공백/빈값에서 hidden뿐 아니라 textContent도 비움. 복사는 표준 UI 버튼·Ctrl+V이며 clipboard API stub/권한 grant 없음. 정확 사례 제목·대상·입력 E2의 전체 payload도 final_gate에서 원시값으로 대조했다. 실제 송신 없음.

초기 v0-p2-run01은 과거 `#n-*`를 재사용한 **검사기 선택자 오류**, P2에 도달하기 전 실패. 코드/로그/hash/exit1 보존. 새 DOM data-node 선택과 nonempty→nonempty의 중간empty 없는 입력으로 바로잡은 동일 checker가 old/new 양쪽 실행에 사용됐다.

## 두 입력의 실제 경로

기본 지도/변경→변경 부분(C32 또는SR)→실제 role/change 글자 Range·조상 clip·hit→정밀근거 기록의 type/summary/정확href에 실제 panel wheel 접근→닫기 직후 detail·링크 DOM 부재와 호출 focus 확인. 상세 전체 문서/모든 접힌 원문 인용을 한 화면에서 읽었다고 하지 않는다. FLOW R3 href는 정확 #L16, PT X1은 PH/PRC **두 정확 URL**을 별도로 대조했다.

초안은 사용자가 명시적으로 열 때 빈 자유문 한 칸이고 copy/preview disabled. 사례/대상/폭마다 **서로 다른 의미 있는 E**를 실제 입력. preview의 실제 대상·내용 확인→닫기 직후 다른 클릭/scroll 전 raw 지도 비교→같은 대상 E→다른 대상 다른 E→사례 왕복 각 E를 실제 재열기로 확인했다. 이 시안에는 집중 화면/‘전체복귀’ 별도 버튼이 없으므로 **초안 닫아 underlying 지도에 돌아오는 실제 동작**을 측정했고, 사례 전환 보기 보존은 별도로 측정했다. 초안 닫기 전후 선택·깊이·computed matrix·main/map/panel native scroll·카드/선 raw delta는 모두0. 재진입/사례왕복 raw도 보존. 코드의 카드허용0.5CSSpx/선허용0.5world와 실제delta를 구분했다.

FLOW 휠 직전→직후는1280 **(0,0)→(120,100)**, max235/130;1440 **(0,0)→(75,0)**, max75/0. 실제 음의 wheel로0에 도달한뒤 양의 wheel측정. PT는 두 폭 모두 extent0·이동0으로 기록, 움직였다는통과주장 없음. zoom은실제computed1.3. 근거 읽기 scroll과 지도 scroll을 분리했다.

근거가 열린 채 사례 전환은실제 가능해 이전 상세 DOM 제거/각사례 map/E보존을 확인. **초안 열린 채 사례전환·지도선택은 top/main inert 및 모달 hit coverage로 차단**되어 우회하지 않고 NOT_RUN/UI제한으로 기록했다. 현재 선택이 초안 작성 대상을 몰래 바꾸는 경로는 모달 UI에서 차단된다. 이 차단을 강제 state/선택 API로 뚫어 성공 처리하지 않았다.

## 공통화·의미와 시험 입력

`static-semantics.json`은 계약에서 둔 literal독립기대값: FLOW5역할/6관계 각종류·정확조건/F1–11 URL/C32만 policy변경, PT editor안SR·RC 및 밖HK, HK→RC 이벤트종류1관계. 검색→녹화 인과/가짜handoff 없음. PT의 사람 재현요청/고정patch/검색 작성자주장/병합 한계를 구분했고 HK는 ‘지원변경·별도요구아님’이다. 원 프로젝트 실행·수용 성공으로 확대하지 않는다.

동일 index/engine/style 실제HTTP hash 외에 엔진/CSS의 사례명·ID·문구별 분기가 없는지 정적 검사. 이름 재명명/변경정보 없음은 실제 query fixture 입력으로 열어 선택/역할/빈초안이 성립하고 가짜 변경행이 안 생김을 확인했다. duplicate/parent/depth/cycle/endpoint 잘못 입력은 UI 오류와 무그림으로 드러났고 무음보정하지 않았다. **동일 caseId + 동일 C32 nodeId**를 가진 두 정적시험JSON도 서로 다른 E로 실제 사례왕복 격리. 이 JSON변형은 별도 source 파일이며 숨은 앱 state 주입/세 번째 실사용 사례가 아니다. 임의 자료 범용 공통화 보장은 아니며 이 시험들에서 공통화 깨짐은 발견하지 않았다.

## 보존·한계

fix1-main-run01은 모든 장면을 수행했으나 Ctrl+Home이 가로를0으로 만들지 않아 wheel origin 선행조건2건 실패(child/collector1). 원시에는 실제 이동이 이미 있었지만 0→nonzero 약속을 만족하지 않았으므로 통과로 바꾸지 않았다. 코드/결과를 보존하고 **실제 음의 wheel**로 장면만 보완한 최신 run02를 기준으로 삼았다. 앱원본 수정/새synthetic failure probe 없음. snapshot은 해시별 한 벌, 최종PNG4장, 원본runtime/전체ZIP 중복 없음.

읽기부담 **관찰**: 기본은 짧고 변경 구분이 보이나 상단자료메타/근거 상세는 길다. panel을 아래로 읽고 상단닫기로 실제wheel 복귀가 필요했다. 그 횟수/글자수를 사람의이해/우열로 해석하지 않는다. PC 중심이며390은 두fixture 접근·가로overflow·근거닫기만smoke(실제 문서가로넘침0), 재설계/모바일 전체경로/터치 미실행. 보존은 같은탭메모리이며reload/다른세션 미검증. 외부원문왕복·실제AI송신/수락·원프로젝트실행/CI·사람사용성·큰지도·제품통합은 미검증. 제품 Task별manual4필드/제품source/main/checkpoint/gh-pages는 변경하지 않았다.

종료 경계: main actual-exit은 collector의 child subprocess 종료, outer-exit은 launcher의 collector subprocess 종료. launcher-tool-summary는 도구 exit의 **전사요약**, 전체 tool transcript나 서명 원문 아님. 원시 stdout/stderr는 combined process.log. runtime은source고정 링크·manifest 및 검증된assemble_runtime.py로 회수 가능하다. 새복제디렉터리에서 assemble→prepare_inputs.py→run_p2.py/launch_full.py(명시 fix1/manifest 경로)→final_gate. 실행별 codeSHA가 snapshot을 연결한다. source변경·FAIL·미완주·fatal·majorconsole/pageerror·cleanup은nonzero. 본 evidence만 허용경로에 추가했다.
