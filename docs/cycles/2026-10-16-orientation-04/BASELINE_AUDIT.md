# cycle04 기준 관측 독립 감사

2026-10-16 · 내부 6.1 Sol High의 코드·기록 대조이며 새 브라우저 실행과 합산하지 않는다. 최초 측정의 자체 clip 누락은 보완 실행에서 정정됐다. 최신 판단은 [BASELINE](BASELINE.md)을 함께 읽는다.

## cycle04 — 첫 화면 기준 관측 코드 감사

2026-10-16 · Sol. [고정 62d59d7e의 파일 목록](https://github.com/tlsee0813-cmd/agentflow-studio/tree/62d59d7ed6f4f460831ae88685bde5b7e2dac703/docs/transfer/orientation-04/baseline)을 먼저 확인하고 observe.py·REPORT·JSON/프로세스 기록을 대조했다. 큰 result.json은 수령 담당이 검증한 [동일 result.json 원본](https://github.com/tlsee0813-cmd/agentflow-studio/blob/62d59d7ed6f4f460831ae88685bde5b7e2dac703/docs/transfer/orientation-04/baseline/result.json)을 사용했다. PNG 판독·해시 수령 감사는 중복하지 않았으며 새 브라우저 실행·원격 수정은 없다.

**판정:** 보고된 실제 동작 이름/영역 노드 이름 수는 재계산 결과 모두 맞다. 이는 최초 위치에서 특정 라벨의 기하 노출을 기술한 결과이며 동작·내용 전체의 가시성이나 사람 이해 성공 판정이 아니다. 한 가지 자체 clip 처리 한계는 아래처럼 남긴다.

### 수정 또는 한정할 측정 설명

[observe.py 13–15행](https://github.com/tlsee0813-cmd/agentflow-studio/blob/62d59d7ed6f4f460831ae88685bde5b7e2dac703/docs/transfer/orientation-04/baseline/observe.py#L13-L15)의 clip 계산은 `p!==e`라서 **측정 대상 자체의 overflow hidden/clip 경계는 제외**한다. REPORT는 이를 기록한다고 설명하면서 헤더 목표 문자의 상자가 자체 경계 안에 들어온다고도 적지만, 390 JSON은 목표 요소 y=36/overflow hidden에 첫 문자 Range 상단 y=35를 기록한다. 따라서 그 문구는 수직으로 1px 맞지 않는다.

이는 **측정 정의의 자체 clip 누락과 REPORT의 자체 경계 진술 오류**다. 폰트 Range 상자와 실제 잉크의 차이도 있어 UI 글자 잘림 결함으로 확정하지 않는다. **이번 action/area 이름 수에는 영향이 없다.** 그러나 후보에 ellipsis/자체 clip이 생길 때 같은 함수를 일반적인 ‘전체 텍스트 무잘림’ 판정으로 재사용하면 누락할 수 있다. 후보 비교 전에 자체 clip까지 포함한 정의를 고정하고, 보완 실행은 같은 세 초기 화면에 한정한다. 기존 16단계나 새 후보로 재실행 범위를 넓힐 이유는 아니다.

### 관측과 집계 대조

| 크기 | 실제 동작 이름 FULL | 실제 영역 노드 이름 FULL | 원본 문자 상태로 재계산한 근거 |
| --- | --- | --- | --- |
| 390×844 | 2/3 | 0/4 | 목적 정정·작업 지시 FULL, 사용자 결정 표시 7문자 CLIPPED. 네 영역 이름은 모두 OUTSIDE_CLIP. |
| 1280×720 | 3/3 | 3/4 | 동작 셋 FULL. 저장 복구 4문자 CLIPPED, 나머지 영역 셋 FULL. |
| 1440×900 | 3/3 | 4/4 | 일곱 실제 노드 이름의 모든 비공백 문자 상태가 FULL. |

`labelCounts`를 신뢰해서 옮긴 것이 아니라 각 대상 `glyphs`의 모든 상태가 `VISIBLE_FULL_GLYPH`인지 다시 계산해 저장값·REPORT와 대조했다. 선택자는 실제 `.part .nm`와 `.area-head .nm`이다(17·29행). **동작 아래 설명 `.ln`, 카드/영역 본문 전체, 관계 의미의 이해를 세지 않는다.** 상단 설명 속 네 이름은 별도 `named-impact-summary`이며 세 크기 모두 FULL이다. 그러므로 390의 0/4를 ‘첫 화면 어디에도 영역 이름이 없음’으로 바꾸면 틀린다. 관계 의미 안내와 접힌 도움말 제목은 390에서는 NONE, 데스크톱에서는 FULL이다.

문자 판정은 비공백 문자별 Range 상자를 viewport/overflow 조상 경계와 교차시키고, 남은 가로 구간 15/50/85%의 중간 높이에서 hit-test한다. 모든 문자 상자가 들어오고 표본이 대상/자손에 닿을 때 FULL이다. 실제 글꼴 잉크의 모든 픽셀·가독성·인지 여부를 확인하는 방식이 아니며 REPORT도 표본 판정/폰트 치수 한계를 명시한다. 닫힌 도움말 본문이나 원본 textContent를 가시성으로 합산하지 않았다.

### 시작 상태·바이트·실행 완료

- **최초 무조작 상태:** 새 context 세 개에서 goto/글꼴 대기/읽기 전용 측정/스크린샷만 한다. 마우스·키보드·스크롤·앱 API 조작 경로가 없다. 26–28행에서 선택/pressed 없음 및 창·지도·brief 스크롤 0을 검사하고, JSON도 세 크기 모두 측정 전후 상태가 같다. depth는 home1/task2/next0/restore1, 선 0, 도움말 닫힘, 초점 BODY다.
- **HTTP 바이트 귀속:** 25행에서 실제 최초 navigation 응답 `response.body()`의 SHA256과 HTTP200을 검사한다. 세 응답 및 로컬 파일 전후 해시는 모두 `af748df1dfacb7ed6b4ae3709d5ced26ef43f96bc45a9e6c2c05cdc02e9cc77e`다. 대상 HTML `34b41240…`, 관측 배정 `1bba6f33…`, 증거 공유 `62d59d7e…`는 다른 버전 역할이다.
- **초기 범위/배율:** 390은 창 maxY819, 지도 내부 max0/0·overflow visible, transform none이며 배율 표시는100%/컨트롤 숨김이다. 1280은 창 max0/0, 지도 maxX10/maxY135, CSS matrix 배율1이다. 1440은 창·지도 max0/0, CSS matrix 배율1이다. 세 크기 visualViewport scale/devicePixelRatio는1이다. 정수 offsetHeight에 따른 작은 scaleY 비율 차이는 다른 CSS 배율이라고 읽지 않는다. 스크롤 가능 범위를 계산했을 뿐 실제 휠/터치 접근은 실행하지 않았다.
- **완료/종료:** JSON의 서로 다른 세 viewport와 expected/executed3/3·complete=true·exit0은 process.log 및 actual_process_exit0 기록과 맞는다. fatal/pageerrors/cleanup_errors는 비어 있고 favicon404 콘솔 resource 오류만 남는다. 코드 31–37행은 예외·cleanup·pageerror·미완주·해시 불일치를 nonzero로 연결한다. 실패 경로의 음성 실행은 없고, try 밖의 파일/출력 오류에서는 최종 JSON 없이 자연 nonzero가 될 수 있다.

이 exit0은 **원본 귀속과 최초 관측 세 건의 실행 완료**를 뜻한다. 노출 수가 낮다고 실행 FAIL이 되는 검사가 아니며, 기존 cycle03 16단계나 새 후보를 실행하지 않았다. 후보 간 우승·첫 화면 의미 이해·사람 부담 감소는 미관측이다.



## cycle04 — 최초 화면 측정 정의 보완 감사

2026-10-16 · Sol. [고정 165c1520의 definition-addendum](https://github.com/tlsee0813-cmd/agentflow-studio/tree/165c15205a2f89d591ab431df47be5b9592676ff/docs/transfer/orientation-04/baseline/definition-addendum) 목록부터 확인하고 코드·JSON·전후 diff·REPORT·종료 기록을 대조했다. 큰 JSON은 같은 고정 raw HTTPS에서 원본 바이트로 회수했다. 브라우저·기존16단계 재실행·원격 변경은 없다.

**판정: 지적한 자체 overflow 누락을 좁게 보완했다.** 기존 action/area 집계는 유지되며 390 목표 문장의 분류만 실질적으로 바뀐다. UI 글자 잉크 잘림이나 사람 이해 실패로 확대하지 않는다.

| 감사 항목 | 확인 결과 |
| --- | --- |
| 최소 코드 변경 | 이전 observe.py와 실제 비교한 diff가 `measurement.diff`와 헤더를 제외하고 정확히 일치한다. 조상 clip을 따로 보존하고 대상 자신의 overflowX/Y별 clip을 추가해 최종 경계에 교차한다. 자체 경계는 실제 소수 rect에서 CSS border를 뺀 padding 경계로 계산한다. 기존 문자 Range/표본 hit·선택자·세 화면·상태 검사·HTTP 해시/종료 집계는 유지했다. 노출 이름을 PARTIAL_LAYOUT로 바꾸고 새 PNG 중복 촬영만 생략했다. |
| 390 목표 문장 | 기존 FULL → **PARTIAL_LAYOUT**. 자체 clip x16..374/y36..73.6875, 첫 줄 Range 상단 y35라 **1 CSS px** 경계 차이다. 43개 비공백 문자 중 26 CLIPPED/17 FULL이 JSON 및 classification-diff와 맞는다. 기존 REPORT의 ‘자체 경계 안’ 진술도 보완 REPORT가 명시적으로 정정한다. |
| 다른 분류와 이름 수 | 1280/1440 목표 문장은 FULL 유지. 390 사용자 결정 표시·1280 저장 복구는 기존 PARTIAL을 PARTIAL_LAYOUT로 **명칭만 변경**했으며 문자 상태 수가 같다. 나머지 노출 분류는 같다. JSON 문자 상태를 독립 재계산한 동작/실제 영역 이름은 **390: 2/3·0/4, 1280: 3/3·3/4, 1440: 3/3·4/4**로 전후/REPORT 모두 일치한다. 설명 속 영역 이름과 실제 노드 라벨은 계속 별도로 센다. |
| 최초 상태·범위 | 세 viewport는 390×844·1280×720·1440×900이다. 각 관측의 before/after 상태가 같고 이전 기준의 상태와도 같다. 선택·pressed 없음, 창/지도/brief 스크롤0, 초기 깊이/배율/도움말 닫힘 유지다. 입력 이벤트·앱 상태 변경·새 스크린샷 경로는 없다. 이전 PNG는 참조 링크이며 보완 실행에서 새로 촬영했다고 쓰지 않는다. |
| 정확한 실행 바이트 | 대상 HTML은 여전히 `34b4124098fe6242b34e16e23532ceb3e0fe91ad`의 fix1이다. 세 최초 `page.goto()` 응답 body 해시와 HTTP200을 코드가 직접 검사하며, JSON의 세 응답 및 파일 전후 SHA는 모두 `af748df1dfacb7ed6b4ae3709d5ced26ef43f96bc45a9e6c2c05cdc02e9cc77e`다. |
| 완료·실제 종료 | expected/executed3/3, complete=true, fatal=null/pageerrors=[]/cleanup_errors=[], JSON exit0은 process.log 및 별도 actual_process_exit0과 맞는다. 종료 로직은 이전과 같고 실패 경로의 새 음성 실행은 없다. exit0은 관측 실행·원본 귀속의 완료이며 노출/이해 합격이 아니다. |

원시 UTC는 Python JSON 문자열로 읽었으며 PowerShell 날짜 자동 변환을 사용하지 않았다.

- 시작: `2026-10-15T18:05:30.017590+00:00`
- 종료: `2026-10-15T18:05:32.838035+00:00`

무결성: manifest의 **7 payload 크기·SHA256 전부 일치**, manifest 자체를 합쳐 8파일이다. result.json은 **1,408,482 B**, SHA256 `d4b5bfa7d4b6754fcdb48ba07feab5ea0d435236e39e700bc84ab09cedfd0c04`. classification-diff가 가리키는 이전 result SHA `b52f4be187d62da1bd4ed712a72c70991aa4c4b8253df9b82471dc49436188af`도 보존된 기준 원본과 일치한다. 이전 보고/JSON을 덮어서 과거 판정을 바꾼 증거가 아니라 별도 후속 정의·실행으로 구분한다.

남는 한계: 보완은 고정 대상의 기하 clip/표본 가림 정의다. 문자 Range는 실제 글자 잉크가 아니고 세 hit 지점은 모든 픽셀의 무가림을 증명하지 않는다. 미래 후보의 다른 transform·복잡한 clip까지 검증된 일반 엔진으로 간주하지 않는다. 새 후보·사람 효과·기존 상호작용 흐름은 이번에 실행하지 않았다.



## 별도 수령 담당의 대조

최초 기준은 부모40740eac에서 지정 경로12파일만 추가했고, manifest payload11/11·전체1,742,165bytes를 대조했다. 보완은 직접 부모62d59d7e에서 definition-addendum8파일만 추가했고, payload7/7·전체1,440,742bytes를 대조했다. 보완 result.json 1,408,482bytes의 SHA256은 d4b5bfa7d4b6754fcdb48ba07feab5ea0d435236e39e700bc84ab09cedfd0c04다. 수령 무결성이 최초 측정 정의까지 옳다는 뜻은 아니며, 위 발견·정정을 우선해 읽는다. 두 실행의 원본은 BASELINE의 고정 GitHub 경로에서 회수할 수 있다.
