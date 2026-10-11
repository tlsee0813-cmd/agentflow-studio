# INIT-007B — 고정 고객 대화 평가의 real 연결 준비

상태: 구현/무상 자체검증 제출. 독립 리뷰, 기존 Cloud의 실제 실행, 실제 모델 품질 평가는 별개다.
제품 요구는 v2를 유지한다. INIT007A의 65파일 기준에서 이어 쓰며, 제품 수정은
`server/app.mjs`의 optional `onTelemetry` 인자 및 provider 전달 2줄뿐이다.
A의 evaluator/fixtures, UI, mock, prompt, 응답 계약, 상태 함수, INIT005/006 스크립트는 바꾸지 않는다.

## 범위와 실행 경로

실험 목적 `INIT007-KO-DIALOGUE`, run ID `INIT007-KO-20261011-01`을 상수로 고정했다.
6 persona × 1/2차의 12개 슬롯만 있다. 첫 질문이 없거나 첫 응답이 거절되면 해당 후속 슬롯은 skipped다.
의미가 맞지 않는 질문에 고정 사실만으로 답할 수 없으면 작업자는 명시적 skip을 선택한다.
추가 사례, 질문 주입, 자동 유료 응답자 모델, 새 run ID로 수를 채우는 기능은 없다.

`firsts` → 실제 앱 HTTP `/api/interview` → 기존 `callDeepSeek` → 기존 curl-proxy → 승인된 api.deepseek.com.
`followups`는 같은 경로를 쓰지만, 저장한 첫 응답의 Project/질문/출처/버전 및 답변 digest를 사용한다.
직접 raw curl AI 호출로 앱을 우회하지 않는다. 앱 limiter도 실제로 통과한다.

실행값: concurrency 1, retry 0, provider/curl timeout 15초, output 4096, 실제 요청 body ≤32KiB.
로컬 HTTP 클라이언트는 provider의 15초 결과/진단 회수를 위해 17초까지 기다리며 upstream 15초를 늘리지 않는다.
실험 설정만 4096이며 제품 `readConfig` 기본 2048은 그대로다. 앱의 6/min, process 20도 유지한다.
원장은 추가로 시작 간격 ≥12초와 **영속 rolling 6/60초** 및 전체 12슬롯을 검사한다.
`Date.now()`가 마지막 dispatch/완료 시각보다 뒤로 돌아가면 중단한다. 새 프로세스에서도 영속 시각을 읽는다.
dispatch 기록 뒤의 fsync 지연으로 실제 전송 간격이 짧아지지 않도록, 완료된 요청은 완료 시각 +12초도 다음 전송의 보수적 하한으로 쓴다.
이는 시작 간격 ≥12초보다 엄격할 수 있으며, 느린 요청에서 12초마다 정확히 호출한다고 주장하지 않는다.

## 원장·잠금·영속성

live는 `/workspace/validation/init007b/live/INIT007-KO-20261011-01` 한 경로뿐이다.
명령에 out/id/limit/reset/retry/URL/키/transport override 옵션은 없다. plan/mock은 live 경로를 만들지 않는다.
승인된 Cloud 실행에서 환경·검토 해시·가격/지원 확인·preflight·기존 자료 확인이 모두 통과한 뒤에만 만든다.

`journal/000001.json...`은 append-only이며 sequence, 이전 hash, 현재 hash를 연결한다.
원장에는 고정 ID, slot metadata, digest, 버전, 안전 진단, 비용/시각만 기록한다. 입력 내용은 run 정체성을 결정하지 못한다.
원문을 담는 검증된 합성 session은 별도 `sessions/pXX-000NNN.json`에 불변 revision으로 저장한다.
원장 참조에 파일 digest, 상태 hash, 버전, 실제 첫 질문 hash를 둔다. 모든 참조된 과거 revision도 읽을 때 검사한다.
추가 저장 승인 직전에도 디스크 원장/상태를 다시 대조한다. 부분 JSON, 누락, 순서/지문 변경은 fail closed다.

각 파일을 exclusive create → file fsync → 부모 directory fsync 순서로 기록한다.
새 부모 디렉터리도 상위 디렉터리에 fsync한다. 상태 revision과 **예약** 기록이 끝나기 전에는 로컬 HTTP도 보내지 않는다.
provider fetch 직전 별도의 **dispatch** 기록을 fsync한 후에만 기존 curl transport를 호출한다.
저장 실패 시 upstream send 0이며, 저장 성공 여부가 불명확하면 잠금을 보존한다.

`active.lock`은 같은 고정 디렉터리의 경쟁 프로세스를 막는다. 정상 종료 때만 제거한다.
프로세스 중단은 잠금을 남긴다. stale lock 자동 takeover/삭제/재시도는 없다.
잠금을 임의로 삭제하거나 원장 뒤를 잘라 resume하지 않는다. 시작된 미완료 단계도 명시적으로 거절한다.
**dispatch 전 예약조차 자동 반환하지 않는다.** 성공/실패/계약 거절/timeout의 슬롯과 예약 비용도 회수하지 않는다.
완료 단계 재실행은 generation 0 no-op, 중단·손상된 단계는 generation 0 거절이다.

이는 Linux 로컬 파일시스템의 fsync 기반 경계다. 악의적인 관리자/디스크 전체 rollback에 대한 외부 서명 원장이나
여러 작업공간 전체의 분산 잠금을 주장하지 않는다. 총괄이 이 ID를 한 Cloud 세션에만 배정한다.
Windows에서 file fsync는 사용하나 directory fsync와 live 실행을 승인하지 않는다. 현재 live CLI는 Linux만 받는다.

## 두 단계와 입력 교정

1차는 첫 6개만 순차 실행하고 상태/실제 질문/원문 출처를 남기고 종료한다.
작업자는 `--questions`, `--collect`로 **실제로 저장된 질문**과 persona facts를 읽고 `--answer-template`의 JSON을 작성한다.
템플릿은 답을 채우지 않는다. 해시만 맞았다고 사실에 맞는 답변인지 증명되지는 않으며 의미 충실성은 human_review_pending이다.

answers 문서에는 purpose/run/source/runtime/fixture hash, 각 persona의 firstStateHash/firstQuestionHash,
A의 answerDocument, 필요 시 resolutionActions가 있다. 추가 persona/필드/가짜 문맥은 거절한다.
A의 submitAnswers로 전체 문서를 먼저 검증하고 상태 변경을 메모리에서 시험한다. 모두 성공한 뒤에만 저장/dispatch한다.
문법 오류나 1501자 오류는 입력 파일을 지우거나 원문을 로그에 남기지 않고 고정 오류와 digest만 남긴다.
미호출 followup 단계에서 수정할 수 있다. 이미 호출한 슬롯의 답을 고쳐 재생성하는 경로는 없다.

A의 unknown→deferred, 긴 답변→수정은 `answerDocument.answers`의 최대 3개 행으로 지원한다.
충돌에는 `preview(requirementId, apply|keep)`, `cancel`, 다시 `preview`, `confirm`을 resolutionActions에 명시한다.
공통 함수의 버전/잠금/출처/원자적 완료 조건 처리를 그대로 사용한다. 미확정 preview가 남으면 전송하지 않는다.
이 명령열은 같은 지속 Project의 합성 작업자 행동이며, 새 대화나 실제 고객 승인이 아니다.

후속 출력까지 읽은 뒤 `--items-template` → `--review-items`로 실제 항목 ID/status를 명시한다.
이는 추가 생성 없는 회수 단계다. 항목 확인을 AI가 자동으로 채우지 않으며 quality 합격으로 바꾸지 않는다.
항목 결정도 현재 ledger head와 state hash에 묶인다. 동일 결정 재기록은 no-op, 다른 결정으로 덮어쓰기는 거절한다.

## 중단 분류 (실제 코드 기준)

| 조건 | 처리 |
|---|---|
| upstream HTTP 200, 정확한 model, 유효한 usage, finish stop이고 응답 계약만 거절 | 해당 case failed, 후속 skip. 다음 **원래 예정된** 독립 첫 case 허용 |
| 위 조건을 만족한 content_parse / result_contract / state_contract 및 provider_envelope 계약 오류 | 같은 case 정책. 고정 INIT006 diagnostic만 보존 |
| 인증, 잔액, upstream/local 429, network, timeout, missing/다른 model, usage 누락·불일치, finish 잘림 | 전체 batch halt, 슬롯 재호출 없음 |
| 원장/저장/상태 hash, state_guard/state_apply 불변식, body/예약/전체 예산, 시계, legacy/code/review 경계 실패 | 전체 중단 또는 dispatch 전 gate 거절. 저장 불확실 시 잠금 보존 |

HTTP 계층의 502 INVALID_RESPONSE와 upstream의 200은 구별해 기록한다.
raw 오류/거절 원문/response headers/provider reasoning을 출력·저장하지 않는다.
안전 telemetry는 allowlist로 재구성한다. 알 수 없는 model 문자열은 저장하지 않고 missing/different로 표현한다.
검증된 응답에서도 알려진 credential/일반적인 secret 형태가 발견되면 원문 보존 없이 중단한다.

## 가격·검토·기존 자료

`SNAPSHOT`은 INIT006 과거 가격(USD/M: input miss 0.30, hit 0.006, output 1.20)이다.
2026-10-11 이 구현 작업의 공식 검색 반환 내용에서도 같은 가격과 deepseek-flash/JSON/비사고 모드 지원을 확인했다.
그러나 이것은 Cloud 실행 당일 재확인이나 계정 청구액 확인을 대신하지 않는다.

공식 확인 경로:
- https://api-docs.deepseek.com/quick_start/pricing/
- https://api-docs.deepseek.com/api/create-chat-completion/
- https://api-docs.deepseek.com/guides/json_mode/

review.json의 가격/지원 확인 시각은 정확한 UTC millisecond ISO 형식이며 미래/24시간 초과/잘못된 날짜를 거절한다.
정확한 source/runtime/fixture/schema/node, 지원값, body/입력 engineering reserve, 총괄 검토 참조 hash,
그리고 총괄이 전달한 **review JSON의 compact JSON.stringify SHA256**와 일치해야 한다.
프로그램은 이 기록의 구조·신선도·hash를 검사한다. 사람이 공식 페이지를 실제로 읽었는지나 Network-secret 설정의 진위를
hash만으로 증명한다고 주장하지 않는다. 실제 확인/배정은 총괄과 기존 Cloud의 책임이다.

입력 ≤32KiB에 40,000 input token을 예약한다. tokenizer 증명이나 계정 청구 강제 상한이 아닌 검토된 engineering reserve다.
매번 **실제 buildDeepSeekBody**의 bytes/hash와 요청을 검사하고, provider로 넘어가는 body hash를 다시 비교한다.
예시 예약은 $0.0169152/회, 12회 $0.2029824. 설계 예산 $0.25를 integer nano-USD로 검사한다.
확인된 새 가격이 12회 예약에 충분하지 않으면 거절하며 budget override는 없다.
관측한 유효 usage는 cache 할인을 적용하지 않은 보수 추정으로 기록한다. 실패/잘림에서도 측정 가능한 usage는 보존하되
예약을 반환하지 않는다. 실청구액은 항상 null이다.

review hash는 한 run 동안 고정이다. 두 단계가 24시간을 넘겨 새 review가 필요해졌다면 기존 ID를 다른 hash로
몰래 이어 가지 않는다. 차단 상태와 미발생 분기를 회수하고 총괄에게 전달한다.
preflight는 기존 validatePreflight를 재사용하며 별도 keyless 확인(24시간 이내)이 필요하다.
이는 인증/잔액/Network-secret 치환 증명이 아니다.

legacy는 **읽기 전용** `/workspace/validation/init006/source`다. 제공된 A 소스에서 유래한 57개 INIT006 파일 hash와
`eval-results/init005-live/{run.lock,report.json}` 및 `eval-results/init006-c2-diagnostic/{run.lock,report.json}`을 포함한
해당 두 디렉터리의 파일 hash를 확인한다. 없으면 만들지 않는다. Pro에서 실제 Cloud의 이 파일들을 읽었다고 주장하지 않는다.
기존 ZIP을 찾아 복원하거나 수정하지 않는다. unit test의 `syntheticLegacyFixture`는 /tmp에서 명시적으로 만든 모의 자료이며 real 자료가 아니다.

## 파일 책임 및 추적

| 요구 ID | 구현 | 확인 경계 |
|---|---|---|
| I7B-R01 | http.mjs + app의 optional hook | 실제 loopback HTTP, 기존 provider adapter, mock upstream; real 연결은 Cloud 대기 |
| I7B-R02 | ledger.mjs | fixed slots, reserve/dispatch fsync, 경쟁/중단/손상/중복 차단 |
| I7B-R03 | engine.mjs + A 공통 함수 | 같은 first state/질문/hash, 답변 교정, unknown/deferred, preview/취소/확인 |
| I7B-R04 | policy.mjs | body/reserve, $0.25, 가격/지원/review/preflight/code/legacy, 영속 rate |
| I7B-R05 | engine.mjs / policy.mjs | 조건부 case failure와 global halt 분리 |
| I7B-R06 | report.mjs | 검증된 SYNTHETIC 증거, 사람 품질 대기, 실제 항목 결정 |
| I7B-R07 | run.mjs | 닫힌 CLI, 기본 plan/무상 mock, 고정 live 경로, 안전 회수 |

새 의존성은 없다. 테스트는 `eval-init007b.test.mjs`의 transport/clock/legacy doubles와
`http-init007b.test.mjs`의 실제 로컬 HTTP를 구분한다. Pro의 실행 로그/판정은 ZIP 최상위 README와 verification을 따른다.
전체 178/parity/browser/A의 11 HTTP를 이번 작업의 검증으로 재실행하거나 전용하지 않는다.
p02의 기존 mock 내용 모순은 수정하지 않았으며 합성 보고서에도 그대로 남는다.
실행 명령과 인계 절차는 CLOUD_RUN.md에 있다.
