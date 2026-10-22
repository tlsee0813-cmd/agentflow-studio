# 33 async reveal guard 좁은 독립 비교

**이번 guard 범위는 통과했다. Header/REPORT16은 미해결이며 재검사하지 않았다.** 정확 후보 `0e11efb932f0826f40cd5d36983f33044a895157`, tree `c6a4fdfa005a5209c8497d7439b0e0df6eb72326`. app SHA256 `83979bd309a84905a9afae2ead112aef734946bf024b837ea3c4ca8a84449dd5`/280692B, exact PC12 SHA256 `9ca1026516a3b5e897b88e49d5505b677b107a026f5a2c930df433de239bd580`/60650B를 직접 대조했다. 원673 및 원실패 `8ac357a4b77bab9eb70a7f9852c568aff84f898a`는 불변이다.

기존 controlled-delay controller와 judge 바이트를 동결본 그대로 복사했다. 각각 SHA256 `858f82f02bdfa1cf0142ff145c2e62c684c0616ba15bc88da6b8b5ebe6d8c5b6`, `2ba43eb539c655c05565a10f7fdbf5d7544115e0772a198081b8caaa4527c1ef`이다. 실행 wrapper는 제품 경로·runtime의 source 표기·출력 위치만 바인딩하며, 입력/명령 순서/지연/조건/단언은 그대로다. 실제 File.arrayBuffer가 읽은 buffer의 반환 완료를 보류하는 **검사 계측**이며 자연 지연 관측이 아니다. 제품 source·DOM·scroll·focus·저장값을 수리하지 않았다.

|분리 실행|실제 child / 외부 수집 종료|결과|
|---|---|---|
|Node22 typecheck, root build, continuity build|각0 / 외부0|정확 후보 빌드|
|동결 controlled-delay 수집|0 / 0|같은 work 양성 및 history→work 비교 수집 완료|
|동결 judge 의미 단언|0 / 0|이전 실패 조건 그대로 통과|
|exact test12 × 후보 양PC|0 / 0|2개 통과|
|같은 exact test12만 overlay × 원673 양PC|1 / 1|2개 모두 원 초점 탈취 line521 실패|

동결 독립 검사는 이전과 동일한 1280×720·공개 T2 정상 가져오기·정확 기존 H의 이미 수신된 파일을 사용했다. 같은 화면에서 기다린 양성은 y2378·home-file-result에서 y4005·result-file-review-heading으로 정상 reveal됐다. history→work 왕복은 해제 전후 모두 y0·nav-work 초점으로 유지됐다. 원673은 같은 경계에서 y0→4005·review heading 초점으로 바뀌었다. 후보도 선택 결과는 review 상태로 남고 ‘이미 가져온 결과’/정확 요청을 표시한다. 현재 작업과 저장 envelope 전체가 해제 전후 동일했다. 비교는 `controlled/*comparison.json`, `judgment.json`과 before/after PNG에 있다. 독립 fixture의 선택 보존과 실제 새 파일 수신의 원문 바이트 검사는 아래 exact test12를 구분해 기록한다.

exact test12는 정상 UI로 만든 실제 H/template의 명시 합성 파일을 사용한다. 후보 양PC에서 같은 work 양성, history→work의 현재 y/focus/open/entry 보존, 명시 context 열기 후 늦은 완료가 context를 빼앗지 않음, context 열린 채 새 선택은 정상 reveal, 원문 textarea의 개행 표현 대조, 실제 수신 rawText와 선택 파일 UTF-8 원문 완전일치/정확 parent/H, 이전 작업·draft·space 불변, 다른 새 entry의 입력/초점 보호까지 메서드 전체가 도달했다. 두 PC의 선택 파일·원시 stdout/stderr·observations와 정확 검사 소스를 회수할 수 있다. 원673은 같은 work 양성 후 history→work 초점 비교에서 실패하므로 그 뒤 context/수신/new-entry 조건은 **원673에서 미실행**이다. 후보 통과와 원673 부분 실행을 합산하지 않는다.

Node22.16.0 / TS5.8.3 / Playwright1.57.0 / 실제 system Chromium154.0.8037.57, 기존 승인 loopback MOCK를 재사용했다. controlled HTTP30개 및 exact 검사 각각 HTTP6개가200/body↔실행disk 일치이고, controlled는 종료 후 disk hash도 일치한다. 고정 source 전후와 exact test 바이트도 동일하다. 원673은 검사 한 파일만 명시 overlay하며 제품/빌드 바이트는 앞서 검증한673과 같다. console error/pageerror0, paid AI0. server -15는 수집 뒤 의도적 terminate이며 검사/collector 종료와 별도다.

old read/new read 중첩 정리는 이번 test에서 실행하지 않았다. 자연 파일 지연·실제 AI·사용자 의미 이해·모바일·전체33/REPORT16/CI 재검사는 미실행이다. 이번 결과는 async guard 한정이며 후보 전체 수용이나 Header 해결을 뜻하지 않는다. 원 실패·로그를 고치거나 덮지 않았다. `MANIFEST.tsv`는 자기 자신 제외 정확 집합, gzip은 원해시/압축해시/해제 검산을 index로 남겼다. 외부 종료 receipt는 실제 tool 반환값 전사이며 전체 tool 원문이 아니다.

후처리 준비 오류: CSS 해시 메타데이터 경로를 src/client로 잘못 잡아 첫 패키징이 실패했다. 실제 public/styles.css 경로로만 고쳤으며 제품/검사/브라우저 재실행은 없었다. 원 오류는 packaging-first-error.log에 별도 보존했다.
