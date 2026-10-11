# 다른 세션을 위한 진입점

2026-10-11 기준. 최신 작업은 `init-003/fix-review-regressions`와
[Draft PR #1](https://github.com/tlsee0813-cmd/agentflow-studio/pull/1)에서 읽는다.
main은 최신 구현이 아니다. 먼저 해당 브랜치를 checkout하고 이 문서와 현재 상태를 읽는다.

| 자료 | 위치 | 상태와 용도 |
|---|---|---|
| 실행 가능한 개발 앱 | `app/src/`, `app/server/`, `app/public/` | 수용된 INIT009 전체 소스. 로컬 개발용이며 운영 제품 완성 아님 |
| 구현·검증 현재 상태 | [PROJECT_STATUS](PROJECT_STATUS.md) | 과거 검증과 실제 합성 호출의 관찰·한계 |
| 평가 계약과 도구 | [INIT009 CONTRACT](../app/docs/init009/CONTRACT.md), `app/scripts/init009/`, `app/fixtures/init009/` | 고정 사례/원장/gate. 옛 live 실험을 재실행할 지시 아님 |
| 탐색 클릭 시제품 | [IDEA012 README](../prototypes/idea012-rehearsal/README.md) | 모의 고객 체험. 제품 통합·실제 앱 판정·시장 검증 아님 |
| 질적 연구의 판단 | [qualitative-findings](research/qualitative-findings.md) | 반복 불편과 반례에서 얻은 제품 가설 |
| 재사용 후보 | [reuse-findings](research/reuse-findings.md) | 미설치·미통합 후보와 적용 전 확인 사항 |
| IDEA013 준비물 | [실험 README](../experiments/idea013/README.md), [Cloud 인계](../experiments/idea013/CLOUD_HANDOFF.md) | 두 전략·합성 개발6사례·요청12개. 실제 API 비교 미실행 |

## 비용 없는 시작

Node22.16.0/npm10.9.2를 사용한다. 다음 명령은 mock 앱을 실행한다.

```sh
cd app
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm test
npm run demo
```

`npm run demo` 후 `http://127.0.0.1:3000`을 연다. IDEA012는 별도로
`prototypes/idea012-rehearsal/index.html`을 브라우저에서 연다.
mock 성공은 실제 AI 내용 품질 성공이 아니다. 키나 기존 실험 원장을 새 세션에 복사하지 않는다.
기존 live runner의 고정 ID, 잠금, 실패 기록을 재시도/reset/새 경로로 우회하지 않는다.
기존 live gate는 당시 원본 소스와 Cloud 기록에 묶여 있다. `app/`의 원본 문서는 그 지문을
유지하기 위한 당시 기록이고, 최신 상태는 루트 인계 문서에서 읽는다. gate 지문을 다시 써서 과거 실험을 열지 않는다.

## 다음 판단

현재 개발 앱의 제안/확정/보류·출처·사용자 수동값 보호를 유지한다. p01의 중복/오래된 목표와
AI 자유문장 품질은 남은 개선 입력이다. IDEA012의 핵심 가설은 사용자가 경험한 고객 결과를
두 번째 실제 변경에서 다시 찾을 가치가 있는지다. 처음 한 번의 시연 호응이나 미리 심은
불일치 발견만으로 제품 효용을 확정하지 않는다.

IDEA013은 이 커밋의 `experiments/idea013/`를 기존 Cloud에서 읽고 별도 독립4사례를 더해
초기20요청을 비교하는 다음 단계다. 후속은 실제 첫 질문과 명시적 합성 답변에 한정한다.
평가 메모를 모델 입력에 넣지 않는다. 실행 결과를 회수하면 합성 응답의 의미를 비교한다.
불필요한 전체 재감사나 커뮤니티 출처 복구 작업을 반복하지 않는다. 새 세션은 현재 사용자
지시와 자신의 권한 범위를 확인한다. main 병합과 운영 배포는 이번 작업 범위에 없다.

공개 참조 자료에는 자체 소스·합성 fixture·짧은 판단 요약만 포함한다.
원본 교재/사용자 첨부, 전체 채팅, 개인 실행 기록, 키, 설치 패키지, 빌드 및 live 출력은 저장소에 싣지 않는다.
