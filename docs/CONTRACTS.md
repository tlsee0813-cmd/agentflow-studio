# 공통 계약 0.1.1 — 입력·질문·요약에 한정

타입 src/shared/contracts.ts, 검증 validation.ts, 상태 전이 project.ts.
Task/Graph/Export 등 미래 전체 데이터는 설계하거나 고정하지 않는다.

## 데이터와 상태

Project.schemaVersion은 구조 버전, version은 입력·답변·확인·응답 적용에 증가하는 버전이다.
Source는 안정 ID, customer-input/customer-answer/ai-response/mock-response/customer-confirmation,
원문과 수집 버전을 보유한다. AI 응답 출처는 요약 부분이며 reasoning_content를 보관하지 않는다.
Answer는 questionId/topic/sourceId와 원문·answered/unknown/deferred를 구분한다.
Requirement는 안정 ID, scope=user-project, topic/kind, text/acceptance, priority, status,
origin, sourceIds, version, locked, needsReview를 보유한다.
status는 proposed/confirmed/deferred/rejected. AI는 confirmed를 지정할 수 없다.
Suggestion은 proposed이며 문제·효과·core/future를 가진다. 요구로 자동 승인하지 않는다.

입력 출처 중복 방지와 현재 도구 적용은 별개다. REQ-tools ID를 유지하고 출처를 재사용·누적한다.
Codex→Claude→Codex에도 현재 값을 적용한다. 미정으로 되돌리면 deferred다.
잠금 때문에 적용할 수 없으면 Project.conflicts에 requirementId/topic/expectedText/sourceId를
보관하고 현재 선택과 잠금 요구의 차이를 표시한다. 단순 확인으로 충돌을 숨기지 않는다.

## 요청과 응답

GET /api/config는 mode/configured/paidEnabled/scope만 반환한다. 키를 노출하지 않는다.
POST /api/interview는 로컬 same-origin, JSON, X-AgentFlow-Request:1이 필요하다. 최대32KiB 바이트.
RequestPayload: schemaVersion/projectId/baseVersion/requestId/stage/brief/sources/answers/requirements.
discover는 질문0~1개, summarize는 question=null. 이미 정한 도구는 재질문하지 않는다.
응답 Envelope: mode=mock|deepseek, result=AiResult.
AiResult는 동일 projectId/baseVersion/requestId와 summary/question/proposals/ideas/openItems다.
키·길이·배열·출처 참조·버전·중복 ID/key를 검증한 뒤 원자적으로 반영한다.
proposals<=8, ideas<=3, openItems<=8, 전체 sources<=40, requirements<=24, answers<=8.
요구 sourceIds 상한은 보존할 수 있는 전체 출처 상한과 동일한40이다.

## 초안 갱신과 보호

동일 key/topic/kind 요구가 proposed+unlocked이면 새 해석으로 text/acceptance를 갱신할 수 있다.
ID·기존 출처를 유지하고 새 답변·응답 출처와 version을 연결하며 proposed 상태를 유지한다.
confirmed/locked/deferred/rejected 또는 의도가 다른 요구는 보존하고 재검토 표시한다.
모의 생성기와 실제 서버 프롬프트 모두 같은 정책을 사용한다. 요약 문장만 바꾸는 처리가 아니다.

입력·답변·요구 수정은 pending을 무효화한다. 응답의 프로젝트/버전/requestId가 모두 일치할 때만 반영한다.
늦은 성공·오류는 새 상태를 덮어쓰지 못한다. 실패 시 error/pending 이외 기존 입력·출처·요구를 보존한다.
수동 수정은 locked=true, 확인 출처를 추가한다. 상위 입력 변경은 관련 요구를 보수적으로 재검토 표시한다.

## 답변 길이와 복구

원문 Answer.text는1500 UTF-16 코드 단위, 요구 text/acceptance는 각각800까지다.
공백이 아닌 답변을 요구하지만 허용된 원문을 trim/slice하지 않는다. 한글 BMP 한 글자는 UTF-8에서3바이트다.
길이 제한과 전체 JSON32KiB 바이트 제한은 별개로 검사한다.
긴 답변을800자 요구에 그대로 복제하지 않고 명시적인 해석 대기 문구와 전체 원문 출처를 연결한다.
모의 모드는 긴 비정형 원문을 해석했다고 꾸미지 않는다. 실제 AI의 요약 품질은 미검증이다.
Project.answeredQuestion은 이번 한 답변 수정 UI의 로컬 상태다.
reviseAnswer는 같은 Answer ID·questionId로 현재 답변을 갱신하고 이전 원문 Source를 불변으로 남긴다.
새 Source와 버전을 연결하며 이전 응답을 무효화한다. 실패 후에도 원문 수정·재요청이 가능하다.
1501자 오류도 입력 버퍼를 지우지 않는다. 답변 수정은 추가 인터뷰 턴이 아니다.

## 저장 범위·오류·보안

browser/multi-device 선택 의미는 공통 함수로 정규화하며 고객 직접 선택만 confirmed가 된다.
자유 답변 해석은 proposed, 모름/보류는 deferred. 여러 기기 선택으로 Studio 클라우드를 구현하지 않는다.
401/403→AI_AUTH_FAILED,402→AI_BALANCE_REQUIRED,429→AI_RATE_LIMIT,400/404/422→AI_CONFIG_REJECTED,
5xx→AI_UNAVAILABLE. 연결·시간초과·형식 오류는 별개다. 원문 오류/키/요청은 로그에 출력하지 않는다.
기본15초, 응답128KiB, 분당6·누적20·동시2회, 자동 재시도 없음. 공개 운영 인증·영속 한도는 없다.
정적 자산은 정규화된 public root, 상대 포함 검사, 허용 목록, realpath 경계로 보호한다.
같은 경로 함수를 POSIX/Windows 드라이브·UNC 방식에 적용해 검증한다.
장기 편집 이력 압축·전체 크기 상한 초과 복구·전면적인 의미 충돌 해결기는 후속 범위다.
