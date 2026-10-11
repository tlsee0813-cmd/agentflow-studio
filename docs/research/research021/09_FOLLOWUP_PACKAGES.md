# 추가로 코드까지 읽어야 할 후속 조사 묶음

이 파일은 **미실행 작업 후보**다. 새로운 병렬 세션을 실제 위임하거나 시작한 것이 아니다. 현재 조사의 부족한 범위를 정확히 좁혔으며, 다음 구현의 모든 부분을 이 후속 조사 완료 때까지 멈추라는 뜻이 아니다. 연결/복원/외부 코드 수용처럼 실제 판정을 바꾸는 부분만 해당 근거를 먼저 확보한다.

## F21-1 · Codex 연결의 단절·오류·재개 경계

**우선순위:** CONNECT001이 동일 문제를 아직 해결하지 않았다면 P0. 새 호출 비용 없이 코드/공식 문서를 읽는 범위.

**고정 기준:** `openai/codex@27065a91ccbf5ba8532844be3777fcf83b77820d`. 실제 존재를 목록에서 확인했으나 아직 본문을 읽지 않은 파일:

- [SDK streamed tests](https://github.com/openai/codex/blob/27065a91ccbf5ba8532844be3777fcf83b77820d/sdk/typescript/tests/runStreamed.test.ts)
- [SDK run/resume tests](https://github.com/openai/codex/blob/27065a91ccbf5ba8532844be3777fcf83b77820d/sdk/typescript/tests/run.test.ts)
- [SDK exec tests](https://github.com/openai/codex/blob/27065a91ccbf5ba8532844be3777fcf83b77820d/sdk/typescript/tests/exec.test.ts)
- [SDK exec.ts의 286행 이후](https://github.com/openai/codex/blob/27065a91ccbf5ba8532844be3777fcf83b77820d/sdk/typescript/src/exec.ts#L286)

**읽을 질문:** unknown/fatal event, JSON 깨짐, 프로세스 nonzero, 중도 iterator 종료, thread ID 보존/재개에서 어떤 결과가 누락되거나 오류로 전달되는가? SDK source와 실제 npm release manifest/CLI 설치 버전이 같은가? App Server의 이력 읽기/구독/재연결은 SDK resume와 무엇이 다른가? [C02][K11][K12]

**산출물/완료 기준:** 각 입력→공식 코드 처리→Studio adapter 처리의 작은 표. 코드를 읽는 것만으로 확인 못 하는 replay/다중 client 범위는 미확인으로 남긴다. 설치된 CLI를 나중에 무상 합성 실험할 때도 실제 모델 호출 0을 보장하는 분리 경로가 있어야 한다.

**제외/중단:** 개인 세션 로그/키를 읽거나 원격 실행을 시작하지 않는다. CONNECT001이 이미 같은 근거를 확보했다면 그 결과를 재사용하고 중복 조사하지 않는다.

## F21-2 · 실제 diff 라이브러리 도입이 필요할 때만 보안·충돌 검사

**우선순위:** UI001의 네 필드 비교에는 차단 조건 아님. 중첩 객체 patch 도입 직전 P1.

**고정 기준:** `benjamine/jsondiffpatch@a60db8a232f92ee4b987c14f43f77402885d1a5a`.

- [prototype-pollution.spec.ts](https://github.com/benjamine/jsondiffpatch/blob/a60db8a232f92ee4b987c14f43f77402885d1a5a/packages/jsondiffpatch/test/prototype-pollution.spec.ts) — 목록만 확인, 본문 미열람.
- [arrays.ts 전체](https://github.com/benjamine/jsondiffpatch/blob/a60db8a232f92ee4b987c14f43f77402885d1a5a/packages/jsondiffpatch/src/filters/arrays.ts) — 111행 이후 미열람.
- 실제 도입 release의 package/lockfile/exports와 선택 formatter 파일을 확정 후 읽기.

**질문:** import한 delta의 prototype 경로, 삭제/재정렬, 중복 ID, 이미 바뀐 기준에 inverse patch, 수동 필드 보존을 어떻게 제한하는가? core만 사용해도 브라우저 제공 방식 변경이 필요한가?

**완료 기준:** 채택/자체 네 필드 비교 유지 중 하나를 결정. 자체 비교로 충분하면 여기서 종료한다. 범용 협업/Undo를 함께 만들지 않는다.

## F21-3 · OpenSpec 검증 원리의 추출 범위

**우선순위:** 코드 복사/Markdown change import가 실제 요구가 될 때 P1. 현재 안정 ID 구조를 유지한 설계 참고는 선행 가능.

**고정 기준:** `Fission-AI/OpenSpec@9111a7654d7800391459431fff4eaf66e33a3d2e`.

- [specs-apply.ts](https://github.com/Fission-AI/OpenSpec/blob/9111a7654d7800391459431fff4eaf66e33a3d2e/src/core/specs-apply.ts) — 186–229,441행 이후와 실제 write 함수.
- [comment masking security test](https://github.com/Fission-AI/OpenSpec/blob/9111a7654d7800391459431fff4eaf66e33a3d2e/test/core/specs-apply.comment-masking.security.test.ts)
- [fence preservation test](https://github.com/Fission-AI/OpenSpec/blob/9111a7654d7800391459431fff4eaf66e33a3d2e/test/core/specs-apply.fence-preservation.test.ts)
- [near-miss test 나머지](https://github.com/Fission-AI/OpenSpec/blob/9111a7654d7800391459431fff4eaf66e33a3d2e/test/core/specs-apply.requirement-name-near-miss.test.ts#L166)

**질문:** 경고와 차단의 실제 차이, partial write/rollback, 미언급 본문 보존, fence/comment가 요구로 오인되는 경로는 무엇인가? #2033의 제안과 실제 반영 코드는 무엇이 다른가? [X07]

**완료 기준:** 현재 JSON/ID 모델에 가져올 검증 규칙만 추려서 예시와 함께 반환. CLI 전부를 설치하는 결론으로 자동 확장하지 않는다.

## F21-4 · effortless의 작은 순수 정책 추출 가능성

**우선순위:** 새 effort 기능/평가기 변경을 실제 배정할 때 P1~P2. UI001/IDEA020을 막지 않음.

**고정 기준:** `HeyCubit/effortless@0690b9cf12b6d1d286a7ceb40ee7e97ce47dd6d6`.

- [hooks/register.tsx](https://github.com/HeyCubit/effortless/blob/0690b9cf12b6d1d286a7ceb40ee7e97ce47dd6d6/hooks/register.tsx)에서 `namedEffort`, `parseVerdict`, `parseHandoffAnswer`, `handoffEvidence`, `judgeFailure`, `benchGrade`의 실제 정의와 호출자를 먼저 찾는다. 이름은 읽은 테스트 import에서 확인했지만 함수 본문/정확한 행은 미열람이다.
- [tests/effortless.test.ts](https://github.com/HeyCubit/effortless/blob/0690b9cf12b6d1d286a7ceb40ee7e97ce47dd6d6/tests/effortless.test.ts)의 대응 테스트와 166행 이후.
- [bench/agentic/score.cjs](https://github.com/HeyCubit/effortless/blob/0690b9cf12b6d1d286a7ceb40ee7e97ce47dd6d6/bench/agentic/score.cjs) 및 [bench/agentic/run.sh](https://github.com/HeyCubit/effortless/blob/0690b9cf12b6d1d286a7ceb40ee7e97ce47dd6d6/bench/agentic/run.sh) — tree에서 존재 확인, 내용 미열람.

**질문:** 명시적 override에서 부정문·인용문을 어떻게 구분하는가? 실패/미확정 결과가 낮은/높은 effort로 조용히 변하는가? 평가기 별 실패 분모·judge 비용·실행 모델 보존은 무엇인가?

**완료 기준:** runtime UI·가격·모델 상수에서 분리 가능한 함수/테스트 범위만 제시. 한국어 의도 해석을 영어 regex로 일반화하지 않는다. K19의 문제를 다른 bench에 근거 없이 전파하지 않는다.

## F21-5 · Claude SDK 실제 배포물과 연결 허용 범위

**우선순위:** CONNECT001 결과에 부족한 경우만 P0. API 호출/실서비스 인증 전에 필요.

**확인한 출발점:** [공식 SDK repository](https://github.com/anthropics/claude-agent-sdk-typescript)에는 examples/scripts/CHANGELOG/LICENSE.md가 보이지만 이번에는 고정 commit/내부 SDK 구현/테스트를 확보하지 않았다. 존재하지 않는 내부 경로를 지어내지 않는다. [C07]

**다음 읽기:** 공식 배포 release를 확정하고 그 LICENSE.md, package manifest, 공개 TypeScript 선언의 event/session/hook/abort 타입과 실제 예제를 읽는다. 공개되지 않은 엔진은 ‘미공개/미열람’으로 남긴다. 이 파일을 읽기 위해 사용자 로그인 token이나 개인 transcript를 요구하지 않는다.

**질문:** 로컬 사용자의 Claude 도구 관측과 제3자 고객 서비스의 인증/과금 경계는 무엇인가? 설치 버전에서 hooks event·matcher·setting source가 실제 지원되는가? 공식 docs의 권한을 우회하는 plugin 메커니즘은 없는가? [C04][C05]

**완료 기준:** CONNECT001의 연결 시나리오별 허용 경로/미확인/별도 승인 필요 표를 갱신. 개인 플러그인 README가 고객 서비스 사용 승인을 대신하지 못한다.

## 총괄이 각 주요 구현 전에 재사용할 작은 조사 게이트 — 운영 제안

문제를 고객의 행동 한 문장으로 적고, 이미 있는 기능/기술과 ‘아무것도 추가하지 않는 대안’을 먼저 비교한다. 중요한 후보 하나는 실제 코드/라이선스까지 읽고, 구현할 작은 범위·유지 비용·성립하지 않는 조건을 적는다. 이번 원장의 기존 근거가 충분하면 같은 조사 전체를 반복하지 않는다. 바뀐 provider 버전/새 권한 경계/큰 실패가 있을 때 해당 근거만 갱신한다.

이 운영 게이트는 모든 경험을 유료 실험으로 재현하거나, 장문의 조사 완료 전에는 작은 UI 수정도 못 한다는 절차가 아니다. 최종 채택과 작업 배정은 총괄이 현재 결과/소스와 비교해 반영한다.


---
출처 링크(열람 범위·한계는 `01_SOURCE_MAP.md` 참조)

[C02]: https://learn.chatgpt.com/docs/app-server
[C04]: https://code.claude.com/docs/en/hooks
[C05]: https://code.claude.com/docs/en/agent-sdk/overview
[C07]: https://github.com/anthropics/claude-agent-sdk-typescript
[K11]: https://github.com/openai/codex/blob/27065a91ccbf5ba8532844be3777fcf83b77820d/sdk/typescript/src/thread.ts
[K12]: https://github.com/openai/codex/blob/27065a91ccbf5ba8532844be3777fcf83b77820d/sdk/typescript/src/exec.ts
[X07]: https://github.com/Fission-AI/OpenSpec/issues/2033
