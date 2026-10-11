# AgentFlow Studio 현재 상태 — IDEA017 작업 브랜치 반영

최신 공유 기준은 `init-003/fix-review-regressions` / [Draft PR #1](https://github.com/tlsee0813-cmd/agentflow-studio/pull/1)이다. IDEA015 R3 앱 위에 IDEA017의 최소 개선을 반영했으며 main 병합·운영 배포는 없다. 실행 명령은 [START_HERE](START_HERE.md)에 있다.

## 현재 구현

[app/continuity](../app/continuity/README.md)는 입력 → 필요한 질문 → 편집 가능한 작업문 → 돌아온 결과 → 다음 변경을 연결한다. localStorage 지속 저장·JSON 백업/복구, 기준 변경 뒤 낡은 AI 제외·수동값 보존, v1 이력, AI128KiB와 로컬 복구8MB 한도는 유지한다.

IDEA017은 이전 수동 scope·checks의 원문 참조를 현재 작업에 제공하고, 명시적 재사용 요청이 있을 때만 적용하도록 지시한다. 다른 과거 기준을 강제 적용하거나 의미 탐지를 보장하지 않는다. requested 원문은 문맥 예산 안에서 전문을 우선하고 문자열 출력 계약·선택지 지시를 보완한다. production 변경은 domain·types·request validation·prompt4파일이며 관련 검사3파일을 함께 반영했다. UI·저장 스키마·provider·실험 기록 보호·사례·gate·원장은 그대로다.

검증 후보179파일의 manifest SHA256은 `5c00511bf010b31f9bae7c443221cd3933fe01caff358ef7ac2fcc7c3df04850`다. baseline178개 중172개 동일·6개 변경·1개 신규이며, 공유 문서는 검증 ZIP과 구별되는 최신 상태 안내다. 실행 위치와 ZIP 전용 자료는 [REPOSITORY_SCOPE](../experiments/idea016/REPOSITORY_SCOPE.md)에 구분한다.

## 검증과 실제 관찰

| 범위 | 확인 결과 |
|---|---|
| IDEA015 R3 Cloud 통합 (2026-10-11 21:31 KST) | 클린 설치·check/build, 기존 Node279/279·continuity45/45·직접 HTTP/localStorage 브라우저13/13 통과 |
| IDEA015 R3 GitHub CI | [608d4753 실행38140619804](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/38140619804) completed/success |
| IDEA017 독립 좁은 검사 | scratch13/13 통과 |
| IDEA017 Cloud 구현 검사 | 클린 설치·기존/continuity 타입·빌드·신규13/13 통과. 기존 전체 Node·브라우저는 반복하지 않음 |
| IDEA016 실제 baseline | 14회: provider200, 앱13수용·1INVALID_RESPONSE. C05 변경 미실행·C06 미완료 |
| IDEA017 실제 재평가 | 15회: provider/app 모두200,6흐름 완료, 오류·재시도·응답 수리·fallback0 |
| IDEA017 GitHub CI | [1e585241 실행38152906064](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/38152906064) completed/success |
| IDEA018 실제 재평가 | 13회: provider모두200·앱12수용/1INVALID_RESPONSE,4complete·C02failed·C06incomplete. 소스 미게시 |

IDEA017의 C03은 명시적으로 이어받은 수동 조건의 현재 적용 참조가 분명해졌고, C06은 ‘별명만’ 전문 전달과 반영을 확인했다. C05는 checks 문자열 수용 뒤30→60 단계를 처음 실제 관측했다. [IDEA016 결과](research/idea016-results.md)와 [IDEA017 결과](research/idea017-results.md)는 구별해 보존한다. complete·HTTP 성공·검사 통과는 고객 효용이나 내용 품질 합격이 아니다.

C02의 선택지 축·미정 기한·실제 답변 출처 표현, C05의 이미 갱신된 기준을 next에서 다시 갱신하라는 표현, C06의 공개 명단보다 넓은 첫 금지 범위가 남았다. persistent-profile 재방문/Blob 다운로드의 Chromium SIGSEGV 제한도 해결됐다고 주장하지 않는다. 실제 고객 관찰·운영 준비는 미검증이다.

## 다음 작업

[IDEA018 결과](research/idea018-results.md)는 C05 마지막 상태/next 표현 개선과 C02 문자열 suggestions 계약 거절·혼합 선택지, C06 새 기술 질문·넓어진 금지 범위, C04 제외된 메일 제안 재노출을 함께 기록한다. 답변 적용·재시도·응답 수리는0이었다. 단일 실행의 정성 관찰로 인과적·통계적 효과나 고객 효용을 확정하지 않는다. IDEA018 소스는 게시하지 않고 현재 공유 앱은 IDEA017을 유지한다.

### 진행 중인 독립 작업과 인계

세 작업을 병렬로 시작했고 진행 중임을 확인했다. 현재 공유 상품 소스는 IDEA017이며 아래 후보를 자동 승격하지 않는다.

- **Cloud / IDEA019:** 기존 Cloud 세션에서 IDEA019의 같은6사례와 새5사례의017/019 짝비교를 실행 중이다. 상한은28회이며 실제 호출 수·결과는 아직 미확인이다. C05의 현재 상태/next 최소 보완을 평가하고 전체 문제의 일괄 prompt 재작성으로 확대하지 않는다.
- **Pro / UI001:** 같은 AgentFlow 프로젝트의 새 세션에서 수용된017 ZIP을 기준으로 실제 고객 화면·사용 흐름을 구현한다. client·HTML·CSS·관련 UI 검사만 변경하며 prompt·domain·storage·API 등은 보존한다. 제공된 화면 구성 참고 자료를 사용하되 제품에 없는 실행·연결 상태를 만들지 않는다. 유료 AI 호출·원격 쓰기는 없다.
- **Claude / CONNECT001:** 새 Opus5.5 High 세션에서 공식 문서·소스의 connector/event 경계를 먼저 확인하고 추천하는 첫 연결을 좁게 설계한다. 선택적 작은 PoC는 제품 밖에서 합성 이벤트 정규화·중복/오래된 이벤트 처리만 보여 준다. 상품 소스·원격 상태는 변경하지 않으며 실제 연동 API 호출은 없다.

UI 후보의 변경 지문·실행 검사·화면, 연결 조사 근거·최소 인터페이스·PoC 한계를 각각 회수한다. UI와 선정된 prompt는 별도 diff로 통합하며 연결 PoC를 실제 상품 연동 성공으로 해석하지 않는다. 이번 공유 업데이트는 이 상태 문서뿐이고 소스·CI·PR 설정·main·배포는 변경하지 않는다.

과거 [IDEA013](research/idea013-results.md)·[IDEA014](research/idea014-results.md) 합성 비교와 [IDEA015 제품 검토](research/idea015-product-review.md)는 각 기록으로 남긴다.
