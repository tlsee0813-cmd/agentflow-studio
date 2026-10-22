# 작성자 BRANCH31 fix2 회귀의 실제 실행

정확 후보 `72940a043d7a7fdc225a9582ce48831fa0418cc0` / tree `4be9b2c91e11e88587b84b1cc4cf4461e1433493`, parent6f264입니다. app SHA256 `7c63a494627b1ce2da8f089573f4116b17ba04e4af4531f6e2d315ccacee2e0e` 불변. 정확 검사24549B / SHA256 `17fc22a31aaef376d18622934c7893f701a215e678203572014fc9c645ae9fcd`를 수정 없이 실행했습니다.

| 실행 | 범위 | 실제 결과 | child / 외부 collector |
|---|---|---|---|
| 후보72940a | 기존4+신규1 메서드×양PC | 10/10 PASS | 0 / 0 |
| 원본7c7+동일 검사 하나만 overlay | 신규 test05×양PC만 | 0/2 PASS, 2 FAIL | 1 / 1 |

원본은 `7c7bdfa8d244d83c2c776b91b6a3a669127ba2e9`의 제품을 그대로 유지했습니다(app `da2502c6a011578c77931a10f41a7fcd09f182ae3b8b186b26f640966b747c2b`). 후보 검사 파일 하나만 overlay했고 다른 원본 제품/검사/fixture는 바꾸지 않았습니다. 양쪽 추출 소스/검사 전후 해시 불변입니다. 준비 오류나 검사 수정·약화·재시도는 없습니다.

신규 test05의 양PC 원본 실패는 **준비 guard가 아닙니다**. 실제 문서 maxScroll>=120, native wheel page120, 신호 전체 clipping/hit guard가 먼저 통과했습니다. trusted capture before product는120, 같은 click task after product는0으로 바뀌어 line175 pageY 보존 단언이 실패했습니다. finally에서 별도 수집한 두 native frames도0/0입니다. 첫 실패/traceback/원 PNG를 보존했습니다. 원본 실패 후 owner/glyph/최종 저장 동등 단언까지 도달했다고 주장하지 않습니다.

후보의 동일 신규 장면은 두PC 모두120→120, 후속 frames120/120이며 최종 높이·정확 owner·첫 소유자 글줄의 실제 Range clip/hit·matrix/folds·현재B/draft/target/원자료 동등 및 새AI요청0 단언까지 완주했습니다. 이 결과는 작성자 공개 domain API 합성 fixture의 정상 복구입력 기반 회귀 실행이며, 앞선 정상UI 독립 반례와 합산한 독립검사 수가 아닙니다. 종전8개도 정확 후보에서 실행됐습니다.

Node22.16.0 / TypeScript5.8.3 / Playwright1.57.0 / 실제 Chromium154.0.8037.57. 양쪽 typecheck/root build/continuity build 각각exit0입니다. 실제 loopback HTTP index/CSS/app.js 응답 body와 실행 dist 파일 SHA를 수집했고 모두 HTTP200/동등입니다. SOURCE.after는 종료후 compiled 파일 해시와 소스 불변을 연결합니다. runtime raw에 실제 URL/UTC/버전/console/pageerror/서버 종료가 있습니다. 원래 cleanup terminate의 실제 server exit -15는 child/collector 판정과 다릅니다. read-only runner는 응답·console·pageerror 및 원 teardown 뒤 server exit만 수집했고 원검사 행동·단언을 바꾸지 않았습니다. OUTER_EXIT_RECEIPT는 tool 완료 metadata 전사이며 전체 tool 원문이 아닙니다.

원 검사·합성 fixture seed/복구자료·원시 관측·stdout/stderr·실제 프로세스명령/종료·원 PNG12장을 보존했습니다. 큰 JSON/JSONL은 원bytes/SHA와 gzip SHA/재해제 byte동등의 RAW_INDEX로 연결했습니다. MANIFEST는 자신을 제외한 정확 payload집합입니다. 전체 제품 소스/build/node_modules는 포함하지 않습니다.

32/oracle 자료, broad회귀, CI조회, 새설치, 실제AI 및 사람사용성은 미실행입니다. 제품/검사는 수정하지 않았고 이전 증거도 불변입니다.
