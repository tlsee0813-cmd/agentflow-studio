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

IDEA017의 C03은 명시적으로 이어받은 수동 조건의 현재 적용 참조가 분명해졌고, C06은 ‘별명만’ 전문 전달과 반영을 확인했다. C05는 checks 문자열 수용 뒤30→60 단계를 처음 실제 관측했다. [IDEA016 결과](research/idea016-results.md)와 [IDEA017 결과](research/idea017-results.md)는 구별해 보존한다. complete·HTTP 성공·검사 통과는 고객 효용이나 내용 품질 합격이 아니다.

C02의 선택지 축·미정 기한·실제 답변 출처 표현, C05의 이미 갱신된 기준을 next에서 다시 갱신하라는 표현, C06의 공개 명단보다 넓은 첫 금지 범위가 남았다. persistent-profile 재방문/Blob 다운로드의 Chromium SIGSEGV 제한도 해결됐다고 주장하지 않는다. 실제 고객 관찰·운영 준비는 미검증이다.

## 다음 작업

후속 원문을 확인했고 IDEA018의 prompt 정리·선택지·근거 출처·현재 상태와 다음 작업·범위 표현의 최소 보완을 배정 중이다. 새 기능 확대나 추가 실제 AI 재평가 결과는 아직 없다. 현재 커밋의 GitHub CI는 위 Cloud 실행과 별도로 확인한다. 신규13검사는 기존 `continuity/tests/*.test.mjs` glob에 포함되며 workflow를 바꾸지 않았다.

과거 [IDEA013](research/idea013-results.md)·[IDEA014](research/idea014-results.md) 합성 비교와 [IDEA015 제품 검토](research/idea015-product-review.md)는 각 기록으로 남긴다.
