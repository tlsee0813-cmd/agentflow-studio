# AgentFlow Studio 현재 상태 — IDEA015 R3 수용

2026-10-11 21:31 KST 통합 Cloud 검증 기준. 최신 참조는 `init-003/fix-review-regressions` / [Draft PR #1](https://github.com/tlsee0813-cmd/agentflow-studio/pull/1)이며 main 병합·운영 배포는 없다. 실행 명령과 자료 위치는 [START_HERE](START_HERE.md)에 있다.

## 현재 실행 가능한 범위

[app/continuity](../app/continuity/README.md)에 ‘이어서 만들기’를 추가했다. 자유 요청과 답변, 보존 기준의 직접 편집, 작업문 복사·저장, 돌아온 결과 붙여넣기와 다음 변경, localStorage 저장·JSON 복구를 연결한다. 기준 수정 뒤 낡은 AI 문구를 현재 작업문에서 제외하고 수동값과 원문 이력을 유지한다. v1 원본을 보존하면서 저장 형식을 변환하며, AI 문맥128KiB 한도와 로컬 작업문·복구8MB 한도를 분리한다. 1,001건을 저장한 뒤 load/import가 거절되던 복구 경계를 R3에서 수정했다.

검증 대상 통합 소스는169파일, `SOURCE_FINAL.sha256`의 지문은 `c7e69b31934c65a4ff99852f75f3d3b4b92c83ddbcea83b33b01c519d011816e`다. 이는 공유 문서와 CI를 갱신하기 전 검증 묶음의 정체성이다. 이번 반영은 continuity23파일과 I9 검사2파일의 원문을 사용한다. 기존 기준145파일 중 의도한 소스 예외는 `app/tests/eval-init009.test.mjs` 하나이고 나머지144파일은 검증 묶음에서 불변이었다. 추가 helper는 임시 합성 자료로 I9.02를 격리한다. 제품의 실제 호출 runner·승인 gate·fixture·과거 원장은 변경하지 않았다.

## 완료한 통합 검증

| Cloud 실행 | 결과 |
|---|---|
| 클린 npm ci, 기존/continuity check·build | 모두 종료0 |
| 기존 전체 Node | 279/279 통과 |
| continuity Node | 45/45 통과 |
| 직접 HTTP 브라우저 | 13/13 통과 |
| I9.01 지문, Linux I9.02 원장 부재·완료 분기 | PLAN_REQUIRED 거절과 생성0 no-op 구분 통과 |

실패·skip은 모두0이다. Node22.16.0 / npm10.9.2 / TypeScript5.8.3 / Python3.13.5 / Playwright1.57.0 / 시스템 Chromium154.0.8037.57을 사용했다. 브라우저는 native HTTP와 실제 localStorage 경로이며 지정된 응답 fixture·오류 주입은 구분했다. 30→14 기준 수정 뒤 낡은 AI 제외·수동값 보존, 장기 기록·v1 이력, 재시도 답변 중복 방지, 1,001개 저장→새로고침→백업→가져오기를 확인했다. 8MB/100,000개 경계는 Node 검사다. 검사 후169파일의 해시는 불변이었다.

기존 persistent-profile 재방문 후 새 Blob 다운로드는 일반 Blob에서도 재현된 Chromium SIGSEGV 제한이 남아 있다. 위13개 검사는 그 제한의 해결을 주장하지 않는다. 새 프로필의 다운로드·복구 결과와 구분한다. 검증은 mock/paid=false였으며 새 실제 AI 품질, 실제 고객 효용, 운영 준비는 확인하지 않았다. 별도로, 앱 통합 커밋 `608d4753ebf4efc96c2df5bd518e5437e0ee99b4`의 [GitHub CI 38140619804](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/38140619804)는 completed/success다. 기존 앱과 continuity check·build·Node·브라우저 검사를 실행한 결과이며 IDEA016 실제 AI 품질 결과가 아니다. 이번 실험 도구 추가에서는 CI 검사 범위를 늘리지 않는다.

## 다음 품질 초점 — IDEA016 rev1

[IDEA016 실험 도구](../experiments/idea016/README.md)는 실제 continuity의 buildRequest/prompt/provider/state/handoff 경로를 사용하는 고객 6흐름(각2~3단계)의 baseline 시험 준비 자료다. 상품 UI·저장 형식·prompt·provider와 기준169파일은 변경하지 않았다. 저장소에서의 실행 위치와 ZIP 전용 검증 자료는 [REPOSITORY_SCOPE](../experiments/idea016/REPOSITORY_SCOPE.md)에 구분한다.

rev1은 실험 기록과 receive 이전 경계에서 알려진 키의 반향을 차단·치환하도록 보완했다. 작성자의 가짜 키 focused 회귀1개와 독립 좁은 메모리 회귀5개가 통과해 검토를 수용했다. 이는 실HTTP 추가 검증이나 실제 제공업체 호출이 아니며, 제품 원본 provider의 보안 수정·모든 민감정보 보호를 뜻하지 않는다. 준비 검토의 실제 외부 호출은0이다.

Cloud에 rev1 ZIP과 6사례·최대18회 실호출 지시를 전달해 실제 baseline 실행을 시작하도록 했다. 아직 완료 보고를 받지 않았으므로 새 실제 호출 수·현재 baseline 결과·품질 수용은 미확인이다. 실제 질문에 맞는 허용 합성 답변만 이어가고 실패·재시도0·중단을 그대로 회수할 예정이다.

오래된 미수정 요청의200자 발췌에서 뒤쪽 제약이 누락되는지는 실제 전송 문맥·응답·작업문을 읽어 입력 조립과 모델 실패로 구분한다. 제품 prompt를 선제 변경하거나 기능을 확대하지 않으며, 첫 실결과를 받은 뒤 개선을 판단한다.

과거 IDEA013·014 합성 비교는 [IDEA013 결과](research/idea013-results.md), [IDEA014 결과](research/idea014-results.md)에 보존한다. 그 계약 통과 수를 현재 앱의 품질이나 사용자 효용으로 옮겨 해석하지 않는다. 구현 과정의 검토는 [IDEA015 제품 검토](research/idea015-product-review.md)에 남아 있으며 원본·R2·R3의 과거 결과는 Git 이력과 구분한다.

