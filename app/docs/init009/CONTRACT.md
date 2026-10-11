# INIT009 — 고정된 두 사례 프롬프트 재평가 계약

상태: 구현자 검토 제출용. 실제 모델 효과·내용 품질·실제 고객 승인은 미검증이다. INIT008의 기존 19개 검사와 Windows/Cloud 수용은 제품 기준선의 과거 무상 검증이며 이번 재평가의 품질 합격이 아니다. 기존 p01의 정확한 거절 ID와 원인은 여전히 미상이다.

## 범위와 식별자

**I9-01 / 고정 실험.** purpose `INIT009-PROMPT-QUALITY-REEVALUATION`, run `INIT009-KO-20261011-01`. 슬롯은 순서대로 `p01-1`, `p03-1`, `p01-2`, `p03-2`뿐이다. 첫 요청 두 개, 각 후속 최대 한 개. 기존 005/006 실제 3회와 007 실제 8회, 합계 11회는 새로운 호출 가능 잔량이 아니다. 새로운 원장으로 새 제품 prompt 기준을 관찰하며 기존 실패 요청을 재시도하지 않는다.

제품 prompt/UI/validator/adapter/domain 및 기존 source87은 수정하지 않는다. `fixtures/init009/init008-source.sha256`는 수용된 원본 87개 파일을 고정한다. 원본 INIT008 source fingerprint는 `fb30a9207a2c9a7d94bc74b30a2247498e68843a489b6d9c384a5a584a641423`, runtime fingerprint는 `546bd875c4556613aebb97c800bc1bd4a2e3e52870c62c73f691b2c1895a8224`이다. 현재 추가된 평가 도구까지 포함한 source fingerprint는 ZIP 루트 `IDENTITY.json`에서 확인한다.

**I9-02 / 사례와 답변.** `fixtures/init009/experiment.json`의 persona 객체 두 개는 기존 INIT007A p01/p03의 사실·도구 선택·미정 정보를 그대로 사용한다. 새 프로젝트와 출처는 `createSession → createProject/editBrief → beginRequest`의 실제 상태 함수로 생성한다. 과거 질문·AnswerID·SourceID·envelope를 복사하지 않는다.

p01은 실제 질문 topic이 `core-scene`이고 기록/재확인 사실에 의미상 맞는 질문이라고 총괄이 검토한 경우에만 F-core 원문을 직접 답변한다. 옵션 ID를 추측하지 않고 `optionId:null`로 원문을 보존한다. 누가/언제/습관은 추가하지 않는다. p03은 실제 첫 질문이 `storage`일 때에만 F-unknown 원문을 `unknown`으로 제출하고 F-defer 원문을 `deferred`로 수정한다. 같은 AnswerID와 두 출처를 보존하고 최종 수정 상태로 한 번만 후속 요청한다. 다른 질문이나 질문 없음은 skip/unevaluated이며 횟수를 채우지 않는다.

**I9-03 / 실제 질문 뒤 검토.** firsts는 실제 createApp localhost HTTP → 제품 adapter → real provider 경로를 사용하도록 준비했다. Pro 검사는 명시적 mock upstream만 사용한다. 질문/선택/효과/권고/요구상태는 검증된 응답에서만 회수한다. 제품 adapter는 storage 질문을 표준 문구로 정규화하므로 회수 결과는 앱이 실제 제공하는 질문이지 필터 없는 provider 원문이 아니다. 답변 초안의 `questionFactMatchReviewed` 기본값은 false다. 총괄의 의미 검토와 단계 review hash 없이 후속 live 호출은 열리지 않는다.

## 원장과 gate

**I9-04 / 단일 durable 원장.** live 경로는 `/workspace/validation/init009/live/INIT009-KO-20261011-01`, control 경로는 `/workspace/validation/init009/control/INIT009-KO-20261011-01`로 고정한다. 경로/run/슬롯/URL/재시도/reset 옵션은 없다. append-only hash chain, 배타적 lock, 상태·예약·dispatch의 파일 fsync 및 디렉터리 fsync를 사용한다. reservation과 dispatch 기록이 영속화되기 전에는 upstream을 호출하지 않는다. 저장 불확실성·손상·전역 halt·진행 중 예약은 lock을 남긴다. stale lock 인수/자동 복구/예약 환불은 없다. 완료 단계 중복은 transport 생성도 없는 generation-zero no-op이다. 이 잠금은 동일 Cloud 파일시스템의 로컬 잠금이며 분산 워크스페이스/계정 전체 잠금이 아니다.

**I9-05 / 사전 본문 고정.** generation-free prepare에서 실제 상태 함수로 request/state/source/answer ID와 최종 provider body를 고정하고 stage plan을 write-once로 저장한다. 검토 후 `beginRequest`나 답변 제출을 다시 실행하여 새 ID의 본문을 보내지 않는다. 검증 과정은 순수 상태 전이를 재계산한 뒤 일시적인 새 ID를 검토된 ID와 대응하여 동등성을 비교할 뿐, plan·body·gate를 수정하지 않는다.

source/runtime/fixture/원본 기준선/단계 plan/review/state/question/answers/최종 body hash가 결합된다. 후속 plan은 firsts 원장 head와 첫 질문·상태 hash, 답변 문서 hash에 묶인다. 현재 코드나 본문이 바뀌면 옛 gate를 자동 갱신하지 않고 거절한다. UTC 밀리초 정규 형식, 유한한 현재 시각·경과 시간, 미래 거절, 최대 24시간을 review·공식 가격·지원·preflight·legacy inventory에 같은 방식으로 적용한다.

**I9-06 / 실행 한도.** 최종 request와 provider body 각각 최대 32KiB, 입력 예약 40,000 tokens, 출력 4,096 tokens, provider timeout 15초, 직렬 동시 1, dispatch 간 최소 12초, rolling 6회/분, 제품 process cap 20, 자동 retry 0이다. 제품 기본 출력 2,048은 바뀌지 않는다. 4슬롯의 최신 입력 cache-miss/출력 단가 기준 예약 합계가 USD0.12 이하이어야 하고, 후속 단계는 이미 소비한 예약과도 합산한다. 예약은 실제 사용량이 작거나 실패해도 반환하지 않는다. USD0.12는 평가 도구의 공학적 예산이며 계정 청구 hard cap이 아니다.

## Cloud가 준비할 실제 근거

**I9-07 / 닫힌 live 준비 상태.** 실제 가격과 지원 여부는 이 작업에서 조회하지 않았다. 가격 기본값은 null이며 옛 가격/토큰/잔액을 live에 재사용하지 않는다. `MOCK_PRICES`는 명시적인 합성 검사 숫자일 뿐 공식 단가가 아니다. 현재 가격·지원이 미상인 배포 ZIP만으로는 live gate가 열리지 않는다.

Cloud는 총괄의 기존 실행·비용 허용 범위 안에서 다음 근거를 준비하고 총괄에게 검토받는다. 새로운 사용자 키/비용 재승인 질문을 요구하는 절차가 아니다.

- `price.json`, `support.json`, `official-price.txt`, `official-support.txt`: 실제 본문 설정과 맞는 공식 문서 캡처, 확인 시각, 파일 hash, 단가/지원 정보. 파일 존재·출처 URL·hash·24시간을 검사한다. 캡처 내용이 정말 공식 정보인지의 사실 확인은 총괄 검토 책임이며 도구가 독립적으로 웹 인증했다고 주장하지 않는다.
- `preflight.json`: 기존 keyless 외부 probe의 안전한 결과. UTC/Node22.16/curl-proxy/models endpoint/인증 미전송/generation0/HTTP200 또는 401을 검사한다. 연결 검사는 인증 성공 증거가 아니다.
- `legacy.json`: 기존 source/005·006 원장 및 lock/report/007 source/live/control/report 전체의 읽기 전용 inventory. 실제 경로·정렬된 파일 hash를 고정한다. 알려진 기존 evidence/live/control 경로는 코드에 고정되며 source/report의 읽기 전용 위치를 검토된 inventory에 기록한다. 필수 role은 `evidenceTemplates().legacyRequiredRoles`에 있다. `.env`, 키, 비밀, rejected raw를 수집하지 않는다.

`legacy.originalINIT007`에는 기존 purpose/run/source/runtime/fixture/review hash/ledger head/dispatches8을 **실제 원본에서** 기록한다. 원래 B의 read-only codeIdentity/readLedger로 기존 source·runtime·review·ledger 정체성을 서로 대조한다. INIT008/INIT009 지문으로 옛 gate를 바꾸지 않는다. old CLI나 stage를 실행하거나 옛 lock을 인수하지 않는다. 기존 실제 파일이 없는 Pro 환경에서 이것을 가짜 과거 기록으로 만들어 통과시키지 않는다.

첫/후속 단계 각각 `firsts-review.json` / `followups-review.json`은 plan, 현행 자료, 예약, 총괄 검토 참조를 묶는다. 환경의 `AFS_INIT009_REVIEW_SHA256`은 그 단계 문서의 검토된 hash여야 한다. `ALLOW_PAID_AI=true`, 고정 assignment, `AFS_INIT009_APPROVED_USD=0.12`, `AFS_INIT009_CREDENTIAL=network-secret`는 기존 Cloud에서만 설정한다. 실제 credential을 읽기 전에 keyless gate를 확인한다. 기존 Network-secret `DEEPSEEK_API_KEY`와 `api.deepseek.com` 범위만 사용한다. Pro는 실제 키 읽기/등록/전송과 유료 호출을 하지 않는다.

## 실패와 관측

**I9-08 / 제한된 실패 계속.** INVALID_RESPONSE의 안전 진단이 `result_contract / result.proposals[].sourceIds[] / known_source`이고 provider HTTP200, expected model, finish stop, 온전한 token/cache usage가 함께 확인된 경우만 case failure로 보존하고 뒤의 독립 사례를 진행한다. 그 사례의 후속은 skip한다. 다른 JSON 오류, auth/balance/429/network/timeout/model/finish/usage/예산·소스·원장·저장 불확실성은 전체 halt다. 거절 raw/reasoning/header/키는 저장하지 않는다. 안전 고정 코드·진단·usage metadata만 남긴다.

**I9-09 / 보고와 항목 기록.** `collect`는 실제 검증 envelope, 첫/답변 후/후속 후 요구·완료조건, 답변·수정 원문과 출처, p03의 AnswerID/두 출처/deferred/TBD/Claude-only/기존 도구 요구 보존을 보여준다. `decisionSummary`와 `requirementOriginLabel`을 그대로 사용한 현재 구조화 결정 view와 비권위 AI 해석을 함께 제공한다. AI 원문은 UI 기본 접힘이며 현재 결정이 아니다. 출처 ID 존재와 의미상 근거, 답변이 제안 요구와 완료조건에 반영됐는지는 별도이고 내용 판정은 pending이다.

항목 기록은 별도 `items.json`, 총괄 검토 참조·현재 시각·원장/state hash·`AFS_INIT009_ITEMS_SHA256`를 요구한다. generation-free 합성 운영자 결정이며 실제 고객 승인이나 내용 품질 합격으로 표시하지 않는다. mock/모델 자기평가/프로토콜 PASS로 human content quality를 올리는 기능은 없다.

## 재사용과 변경 경계

기존 A의 세션 생성·답변 원문/수정·항목 상태 함수와 B의 hash/안전 IO/예약 본문/설정/telemetry/12초·rolling rate 계산을 직접 재사용한다. 실험 상수가 내부에 묶인 B 원장·stage/HTTP 경계는 INIT009에 한정하여 좁게 복사·적용했다. 공통 모듈 추출이나 기존 파일 수정은 0개다. 특히 기존 B의 12슬롯/예산/보다 넓은 case-failure 정책은 그대로이며 INIT009에 전파하지 않았다. 모든 실험을 무제한 parameter화하는 framework나 새 의존성을 추가하지 않았다.

실제 실행 검증 결과는 ZIP 루트 `verification/RESULTS.json`을 본다. 전체178/parity/wholeUI/옛 실험 CLI와 12초 전 구간 wall-clock 재검증은 이번 범위가 아니다. 독립검토와 실제 Cloud live 배정은 총괄 대기 상태다.
