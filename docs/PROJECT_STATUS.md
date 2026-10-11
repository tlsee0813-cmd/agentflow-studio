# AgentFlow Studio 현재 상태 — IDEA017 + UI001 rev1

최신 공유 기준은 `init-003/fix-review-regressions` / [Draft PR #1](https://github.com/tlsee0813-cmd/agentflow-studio/pull/1)이다. IDEA015 R3 앱 위에 IDEA017의 최소 개선과 UI001 rev1을 반영했으며 main 병합·운영 배포는 없다. 실행 명령은 [START_HERE](START_HERE.md)에 있다.

## 현재 구현

[app/continuity](../app/continuity/README.md)는 입력 → 필요한 질문 → 편집 가능한 작업문 → 돌아온 결과 → 다음 변경을 연결한다. localStorage 지속 저장·JSON 백업/복구, 기준 변경 뒤 낡은 AI 제외·수동값 보존, v1 이력, AI128KiB와 로컬 복구8MB 한도는 유지한다.

IDEA017은 이전 수동 scope·checks의 원문 참조를 현재 작업에 제공하고, 명시적 재사용 요청이 있을 때만 적용하도록 지시한다. 다른 과거 기준을 강제 적용하거나 의미 탐지를 보장하지 않는다. requested 원문은 문맥 예산 안에서 전문을 우선하고 문자열 출력 계약·선택지 지시를 보완한다. production 변경은 domain·types·request validation·prompt4파일이며 관련 검사3파일을 함께 반영했다. IDEA017의 AI 변경과 UI001 rev1의 화면 변경은 별개다. 저장 스키마·provider·실험 기록 보호·사례·gate·원장은 그대로다.

검증 후보179파일의 manifest SHA256은 `5c00511bf010b31f9bae7c443221cd3933fe01caff358ef7ac2fcc7c3df04850`다. baseline178개 중172개 동일·6개 변경·1개 신규이며, 공유 문서는 검증 ZIP과 구별되는 최신 상태 안내다. 실행 위치와 ZIP 전용 자료는 [REPOSITORY_SCOPE](../experiments/idea016/REPOSITORY_SCOPE.md)에 구분한다.

UI001 rev1은 현재 작업/다음 행동을 중심으로 화면을 재배치하고 기준·출처/기록 패널과 상세 편집을 제공한다. 전달될 전체 handoff의 문자수·digest로 내보내기 뒤 제안 text/why/포함 상태 변경을 감지하고 무관한 미제출 초안은 변경으로 표시하지 않는다. UI/client·presentation과 관련 UI 검사8경로만 반영했으며 AI prompt·domain·types·request validation·저장·provider는 보존했다. 후보 source182 manifest SHA256은 `cc55fee16f6d3753130b9914874a0c54fbfcb32f4d18c2723c9b52fd56552d41`이다.

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
| UI001 원본 Cloud | 클린 설치·check/build·continuity Node65/65·기존 native 브라우저13/13 통과. 신규 UI7통과/1오류(UI06 접힌 입력), 원본 실패 보존 |
| UI001 rev1 독립·Cloud | 내보내기 신선도 좁은 독립 회귀 수용. Cloud 클린 설치·build·continuity check/build·UI Node9/9·native UI9/9, fail/error/skip0. 변화 없는 기존 전체 검사는 반복하지 않음 |
| IDEA019 실제 평가 | 25회: 기존6흐름15회·동일 신규5입력017/019 각5회, 전부provider/app200·계약 수용. 소스 미채택 |

IDEA017의 C03은 명시적으로 이어받은 수동 조건의 현재 적용 참조가 분명해졌고, C06은 ‘별명만’ 전문 전달과 반영을 확인했다. C05는 checks 문자열 수용 뒤30→60 단계를 처음 실제 관측했다. [IDEA016 결과](research/idea016-results.md)와 [IDEA017 결과](research/idea017-results.md)는 구별해 보존한다. complete·HTTP 성공·검사 통과는 고객 효용이나 내용 품질 합격이 아니다.

C02의 선택지 축·미정 기한·실제 답변 출처 표현, C05의 이미 갱신된 기준을 next에서 다시 갱신하라는 표현, C06의 공개 명단보다 넓은 첫 금지 범위가 남았다. persistent-profile 재방문/Blob 다운로드의 Chromium SIGSEGV 제한도 해결됐다고 주장하지 않는다. 실제 고객 관찰·운영 준비는 미검증이다.

## 다음 작업

[IDEA018 결과](research/idea018-results.md)는 C05 마지막 상태/next 표현 개선과 C02 문자열 suggestions 계약 거절·혼합 선택지, C06 새 기술 질문·넓어진 금지 범위, C04 제외된 메일 제안 재노출을 함께 기록한다. 답변 적용·재시도·응답 수리는0이었다. 단일 실행의 정성 관찰로 인과적·통계적 효과나 고객 효용을 확정하지 않는다. IDEA018 소스는 게시하지 않고 현재 공유 앱은 IDEA017 + UI001 rev1을 유지한다.

### 진행 중인 독립 작업과 인계

현재 공유 상품은 IDEA017 + UI001 rev1이다. RESEARCH021 조사와 IDEA020 보충 검토를 회수했다. CONNECT001·IDEA022는 아직 상품에 승격하지 않는다.

- **Pro / RESEARCH021 — 조사 완료:** [조사 17문서](research/research021/README.md)를 원문대로 보존했다. [출처 지도](research/research021/01_SOURCE_MAP.md)·코드 재사용/실사용 원장·분야 밖 대안·[UI001](research/research021/handoffs/UI001.md) / [CONNECT001](research/research021/handoffs/CONNECT001.md) / [IDEA020](research/research021/handoffs/IDEA020.md) 인계·미실행 후속 연구를 제공한다. 현재 작업대와 작은 인계 출력, 요청/계획/외부 관측의 구분을 제안하며 고객 효용의 실증 결론은 아니다. 지정 커밋의 정적 열람·공식 문서·작성자 경험과 접근 한계를 기록했고 독립 연구 검증·앱 실행은 하지 않았다. 주요 작업의 [조사·구현 판단 원칙](START_HERE.md#주요-작업의-조사와-구현-판단)을 재사용한다.
- **Pro / IDEA020 — 보충 검토 완료:** Cloud B05는 실제 domain API로 구성됐지만 초기 R01은 정확한 입력·revision·응답 재현이 아니다. 실제 응답의 next ‘무작업’과 reviewBasisIds D1이 공존한다. requested 항목이 남았다는 사실만으로 항상 미반영이라고 단정할 수 없다. [설계 인계](research/idea020-connect001-handoff.md)에 구분하며 설계 자체는 미통합이다.
- **Pro / IDEA022 — 독립 검토 대기:** IDEA017을 기준으로 기존 history의 읽기 전용 planFacts와 handoff·AI 입력을 연결하는 새 구현을 회수했고 독립 좁은 검토를 기다린다. RESEARCH021을 재사용하며 요청 보존/기준 기록/직접 수정/외부 실행 미확인을 구분한다. 요청 전체 완료 플래그는 만들지 않으며 UI 파일은 별도 작업으로 보존한다. 아직 공유 앱에 반영하지 않았고 실제 재평가 결과도 없다.
- **Pro / UI001 rev1 — 수용·반영:** 초기 UI06 검사는 정상 compose 클릭 후 입력하도록 수정했고 제안 수정 뒤 ‘내보냄’ 표시가 갱신되지 않던 결함을 고쳤다. 독립 좁은 회귀 수용과 Cloud UI Node9/9·native UI9/9 통과를 확인했다. AI 응답은 규칙 mock이고 실제 AI 호출0이다. UI09는 Markdown 다운로드로 재내보내기를 검사했으며 별도 reload/클립보드 성공 검사는 아니다. UI08 클립보드 지연과 UI06 설정 표시는 명시적 대역이다.
- **Claude / CONNECT001 rev1 — 좁은 검토 수용:** 두 결함을 수정한 합성 PoC의 독립 좁은 검토가 통과했다. 자체 session/turn 연결 우선·충돌/미연결의 수동 배치·같은 시각 보고의 단일 최신 후보를 확인했다. Windows Node24.19.0의 합성 회귀·hook runner 검사는 실제 CLI 발화·Codex stable 호환·다중 프로세스 append·앱 통합 검증과 구별한다. [설계 인계](research/idea020-connect001-handoff.md)를 이어받으며 실제 연결은 미검증이다.

[IDEA019 결과](research/idea019-results.md)의 실제25회·계약 수용 기록은 유지하지만019는 채택하지 않는다. B05/B03 구성 코드·원문을 읽기로 회수해 설계 판단에 사용했고 추가 AI 호출은 없다. UI와 파생 사실 후보는 별도 변경으로 검토하고 연결 PoC를 실제 상품 연동 성공으로 해석하지 않는다. 이번 공유 반영은 수용된 UI001 rev1의8경로와 현재 상태 안내다. IDEA022·IDEA018·IDEA019 소스는 포함하지 않았고 CI·PR 설정·main·배포는 변경하지 않는다.

과거 [IDEA013](research/idea013-results.md)·[IDEA014](research/idea014-results.md) 합성 비교와 [IDEA015 제품 검토](research/idea015-product-review.md)는 각 기록으로 남긴다.
