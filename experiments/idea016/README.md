# IDEA016 — continuity 실제 고객 흐름 첫 시험 도구

상태: **Cloud의 실제 baseline 회수 준비**. 기존 상품 UI·저장 형식·prompt·provider는 수정하지 않았다.
이 도구의 mock 결과는 도구 연결 검사이지 DeepSeek 품질 결과나 실제 사용자 조사 결과가 아니다.

## 정확히 무엇을 시험하는가

`app/continuity`를 대상으로 다음 기존 함수를 그대로 쓴다.

```text
실제 domain: setKind / editDraft / submit / recordBasis / editTask / answer(testOnly=true)
  → begin → buildRequest
  → 실제 localhost HTTP POST /api/continuity
  → createContinuityApp → validateRequest → callContinuity → buildBody (기존 prompt)
  → 기존 provider 파서 / validateAdvice
  → 실제 HTTP envelope → receive / validateEnvelope
  → 수동 편집(해당 시나리오에 있을 때만) → handoffText → 파일 기록 / markHandoff
```

앱의 client/app.ts 이벤트에 해당하는 domain 동작을 headless로 수행한다. 브라우저 클릭·DOM·실제
localStorage를 새로 검사하는 도구는 아니다. 단계 사이의 복구는 실제 serializeProject/parseProject/restore를
사용한다. “사흘 뒤” 등은 합성 시점 설명이며 실제로 며칠을 기다렸거나 입력의 at 시각을 조작하지 않는다.
고객 서비스의 코드 구현, 실사용자 관찰, 실행 결과 검증은 하지 않는다. report에 등장하는 통과 보고도 합성 주장이다.

live에서는 앱의 동일 provider가 서버 환경의 비밀을 사용해 요청한다. request/response의 관찰자는 기존
`fetchImpl` 주입 지점에만 붙는다. 원래 Response는 그대로 provider에 반환하고 복제 스트림에서 최대 128 KiB만
관찰한다. JSON 수리, 응답 교체, code fence 제거, 다른 prompt, 별도 정답 생성, 숨은 fallback은 없다.

mock에서는 **같은 provider 경로의 네트워크만 대역**으로 바꾼다. 실제 전송 본문에서 INPUT을 읽어 기존
`continuity/server/mock.mjs`의 규칙 응답을 사용한다. 외부 환경의 키는 읽지 않고 내부의 명시적 가짜 문자열만 쓴다.
이 때문에 내부 앱 envelope.mode는 provider 경로 선택값인 deepseek이지만, run/transport/보고서의 실제 시험 모드는
mock이며 realDispatches=0이다. 이 내부 mode를 실호출 증거로 해석하지 않는다.

## 작은 구성

- `cases.mjs`, `CASES.md`: 서로 다른 합성 서비스 6개, 각 2~3개 계획 단계와 허용 답변 값, 품질 관찰 기준.
- `engine.mjs`, `run.mjs`: 기존 앱 동작 호출, 회차별 기록, 실제 질문에 대한 명시적 답변 이어가기.
- `transport.mjs`, `report.mjs`: 실제 전송/응답 관찰과 읽기용 보고서. 새 의존성·가격 계산·승인 원장 없음.
- `tool.test.mjs`: 무상 도구 검증. 고객 효용 합격 숫자가 아니다.

과거 IDEA013/014의 **질문 원문과 후속 답변을 결속**하는 방식과 기존 검사 도구의 안전한 localhost 주입 지점을
참고했다. 과거 prompt·응답 계약·가격/승인/원장은 가져오거나 실행하지 않았다. 새 외부 라이브러리는 없다.

## 실행

Node 22.16.0 / npm 10.9.2 / TypeScript 5.8.3은 제공된 앱의 기준 버전이다.
빌드는 부모 앱의 공유 diagnostics를 포함해야 하므로 아래 두 build 모두 필요하다.

```sh
# 압축을 푼 한 최상위 폴더에서
cd source/app
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm run build
node continuity/scripts/check.mjs
node continuity/scripts/build.mjs
cd ..
mkdir -p ../runs

# 무상 검사: 호출 키를 빈 값으로 명시. 실제 외부 fetch도 테스트 내부에서 금지한다.
DEEPSEEK_API_KEY= ALLOW_PAID_AI=false node --test experiments/idea016/tool.test.mjs
DEEPSEEK_API_KEY= ALLOW_PAID_AI=false node experiments/idea016/run.mjs run --mode mock --out ../runs/mock-001

# Cloud: DEEPSEEK_API_KEY는 기존 안전한 서버 비밀 주입을 그대로 사용한다.
# 키를 명령문/파일/채팅에 쓰거나 env 전체를 출력하지 않는다.
AI_MODE=deepseek ALLOW_PAID_AI=true node experiments/idea016/run.mjs run --mode live --out ../runs/live-baseline-001
```

`ALLOW_PAID_AI`는 기존 서버의 실행 스위치다. 이번 유료 시험은 사용자가 이미 승인했으며 추가 승인 문서는 없다.
`DEEPSEEK_MODEL`, `AI_TIMEOUT_MS`, `AI_MAX_TOKENS` 등은 기존 Cloud 설정을 유지한다. 이 도구는 모델이나
max_tokens를 추천·보정하지 않는다. 지정하지 않았을 때의 값은 앱의 기존 readConfig를 따르며 run.json에
기록한다. 제공업체가 현재 그 설정을 받아들이는지는 **실제 응답으로 확인할 대상**이지 이 준비 작업의 보증이 아니다.

`--out`은 존재하지 않는 새 폴더여야 하고 부모 폴더는 미리 있어야 한다. 기존 결과 폴더에 덮어쓰지 않는다.
요청은 순차적이다. live에서는 앱의 기존 rate에 맞춰 **첫 전송 전에** 간격을 둔다. 실패 후 다시 보내는 재시도가 아니다.
각 사례 최대 3회, 전체 최대 18회다. 답변 후 재정리도 1회에 포함된다. 질문이 많으면 계획된 마지막 단계까지
못 갈 수 있고 budget-ended로 남긴다. 이 제한을 맞추려고 질문·응답을 지우거나 다음 예정 요청을 강제로 넣지 않는다.

## 실제 질문이 나왔을 때

첫 실행은 질문 없는 사례를 진행하고, 질문이 나온 사례는 `awaiting-answer`로 멈춘 채 다른 사례를 진행한다.
사례별 마지막 `turn-NN/pending-question.json`에 **실제 질문**과 시나리오의 허용 fact 목록이 있다.
`answer.template.json`에는 질문 원문·전체 질문 hash·caseId·turn이 자동으로 결속된다.

Cloud의 시험 운영자가 실제 질문을 읽고, 그 질문에 답할 수 있는 허용 factIds만 선택해 별도 답변 파일로 저장한다.
`relevance`에는 그 질문과 값의 관계를 짧게 적는다. 이것은 고객에게 추가 체크리스트를 시키는 제품 기능이 아니다.
사례 전체를 답변으로 붙이거나 예상했던 다른 질문의 답을 넣지 않는다. factIds는 최대 3개이고 disposition이 같은
값만 함께 선택할 수 있다. 본문 자유 입력이나 시나리오 밖 값은 받지 않는다. 맞는 값이 없으면 답을 만들어 내거나
자동으로 보류/모름 처리하지 말고 해당 사례를 미응답으로 둔다.

도구는 질문 일치·허용값·출처 형식을 검사한다. **질문과 선택한 fact의 의미적 관련성은 운영자가 판단한다.**
relevance가 적혀 있다고 자동으로 의미 검증됐다고 하지 않는다. 관련 없는 fact를 고르면 잘못된 시험이다.
합성 답은 실제 `answer(..., true)`로 들어가 `test_answer`가 된다. 새 confirmed/answered 기준을 만드는
실사용자 답변으로 위장하지 않는다. 자유 요청과 수동 편집은 격리된 합성 프로젝트 안에서 해당 UI 동작을 재현한다.

```sh
# source/에서 실행. 아래 파일은 실제 질문을 읽고 허용 factIds/relevance만 채운 복사본이다.
node experiments/idea016/run.mjs resume --run ../runs/live-baseline-001 --case C02 --answer ../runs/c02-answer.json
node experiments/idea016/run.mjs report --run ../runs/live-baseline-001
```

resume는 이미 반영된 질문 응답 다음 회차만 보낸다. 첫 요청을 다시 생성하지 않는다. 동일 baseline/runtime 설정만
허용하며 mode를 바꿀 수 없다. failed/inflight/complete를 resume해 재호출할 수 없다. 동시 resume는 로컬 lock으로
막는다. 중단 후 남은 lock은 확인 없이 삭제하지 않는다. 이 파일은 비용 승인·과금 원장이 아니다.

## 결과 읽는 순서

`REPORT.md` → `Cxx/report.md` → 각 `turn-NN/review.md` 순서로 읽는다. 회차 review.md에는 입력 동작,
실제 system/user 전송 본문, 원본 assistant content, 기준 위치, 최종 작업문이 함께 있다.

`request-app.json`은 buildRequest 결과이고 `request-provider.raw.json`은 provider가 실제 만든 본문이다.
`response-provider.raw.txt`와 `assistant.raw.txt`는 수정 전 응답, `response-app.raw.json`은 앱 API의 결과다.
`project-before/after-receive/after.json`, `project-final.json`으로 상태 반영과 수동값을 확인할 수 있다.
`handoff.md`와 `final-handoff.md`는 앱 handoffText 그대로다. AI 실패 때의 handoff는 원문/기본 안내일 수 있으며
성공적인 AI 출력으로 평가하지 않는다. `human-review.md`는 자동 판정 없는 짧은 관찰 메모이며 report 재생성으로 덮어쓰지 않는다.

### rev1 — 민감 반향의 실험 관측 경계

Authorization·환경 전체·응답 헤더는 저장하지 않는다. 실험 transport는 **파싱된 앱 응답을 receive 전에** 검사한다.
알려진 서버 키의 literal·JSON escaped·Unicode escaped(혼합 및 중첩 JSON의 backslash 표현 포함) 반향을 관찰하면
`EXPERIMENT_SECRET_ECHO`로 실패시키며 해당 응답을 receive에 전달하지 않는다. raw/assistant 쪽에서 확인된 반향도
동일하게 실패시킨다. 의미를 수정하거나 JSON을 수리해 통과시키지 않는다. 자동 재시도·mock fallback은 0이다.

`response-provider.raw.txt`, `response-app.raw.json`, `assistant.raw.txt`, 전송 메타데이터뿐 아니라 engine의
checkpoint·파생 프로젝트·handoff·회차/전체 보고서도 동일한 **키 결속 기록 함수**를 사용한다. 키 반향 전체를
`[REDACTED_API_KEY]`로 가리고 키의 앞/뒷부분이나 키 hash를 진단 증거로 기록하지 않는다. 정상 텍스트는 그대로 둔다.
실패한 응답의 작업문은 내보내기 완료로 표시하지 않으며 failed 상태로 배치를 중단한다. failed 사례의 resume도 거절한다.

`transport.json`의 실제 `httpStatus`와 `observationProtection`을 구별한다. 제품 API가 200으로 수용했어도
`parsedAppResponseEcho: true`, `blockedBeforeReceive: true`, `error: EXPERIMENT_SECRET_ECHO`일 수 있다.
**제품 원본 provider의 보안 수정을 의미하지 않는다.** 원본 169개는 그대로이며, 이 보호는 IDEA016 실험의 기록·반영 경계다.
보호 표시가 있는 raw 파일은 바이트 완전 원문이 아니다. provider의 `responseRedacted`는 외부 응답 기록의 치환 여부다.
`report` 단독 명령은 이미 보호된 저장 기록만 읽고 키를 구하지 않는다. 임의로 편집한 파일이나 보호 전 기록을
소급 정화하는 도구가 아니다. 이 작업은 모든 인코딩·분할 표현·기타 민감정보에 대한 전수 보안 감사가 아니다.

치환/잘림/시간초과가 있으면 원문 완전 보존으로 보고하지 않는다. 응답 크기 제한은 그대로이며,
부분 응답도 complete/truncated/readError와 함께 남긴다.

가짜 키 단일 회귀만 실행하는 명령(source/에서; 기존 mock 전용 fixture 준비 hook도 실행됨):

```sh
DEEPSEEK_API_KEY= ALLOW_PAID_AI=false node --test --test-name-pattern='IDEA016 rev1' experiments/idea016/tool.test.mjs
```

가짜 응답 원문은 메모리에만 구성한다. `IDEA016_REV1_EVIDENCE`를 존재하지 않는 새 폴더 경로로 지정하면 보호된
종단 기록과 값 없는 요약을 그 위치에 남긴다. 실제 키나 네트워크 제공업체 연결은 필요 없다.

## 특히 C06: 전송 전에 빠졌는가, 받고도 무시했는가

C06 D1은 긴 최초 요청의 **미수정 requested** 상태로 유지한다. 끝의 제약을 미리 confirmed로 승격시키거나 마지막 요청에
반복해서 주입하지 않는다. 실제 모델이 그 제약을 질문하면 허용 범위에서 답할 수 있지만, 이는 질문에 의해 복구된 별도
경로이며 처음부터 제약을 전달받았다는 증거가 아니다. 질문이 생겨 세 번째 계획 단계에 못 갔다면 그것도 미완료로 남긴다.

`context-trace.json`에서 localText 전문, sentText/partial, provider messages, previousWork, 응답과 handoff를 비교한다.
문자열 probe는 위치를 찾는 보조 수단일 뿐이다. 정확한 문장이 없어도 이전 AI의 재진술이 전송될 수 있으므로 **문자열 미출현만으로
모델이 못 받았다고 단정하지 않는다**. 실제 전송 문맥을 읽어 의미까지 없는 경우에만 전송 전 손실로 분류한다.
조건을 전달받았지만 응답에서 무시·반대 지시를 낸 경우는 모델 미반영이다. 원문이 handoff의 보존 기준에 있다는 사실과
상단 AI 작업문이 바로 쓸 만한지는 별개다. 충돌하는 문서를 사용자가 다시 정리해야 하면 고객 수고로 기록한다.

품질은 첫 유용한 작업문, 중요한 모호함의 처리, 조건/수동값/결과의 연속성, 사용자에게 남긴 수정 부담으로 관찰한다.
질문 수, JSON 통과, 도구 테스트 수, relatedBasisIds 길이만으로 합격을 정하지 않는다.
R5의 낡은 AI 제외·수동값 유지, v1 원본 보존, 8 MB 저장 복구, 128 KiB AI 한도는 기존 코드 그대로다.
