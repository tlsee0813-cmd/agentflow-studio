# INIT-006 — 진단 계약·구현 범위

상태: review_ready. 작성 세션의 구현·자기 검증 결과이며 독립 검토·Cloud 재시험·통합 완료가 아니다.

## 결론과 기준

2026-10-11 사용자가 전달한 실제 C2는 HTTP 200 / finish_reason=stop 뒤 INVALID_RESPONSE이며 실패 content가 없다. **기존 C2의 정확한 필드 원인은 확정할 수 없다. 이번 변경은 진단 보강이지 그 응답을 통과시키는 수정이 아니다.** 새 C2가 성공해도 과거 원인의 해결 증거로 소급하지 않는다.

기준: PR #1 `4caa0914d4520c76cdd0380bbb1a3c1941ab0451` + INIT-005 rev1 15파일 overlay. 입력 ZIP SHA256 `9b0f72023fe2702d1a0a448ee1d0dfc40bd59d32176e40c17822fffc0fabb1fd`, 내부 manifest 45항목 확인. GitHub 읽기 연결로 복원한 38파일의 blob/tree 및 정확한 커밋 해시를 확인하고 overlay를 한 번 적용했다. 직접 clone은 이 환경의 DNS 문제로 불가했다.

기존 R1~R5, 날짜/OpenSSL 수정은 유지한다. `validateRequest`, `contracts.ts`의 응답 필드·수량·길이·enum, 출처/프로젝트/요청/버전 판정, 확정·수동 잠금 보호, 기존 storage 정규 질문 정책, HTTP 안전 오류, 프롬프트, 모델/토큰 설정을 변경하지 않았다. 계약 완화·새 자동 보정·재시도·실패 시 mock 대체는 없다. 화면·앱 기능 확장, 새 의존성, 원격 쓰기도 없다. 기존 `docs/init005/`는 역사적 인계 그대로이며 현재 실행 지시는 `CLOUD_RETEST.md`가 대체한다.

## 관측 계약

`src/shared/diagnostics.ts`가 별도 버전 `init006.diagnostic.1`을 정의한다. 첫 실패 한 건만 전달하며 성공은 null/이벤트 없음이다. AiResult / Envelope / Project와 스키마를 섞지 않는다.

| stage | 관측 위치 |
|---|---|
| response_body | 본문 누락·바이트 상한·읽기 실패 |
| envelope_parse | 제공업체 외부 JSON 파싱 |
| provider_envelope | finish_reason / tool_calls / content 형태 |
| content_parse | message.content 내부 JSON 파싱 |
| result_contract | 제공업체 결과의 필드·참조 계약 |
| state_guard | 현재 프로젝트/버전/pending 요청 불일치 |
| state_contract | 상태 반영 직전 Envelope 및 결과 재검증 |
| state_apply | 상태 계산 예외 또는 시험의 상태 불변조건 실패 |

경로와 rule 전체 목록은 코드의 동결된 enum을 원본으로 삼는다. 예: `result.proposals[].sourceIds[] / known_source`, `result.proposals[].acceptance / max_length`. 실제 ID·인덱스·알 수 없는 필드명·잘못된 값은 기록하지 않는다. 필수 필드 누락은 코드에 정의된 경로, 미등록 필드는 부모 경로 + unexpected_field + 개수만 기록한다. 오류 메시지를 파싱해서 경로를 추측하지 않는다.

숫자는 필요한 length/count만 허용한다. 문자열 length는 기존 계약과 같은 UTF-16 코드 단위이며 body_limit의 length만 수신 바이트다. enum/참조/타입 실패에 관측값·문자열이나 임의 메타데이터를 붙이지 않는다. 런타임 allowlist로 재구성하고 freeze하며, 관측자의 동기 예외·비동기 rejection도 무시한다. 타임아웃 뒤 늦게 도착한 작업은 새 진단을 방출하지 않는다.

훅: `callDeepSeek(...,{onDiagnostic,onTelemetry})`, `createApp({onDiagnostic})`, `validateResult(raw,request,onDiagnostic)`, `validateEnvelope(...)`, `applyResponse(state,request,raw,onDiagnostic)`. 제공업체 telemetry에 안전한 diagnostic을 추가하지만 응답 본문에는 넣지 않는다. 기본 서버는 기록기를 설치하지 않으며 CLI 시험만 명시적으로 수집한다. 사용자 화면은 기존 INVALID_RESPONSE 안내 그대로다.

새 시험 보고서는 요청/응답·원문·변경 전후 요구·출처·키·헤더·추론·원시오류를 저장하지 않는다. 진단 외 메타데이터도 고정 시험 식별자, 검토한 코드 파일 해시, 호출/사용량/길이/시간 수치, 고정 상태 코드 및 보호 검사 boolean만 남긴다. 예상 밖 returnedModel 문자열은 `different`로만 표시한다. 기존 INIT-005의 원문 포함 시험 보고서 형식을 재사용하지 않는다.

## 실제 검사와 한계

이 세션 Linux / Node 22.16.0 / npm 10.9.2 / 설치된 TypeScript 5.8.3에서:

- 수정 전: check, build, Node 119/119 통과.
- 수정 후: check, build, Node **178/178 통과**, 실패·건너뜀 0. 신규 59개가 외부/내부 malformed JSON, 계약 경로·규칙, 정상 prefix 뒤 실패의 원자적 거절, 원본 상태 전체 보존, 확정/잠금·출처 보호, stale guard, 관측자 실패, HTTP 오류 비노출, 보고서 비밀 미포함, 예산·단일 dispatch·프로세스 간 잠금을 검사한다.
- 실제 로컬 HTTP에서 진단은 내부 훅에만 있고 응답은 기존 안전 오류 그대로임을 검사했다. 기존 실제 로컬 OpenSSL/TLS/CONNECT 회귀도 포함한다. 제공업체 HTTP는 테스트 전용 응답 주입이다.
- 구·신 결과/Envelope 계약 비교 **4,964개**: 허용 890, 거절 4,074, 판정/성공 결과 차이 0. 거절마다 진단 1건. 유한 합성 경계 집합이지 전체 증명은 아니다.
- 합성 파싱/출처 오류 세 사례는 이전·이후 모두 INVALID_RESPONSE로 거절되며, 이후만 단계/경로/rule이 생김을 비교했다. 실제 C2 content 재현이 아니다.
- C2 기본 plan 및 명시 mock 실행 통과. 외부 생성 요청 0, 실키 사용 0.

`npm ci`는 registry DNS EAI_AGAIN으로 실패했다. 설치된 컴파일러 검증을 클린 설치 성공으로 표현하지 않는다. 직접 HTTP 브라우저 검사는 Chromium 관리자 정책 ERR_BLOCKED_BY_ADMINISTRATOR로 18건 모두 탐색 단계에서 막혔다. DOM bridge로 대체 통과시키지 않았다. 새로운 Cloud·Windows 실행, 실인증·유료 C2, 사용자 품질 평가는 미실행이다. 사용자가 제공한 이전 Cloud/Windows 성공은 새 버전의 실행 증거가 아니다.

정확한 명령/안전한 결과·대조 스크립트·패치 적용 검사는 반환 ZIP의 verification에 있다. 총괄의 독립 검토와 Cloud 실행 후 통합 여부를 판단한다.
