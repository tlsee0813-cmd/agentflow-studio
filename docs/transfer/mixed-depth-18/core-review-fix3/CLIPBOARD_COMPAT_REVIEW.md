# 클립보드 호환 변경 읽기 검토

판정: 검토한 변경은 기존 Windows USE106 원칙과 일치하며, 추가 중대 결함을 찾지 못했다. 제품이나 테스트는 수정하지 않았다. 실제 OS 클립보드·브라우저는 실행하지 않았다.

- `understanding17_browser.py:19–21`, `hierarchy18_browser.py:12–14`의 비교 변환은 정확히 `raw.replace('\r\n','\n')` 한 번이다. USE106:173–176과 같은 규칙이다. 단독 CR, LF, 탭·공백, Unicode 정규화·잘라내기 등은 적용하지 않는다.
- AREA17:83–86, AREA18:89–90은 OS에서 읽은 문자열을 먼저 `raw` 기록으로 JSONL에 남기고, 변환된 비교 문자열은 별도 `comparison`으로 표시한다. 두 파일에서 변환 호출은 각각 한 곳뿐이며 다운로드에 재사용하지 않는다.
- AREA17:111–113의 JS 문자열 길이·FNV 검사, :223의 미리보기 본문 전체 동등 비교, :251의 다운로드 인계 검사와 :109의 다운로드 읽기 경로는 유지된다. AREA18:94–95도 `t.length`·`charCodeAt` 기반 UTF-16 길이/FNV와 저장 레코드의 정확한 비교를 유지한다. H18의 이 검사는 원래부터 길이/digest 검사이며 새로 전체 본문 동등 검사가 되었다고 주장하지 않는다.
- 제품 `domain.ts:553`은 원래 인계 문자열의 `text.length`와 `digest(text)`를 기록하고, `validation.ts:381` digest 구현에 이 변환이 들어가지 않는다. 비교 변환을 통해 제품 본문이나 저장 digest를 다시 쓰는 경로는 없다.
- 제공 receipt의 두 SHA와 실제 파일 바이트가 일치했다. 모듈을 import하지 않고 AST에서 순수 helper만 추출해 각 6개 경계(12개)를 별도로 실행했으며 exit0이다. `CR + CRLF`는 한 번 변환하면 `CR + LF`여서 원래 단독 CR이 보존된다. 변환의 멱등성을 주장하거나 두 번 적용하지 않는다.

증거: `clipboard-compat-probe.json`; 원시 실행 결과는 `../product18-author-evidence/clipboard-independent-review.{stdout.log,stderr.log,exit.json}`. 실제 Windows/Linux 브라우저 결과는 별도 독립 실행에서 확인할 사항이다.
