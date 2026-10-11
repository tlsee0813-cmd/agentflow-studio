# INIT-008 최소 변경 계약 — 수용 전 검토안

## 기준과 수정 범위

FULLSOURCE 77파일의 원본 source manifest SHA256은
`72e4e3bc12960c59fc11732424220ec80f026a1edd43aacedac56c6baaf14732`, runtime은
`47665d31adbec5cf2c0b4cad24597a09e5fbe159f03a5e2798893b89cae10322`다.
정확한 입력 source/에서 이어서 수정했다. 원격 head는 재조회하지 않았으며 입력에 기록된
`4caa0914d4520c76cdd0380bbb1a3c1941ab0451`을 원격 변경 증거로 갱신하지 않는다.

요구 추적: I8-R1 출처 거절 가능성 감소/엄격성 유지, I8-R2 현재 상태와 요약 일치,
I8-R3 관찰된 작은 질문·옵션 표현 개선, I8-R4 ID/출처/수동값/기존 입력·오류 보호.

## I8-R1: prompt-only provenance guidance, ID 계약 유지

`server/prompt.mjs`에 순수 `sourceReferenceGuide(request)`를 추가한다. 현재 요청의
projectId/baseVersion/requestId, 정확한 allowedSourceIds, source kind/수집 버전,
현재 answerId→sourceId/topic/disposition만 안내한다. 원문은 기존 user-role INPUT JSON에만 있다.
안내 표의 사용자 문자열은 기존 validated ID·enum·숫자뿐이며 source text를 system 역할로 승격하지 않는다.

`answers[].id`, questionId, requirementId, proposal key를 출처로 오인하지 않도록 하고,
현재 답변의 sourceId와 이전 답변 이력을 구별한다. 예제의 가짜 `existing-source-id` 대신
현재 입력에 존재하는 ID 하나로 문법을 보인다. 이것은 근거 추천/자동 할당이 아니며
실제 관련 source.text를 읽고 선택하라고 명시한다. 근거 없는 proposal은 생략하고 미정으로 남긴다.
AI 요약은 이전 해석이지 고객 승인 근거가 아님을 명시한다.

**별칭/서버 역매핑/새 참조 구조를 도입하지 않았다.** RequestPayload, AiResult, schemaVersion0.1.1,
Provider 메시지 수와 INPUT JSON, validateResult의 known_source와 각 길이·ID·버전 검사 모두 그대로다.
검증된 Request에서만 안내를 만들며 전역 cache/다른 요청의 표를 쓰지 않는다. 모르는 ID를 고치거나
기존 출처로 대체하지 않는다. 성공/실패의 변환·재시도·fallback·원문 수집도 없다.
기존의 프로젝트/버전/requestId 응답 비교와 상태 guard는 그대로다. 서버가 없는 다중 계정
프로젝트 소유권 인증을 새로 구현했다는 의미는 아니다.

선택 이유: 거절 원인이 미상인 상태에서 alias 해석 계층·마이그레이션까지 늘리기보다,
현재 엄격한 계약을 유지하며 명확한 근거 안내부터 시험한다. 이 변경만으로 실AI 거절이
사라진다는 보장은 없다. 재발하면 동일 안전 진단으로 남기고 좁은 후속 설계를 검토한다.

## I8-R2: AI 자유 요약과 현재 결정 요약 분리

`src/shared/presentation.ts`의 decisionSummary는 현재 requirements의 status/needsReview에서
그룹·개수를 매 render마다 계산한다. 같은 Requirement 객체로 항목을 그리므로 보류가 확정
그룹에 들어가지 않는다. 원문 문장에서 status를 추론/교정하지 않는다. 확인·보류·수정 뒤에도
생성 요청 없이 현재 상태를 반영한다. 출처 종류와 확인 상태도 별도 라벨로 표시한다.

`src/client/app.ts`는 이 현재 결정 요약을 먼저 보여준다. 기존 자유 요약은 기본 접힌
‘AI 해석 원문 · 현재 결정 아님’에 보존하고, 현재 요구와 다를 수 있다고 명시한다.
Project.summary와 ai-response Source.text는 작성 당시 원문으로 유지한다. 접힌 원문에는
과거 부정확한 표현이 남을 수 있으며 이를 현행 결정으로 표시하지 않는다. 원문이 틀렸다고
재작성하거나 숨은 교정본을 고객 원문으로 기록하지 않는다.

본문·완료 조건·status·lock·priority·needsReview·sourceIds/Source.text·Answer.id·version은
표시 함수가 변경하지 않는다. 기존 domain/validation/provider adapter는 byte-unchanged다.
요청/응답 wire 계약과 저장 schema 변경, 기존 상태 migration은 **없다**. UI 소비자는
Project.summary를 현재 결정 권위로 사용하지 않고 이 파생 뷰/requirements를 사용해야 한다.
기존 INIT007 report의 state.summary는 역사적 AI 해석으로 읽어야 하며 보고서/원장은 수정하지 않는다.

## I8-R3/4와 이행 경계

prompt의 작은 보완: 알려진 핵심 행동의 proposed 초안을 먼저 작성, 선택지 중첩 줄이기,
측정 없는 속도/비용과 미지원 추가 질문 약속 금지, 사용자 수/기기 수 분리.
질문 최대1/후속 후 question=null,2–4옵션,수동 응답/unknown/defer와 선택 효과의 기존 계약은 유지한다.
현재 고객 선호를 새 확정 요구나 전체 고객의 선호로 일반화하지 않는다.

새 source/runtime/body 지문으로 별도 독립 검토가 필요하다. INIT007 고정 원장·run·승인 파일은
이 새 코드로 재개/재시도하지 않는다. 기존 policy의 hash gate를 바꾸거나 fixture의 예전
INIT006 hashes를 새 코드에 맞춰 덮어쓰지 않는다. 후속 실AI는 총괄이 기존 Cloud에 별도 좁은
실험으로 배정하고 별도의 새 기준과 기록 경로를 정해야 한다. Pro에서 유료 호출·키 접근·원격
쓰기·배포를 하지 않는다. 고객의 기존 Cloud 비용 허용을 다시 물을 이유도 없다.
