# 110 리본 라벨 빌드 대상 안내 PC 시제품

요청 참조 `RQ_0797ee20-a84e-4aa7-ace6-b4f053ca87f7`(109에서 생성·보존한 고정 요청문)의 선택 범위 하나를 실제 코드로 구현했다. 기준 dc430ba(app 트리 5736b79)에서 시작했고, 코드 commit은 [6d9c2ab](https://github.com/tlsee0813-cmd/agentflow-studio/commit/6d9c2abc8c10f1aaddecd0f9bc7934153dfcc230)이다. `app/**`와 기존 cycle은 바꾸지 않았다(HEAD의 app 트리 5736b79 그대로). AgentFlow 제품 변경·배포나 원 Zephyr 하드웨어 작업이 아니다.

요청문 길이 16,202(UTF16)·SHA256 76449ae3…db2e6b는 총괄이 정상 export에서 회수해 준 값이다. 이 세션에서 다시 계산하지 않았고, 요청문 전문은 저장소에 복제하지 않았다. 요청문 안의 원자료 문장은 근거로만 읽었고 실행 지시로 쓰지 않았다.

## 구현 선택

요청문은 실행 형태(명령줄/화면)와 입력·표시 방식을 정하지 않았다. 아래는 총괄이 고른 구현 형태이며, 원자료 사실이나 사용자가 이미 확정한 요구가 아니다.

- 의존성 없는 로컬 브라우저 화면(HTML/CSS/classic script). `index.html`을 직접 열거나 기존 Python으로 127.0.0.1에서 제공한다.
- `label-lookup.js`: 문서 Display 표의 두 행만 고정(`Object.freeze`) 데이터로 두고 `describe`/`findEntry`로 조회한다. 브라우저와 Node 공용.
- 매칭: `String.prototype.trim`으로 앞뒤 공백만 제거한 뒤 라벨 전체를 대소문자 구분으로 `===` 비교한다. 접두어·부분·대소문자·하이픈·유사 문자를 보정하지 않는다. trim은 ECMAScript 공백(전각 공백 U+3000, NBSP 포함)을 제거하지만 zero-width space(U+200B)는 제거하지 않으므로 그런 입력은 확인 필요가 된다.
- 화면: 왼쪽에는 입력칸과 짧은 정책 도움말, 문서에 있는 두 라벨, PCB 버전 미사용 안내, 출처를 둔다. 오른쪽에는 상태 배지, 비교한 입력의 글자 그대로 표시, 화면 모델·컨트롤러·드라이버·보드 지정 네 행(각 행에 무엇인지 한 줄 설명), Low Power 제한을 항상 표시한다.
- 갱신: `input` 이벤트마다 동기적으로 다시 그린다. 일치하지 않으면 네 값을 모두 `—`로 바꾼다. 상태 문구 높이를 고정해 상태가 바뀌어도 표 위치가 움직이지 않는다.
- 안전: 값은 모두 `textContent`로만 넣는다. CSP는 `default-src 'none'; script-src 'self'; connect-src 'none'`이고, 외부 링크는 제공된 고정 GitHub 주소 하나뿐이다. 빌드·플래시 버튼, PCB 선택, 자동 업데이트, 새 라벨, 하드웨어·네트워크 동작은 넣지 않았다.

| 리본 라벨 | 화면 모델 | 컨트롤러 | 드라이버 | 보드 지정 |
|---|---|---|---|---|
| `HINK-E0213` | Good Display GDEH0213B1 | SSD1673 | ssd16xx | `reel_board` |
| `HINK-E0213A22` | Good Display GDEH0213B72 | SSD1675A | ssd16xx | `reel_board@2` |

값의 출처는 [Zephyr index.rst L9-L112 @ 3568e1b6](https://github.com/zephyrproject-rtos/zephyr/blob/3568e1b6d5cdd51a6b964a2a1d6d29200fea2056/boards/phytec/reel_board/doc/index.rst#L9-L112)의 표와 Power supply 주석이다. 이번에 새로 조사하거나 실기에서 확인한 값이 아니며, 화면에도 그렇게 적었다.

## 실제 검사 (대상: 6d9c2ab를 `git archive`로 꺼낸 깨끗한 사본)

**Node 기본 test**(v22.22.0): `node --test …/label-lookup.test.js …/app.test.js` → 20/20 통과, exit 0.

- 조회 15건: 표 값과 동결, 두 라벨의 정확한 대응, 긴 라벨이 짧은 라벨 행으로 가지 않음, 두 라벨의 화면·컨트롤러·보드 지정이 서로 다르고 driver는 같음, 앞뒤 공백 무시를 확인했다. 확인 필요가 되는 입력으로 빈 값·공백(비문자열 포함)·접두어/부분(`HINK-E0213A`, `HINK-E0213A2` 등)·뒤나 앞에 덧붙인 값·대소문자 변형·하이픈/en dash/non-breaking hyphen/O↔0/l↔1/전각/zero-width 변형, `1507.1`·`1507.2`·`reel_board@2`·모델명을 검사했다. 그 밖에 정상→미상 순서, HTML 형태 입력, 제한 문구와 고정 URL, 코드에 HTML 삽입 API(innerHTML 등)와 네트워크 API가 없음, CSP, 로컬 참조 3개도 확인했다.
- 화면 갱신 5건: 최소 가짜 DOM에서 실제 `app.js`를 실행했다. 첫 화면, 한 단계씩 입력할 때의 상태·배지·네 값·입력 표시, `Esc`·지우기·`Enter`(기본 동작 막음), HTML 입력의 글자 그대로 표시를 확인했다.
- 검사가 실제로 결함을 잡는지 변형으로 확인했다(제출하지 않은 임시 변형). `startsWith` 매칭은 8건 실패, 대소문자 무시는 2건, 하이픈 정규화는 1건, 미일치 때 값을 비우지 않는 UI는 4건 실패했다.

**실제 브라우저**(사전 설치된 Playwright 1.63.0 Chromium, headless, 1280×720): README의 `python3 -m http.server … --bind 127.0.0.1` 명령으로 제공한 페이지에서 확인했다.

- 키보드로 `HINK-E0213` 입력 → GDEH0213B1/SSD1673/ssd16xx/reel_board가 보였다. `A` 추가 → 확인 필요·값 `—`, `22` 추가 → GDEH0213B72/SSD1675A/ssd16xx/reel_board@2, Backspace → 확인 필요·값 `—`, `Esc` → 빈 상태가 됐다. 정상 상태에서 전체 선택 후 `hink` 입력 → 확인 필요.
- `fill` 입력 결과: 공백만, `hink-e0213a22`, `HINK-E021`, `1507.2`, `reel_board@2`, `FOO-123`은 확인 필요였고 `"  HINK-E0213A22\t"`는 정상이었다.
- `<img onerror>`·`<script>` 입력에서 img 0개, 스크립트 2개(원래 수 그대로), 전역 변수 미설정, dialog 0이었고 입력은 글자로만 보였다.
- 측정한 18개 상태 중 의도적으로 넣은 300자 입력(문서 높이 832)을 뺀 17개는 문서 높이가 720 그대로라 세로 스크롤이 없었다. 가로 넘침 없음, console 오류 0, 요청은 자기 파일 4개뿐이었다. Tab 순서는 입력 → 지우기 → 문서 링크이고, Enter는 URL을 바꾸지 않았다.
- 시스템 다크 테마와 `file://`로 직접 연 경우도 같은 흐름을 돌렸다. 오류 0이고 같은 결과였다.
- 스크린샷은 세션 scratchpad에만 두었고 저장소에 넣지 않았다(이번 허용 범위가 RESULT/RETURN뿐이라서).

## 미확인·한계

- 화면 확인은 headless Chromium 한 종류에서만 했다. Firefox·Safari, Windows 글꼴, 화면 읽기 프로그램, 실제 사람의 사용성은 확인하지 않았다.
- root의 정확한 commit 독립 실행과 1280 브라우저 확인은 아직 받지 않았다. 이 문서의 검사는 모두 작성자 본인이 한 것이다.
- 표 밖의 라벨(향후 교체 화면 등)은 지원하지 않는다. 문서상 공급 화면과 현재 유통 보드의 일치 여부는 주장하지 않는다.
- 원 하드웨어 빌드·플래시·전력 측정은 실행하지 않았다. 센서·회로·전원 제어나 절전 기능에는 손대지 않았다.
- AgentFlow 앱 통합·배포·PR·merge는 하지 않았다. 이 Node test 통과가 AgentFlow 제품의 완성을 뜻하지 않는다.
