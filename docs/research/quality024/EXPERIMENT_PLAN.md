# QUALITY024-T1 — 같은 prompt, thinking 한 가지 대조

상태: 제안/미구현/미실행. 아래 diff는 송신 규격 설명이며 적용용 제품 patch가 아니다.

## 1. 단일 대조와 고정값

| 항목 | A | B |
|---|---|---|
| API | 기존 승인된 `https://api.deepseek.com/chat/completions` | 동일 |
| model | `deepseek-flash` | 동일 |
| system prompt | IDEA023 원문 | 바이트 동일 |
| 사용자 INPUT / sources / bases / appFacts / 수동값 | 쌍별 동결 상태로 만든 요청 | 바이트 동일 |
| thinking | `{ "type": "disabled" }` | `{ "type": "enabled" }` |
| reasoning_effort | 필드 생략 | `"high"` |
| max_tokens | 8192 | 8192 |
| provider timeoutMs | 60000 | 60000 |
| stream / response_format | `false` / `{ "type": "json_object" }` | 동일 |
| temperature / top_p / penalties / tools / stop | 추가하지 않음 | 추가하지 않음 |
| 최종 계약 | 기존 8키·타입·길이·ID 엄격 검증 | 동일 |
| source API / 저장 | `idea022.context.4` / `idea015.project.2` | 동일 |
| input / provider response / 관측 prefix | 각각 기존 131072바이트 경계 | 동일 |
| 저장 | 기존 8MB 경계 | 동일 |

A→B의 **실제 송신 JSON 차이**는 아래뿐이다.

```diff
- "thinking": {"type":"disabled"}
+ "thinking": {"type":"enabled"}
+ "reasoning_effort":"high"
```

현재 023 배포 설정에서 두 조건에 공통으로 주는 여유는 `max_tokens:2048→8192`, `timeoutMs:15000→60000`이다. 이는 새 A/B 안에서 같으므로 모드 비교를 방해하지 않지만 **과거 023 대 새 A/B의 차이를 thinking 효과로 돌릴 수는 없다.** 토큰 상한은 최대 허용량이지 실제 사용량이 아니다. 추론 토큰도 생성 completion의 일부로 취급하여 final JSON 여유를 관찰한다.[D2][D3]

8192/60초는 짧은 8키 출력과 추론을 함께 관찰할 최초 제안값이다. high는 공식 native 값으로 고정하며 자동 effort·max·모델 교체를 섞지 않는다. 이 예산으로 완료하지 못하면 실패를 숨기지 않고 아래와 같이 한도 경계를 보고한다. 충분성을 사전 보증하지 않는다.

## 2. 입력 7개, 사전 고정 28회 이내

기존 문제 후보 C02 최초, C06 최초, Q02-filter 최초, Q03-publication 최초와 성공 대조 C05의 60일 변경 직전 입력을 사용한다. 새 공연장 변형 N01/N02 두 개를 더한다. **7입력 × 2조건 × 사전 등록 2반복 = 최대 28회**다. 최초 응답만 비교하며 자동 합성 답, 다음 단계, 추가 재시도는 없다. 두 반복은 단일 표본의 우연을 드러내기 위한 작은 반복이지 통계적 검정력을 보장하지 않는다.

순서는 결과를 보기 전에 다음으로 고정한다. 1반복은 C02(A,B), C06(B,A), Q02(A,B), Q03(B,A), C05(A,B), N01(B,A), N02(A,B). 2반복은 같은 사례 순서에서 각 쌍의 A/B 순서를 뒤집는다. 순서·모드 대응은 운영자만 보관하고 평가자는 익명 X/Y 답을 읽는다. 결과에 따라 재배치하거나 나쁜 표본을 교체하지 않는다.

각 arm의 보호된 localhost 서버를 독립적으로 유지하면 조건당 14회로 기존 process cap20 안에 있다. 같은 쌍은 동일 ticket을 서로 다른 서버에 보내고, 다음 반복에서는 같은 동결 project에서 새 `begin` ticket을 만든다. 기존 duplicate guard를 끄지 않는다. 실행은 양쪽을 통틀어 직렬이며 기존 rate6/cap20/concurrency2를 올리지 않는다. 전역 dispatch 간격도 최소 61000/6ms로 유지한다. 새 프로세스 반복 생성으로 cap을 우회하지 않는다.

기존 사례는 Cloud의 실제 `project-before`를 재사용한다. 요약에서 상태·과거 AI 답을 재구성하거나 이전 성공 답을 새 모델 결과로 주입하지 않는다. `validateProject → begin → validateRequest → 보호 localhost/provider → 원문 응답 → rev1 반향 검사 → receive → handoffText`를 유지한다. 각 조건/반복의 project는 독립 복사이며 한 조건의 답을 다음 조건에 넘기지 않는다.

### 모델에 평가 의도를 주지 않는 공통 입력 정리

기존 A의 engine fresh는 사례 title을 projectName에 넣는다. C02 title에는 ‘예약 성립의 중요한 모호함’이 있어 질문 목표가 새어 나간다. 원본은 보존하고 **동결 입력을 만들기 전 `rename`으로 중립 이름**(도자기 공방, 수리교실, 악기 대여점)을 사용한다. Q02=분실물 찾기, Q03=합창단 소식, N01/N02=공연장 안내로 한다. `rename`의 실제 revision 변화까지 양쪽에 같은 상태로 기록한다. 요청 JSON만 손으로 덮거나 basis/source/history/manual을 고치지 않는다. 원본 대비 바뀐 메타데이터를 기록하며 이를 023 원본 바이트 재생이라고 부르지 않는다. source 원문에 추가 평가 힌트가 발견되면 임의로 지우지 않고 자료 오염으로 따로 표시한다.

`allowedFacts`, purpose, probes, observe, 보고서, 원인 가설, 비교 모드, 평가표는 messages에 넣지 않는다. 신규 변형의 문장 차이는 합성 고객이 실제로 알려 준 다른 조건이며, 두 arm에는 각 변형의 동일 원문을 준다.

## 3. 기존 보호 경로에서 필요한 후속 접착만

**이번에는 아래 변경을 하지 않았다.** 제품 원본과 기존 runner를 보존하고 후속 실험 디렉터리의 좁은 transport 복사본/어댑터로만 구현할 제안이다. 기존 import는 원본 제품의 실제 모듈을 가리켜야 하며 prompt나 provider를 새로 복제하지 않는다.

| 실제 023 위치 | 이후 실험 접착에서 할 일 |
|---|---|
| `app/server/config.mjs:22–23`; `experiments/idea016/transport.mjs:98–110` | 기존 readConfig는 timeout≤60000, maxTokens≤4096만 허용한다. **AI_MAX_TOKENS=8192는 현재 거절된다.** 기본 검증·키 결속·origin·gate·rate/cap은 그대로 재사용하고, 실험 복사본에서 검증된 config에 **고정 8192 토큰만** 명시적 lab override로 제공한다. 임의 override 경로를 열지 않는다. safeConfig와 실험 manifest에는 실제 8192/60000 및 모드를 기록한다. 제품 config 범위는 수정하지 않는다. |
| `app/continuity/server/prompt.mjs:41–44` | `buildBody`는 thinking disabled 고정이고 effort env를 읽지 않는다. 수정하지 않는다. 기존 builder가 만든 바디를 사용한다. |
| `transport.mjs:110–118`의 provider fetch 관측 경계 | **hash/기록 전에** 허용된 두 필드만 바꾼 최종 wire body를 만든다. 원래 builder body와 최종 wire body를 모두 기존 key-bound writer로 구별해 보존하고, `request-provider.raw.json`·requestSha256은 반드시 **실제로 송신한 최종 바디**를 가리키게 한다. messages·model·max_tokens·response_format·stream의 비허용 차이는 전송 전에 거절한다. global fetch/curl 안쪽에서 몰래 바꾸면 기존 기록은 실제 송신을 증명하지 못하므로 금지한다. |
| `transport.mjs:120,137–166`; `engine.mjs:69–78` | 기존 Response를 수정하지 않고 반환한다. raw clone 보호, parsed app 반향 차단, 오류 후 중단, receive와 handoff의 키 결속 기록을 그대로 유지한다. 응답 수리·reasoning 제거 후 수용·출력 계약 완화는 하지 않는다. |
| `transport.mjs:44–46,149–163` | 실험 전용 metadata에 thinking/effort와 실제 wire hash를 추가 기록한다. 기존 전체 usage의 `completion_tokens_details.reasoning_tokens`를 읽고 응답의 system_fingerprint를 있으면 기록한다. 누락은 null/미확인이지 0이 아니다. reasoning 본문은 평가 보고/UI/handoff에 출력하거나 다음 입력에 추가하지 않는다. |

실제 Cloud의 B/Q 동결 입력 runner·curl 접착 전체는 미제공이다. 이 문서는 없는 CLI 옵션이나 파일명을 만들어 즉시 실행 명령처럼 제시하지 않는다. Cloud가 해당 코드를 회수한 뒤 위 한정 diff 위치와 실제 timeout/취소 전파·raw 기록 순서를 확인해야 한다. SDK로 갈아타서 자동 retry가 생기는 경로도 사용하지 않는다.

공개 공식 예제의 `extra_body`는 SDK 인자다. 이 앱은 REST JSON을 직접 보내므로 `thinking`/`reasoning_effort`는 최상위 필드이며 wire JSON에 `extra_body`를 감싸 넣지 않는다.[D3][D6]

## 4. 한도·오류·보안은 별도 관측

60초는 로컬 provider timeout이며 공급자가 60초 안에 답한다는 약속이 아니다. 공식 비스트리밍 keep-alive 빈 줄도 전체 body/대기 시간에 포함될 수 있다.[D5] Cloud 전송 접착이 기존 15초 제한을 별도로 강제하는지 아직 모른다. abort를 무시하거나 더 짧은 hard timeout이 있으면 모드 비교에 앞서 실험 경로가 성립하지 않는다.

provider와 관측 clone 모두 reasoning+content+usage를 포함한 전체 응답에 131072바이트 상한을 적용한다. 큰 추론 응답이 이 한도에 걸리면 길이 실패/관측 잘림을 기록한다. 이를 모델의 의미 오류·빈 답 추론 부족으로 오판하거나 바디를 줄여 수용하지 않는다. input 128KB, response 128KB, 저장 8MB는 서로 다른 경계다.

HTTP/네트워크/timeout/length/바디 한도/계약/보호 오류가 나오면 기존 중단 원칙대로 중단하고 그 표본을 보존한다. 2반복이라는 이유로 해당 실패를 자동 재시도하지 않는다. 미실행은 미실행으로 남기며 cap을 채우려고 계속하지 않는다. 완전한 정상 응답의 의미 오류는 삭제하지 않고 사전 계획의 비교에 포함한다.

실행 설정과 response reasoning_tokens/존재 여부를 대조하되 ‘추론 흔적이 길다’는 품질 점수를 주지 않는다. 키·Authorization·키 일부·긴 reasoning은 보고서에 넣지 않는다. 보호 raw는 기존 접근 제한·redaction 아래 보존하고 평가에는 최종 8키와 해당 입력/상태/작업문만 쓴다. 앱이 실제 기준을 바꾸지 않았는지도 전후 비교한다.

## 5. 다음 판단

완전한 쌍만 의미 비교하되 실패·미실행 수를 별도로 모두 제시한다. 반환 model이 달라지거나 backend system_fingerprint가 쌍 사이에 바뀌면 동일 모델 조건의 인과 비교로 합치지 않는다. 지문이 미제공이면 불변 backend 확인이 안 됐다는 한계를 표시한다. 최소 진전 신호는 판정 가능한 명백한 문제 중 **서로 다른 2종 이상에서 A의 문제가 B의 두 사전 반복 모두에서 사라지고**, 성공 대조와 두 새 변형에서 새로운 모순·불필요 승인이 없을 때다. 실험 후 승격의 통계 기준이 아니라 다음 확인 방향의 사전 휴리스틱이다.

B만 일관되게 좋아지면 reasoning 설정을 후속 확인 우선으로 둔다. 둘 다 좋아지면 과거 대비 차이를 모드 효과라고 하지 않는다. 둘 다 같은 의미 실패를 보이면 입력의 작은 scope/unknowns 표현을 다음 후보로 검토하되 **이번 결과만으로 그 방법이나 두 단계 호출의 우월성을 확정하지 않는다.** 잘림/timeout/잘못된 설정이면 먼저 실험 한도/전송 병목을 보고하고 의미 비교 결론은 보류한다. Q03과 C02가 정당한 기존 범위 유지로 판정되면 평가를 정정하고 ‘모델 오류가 고쳐졌다’고 세지 않는다.

공식 근거 [D1]–[D6]은 OFFICIAL_EVIDENCE.md, 실제 코드 위치는 CODE_EVIDENCE.md에 있다.
