# 코드 재사용 원장 · 채택 범위와 비용

판정은 **즉시 설치 승인**이 아니라 다음 설계 입력이다. 실제 코드/테스트/라이선스 열람은 아래에 제한된다. 이 조사 ZIP에는 외부 소스·이미지·라이브러리를 복사하지 않았다. 라이선스 요약은 읽은 해당 파일 기준이며, 실제 배포물의 파일별 예외·전이 의존성·상표/서비스 조건까지 심사한 것이 아니다.

## 후보 판단 한눈에

| 후보 | 해결하려는 불편 | 지금 가져올 최소 범위 | 가져오지 않을 것 | 비용/판정 |
|---|---|---|---|---|
| jsondiffpatch | 중첩 변경에서 무엇이 달라졌는지 모름 | stable ID 매칭·수정 전 snapshot 원리 | 네 텍스트 칸에 전 라이브러리/formatter/새 번들러 | 현재는 원리만. 객체 변경이 커질 때 패키지 재검토 |
| OpenSpec | 변경 명세의 누락·중복·충돌 | 명시적 operation과 누락 경고, 테스트 사고방식 | 제목 기반 원본 전환·전체 archive CLI | 구조/테스트 원리 우선. Markdown 병합 엔진 도입 보류 |
| Codex 공식 SDK | exec/stream/resume/cancel의 반복 구현 | 공식 SDK를 감싼 작은 제공자 어댑터 | vendor fork·CLI 로그 스크래핑·독자 실행 엔진 | 실행 연결 승인 후 우선 후보. 배포 버전/설치 검증 필요 |
| effortless | 자동값과 실제 사용값 혼동, 평가 편향 | 수동값 우선 검사·A/B 무작위 배치·오류 행 분리 | 평가 실패=동점·Claude 엔진/모델·가격/캐시 상수 이식 | 정책과 시험 구조만 후보. 제품 dependency로는 보류 |

각 행의 구체적 근거는 아래 원문 링크에 있다. ‘코드가 공개되어 있다’와 ‘현재 앱에서 안전하게 쓸 수 있다’를 구분했다.

## K-J · jsondiffpatch

**고정점:** `benjamine/jsondiffpatch@a60db8a232f92ee4b987c14f43f77402885d1a5a` (master 확인). branch commit 날짜 2026-05-14, package 0.7.6. 저장소는 열람 때 archived=false였다. 이 활동 표시는 장기 유지보수 약속이나 보안 품질 판정이 아니다. [K04]

**읽은 코드와 시험:**
- `packages/jsondiffpatch/src/filters/arrays.ts` 1–110: `arraysHaveMatchByRef`, `matchItems`, `diffFilter`. 객체 배열에 `objectHash`로 식별자를 줄 수 있다. [K01]
- `packages/jsondiffpatch/src/diffpatcher.ts` 전체: `DiffPatcher.diff/patch/reverse/unpatch`. [K02]
- `packages/jsondiffpatch/test/index.spec.ts` 1–190: diff/patch/unpatch 왕복, `cloneDiffValues`와 입력 객체/제거 항목 후속 변경 관련 검사. 아래 security test 파일은 목록만 확인했고 본문은 안 읽었다. [K03]

**재사용 경계:** stable requirement/task ID로 객체를 대응시키고, 반영 전 snapshot을 분리 보관하는 원리를 가져온다. 현재 `WorkValues`와 직전 `ExportRecord`의 간단한 before/after는 라이브러리 없이도 가능하다. 라이브러리가 필요해지면 어댑터 하나 안에서 구조 diff만 사용하고, 고객용 설명은 도메인이 별도로 만든다. [P04][P05]

**중요한 반례:** reverse/unpatch는 과거 delta를 뒤집는 기능이지 ‘이후 다른 사용자가 변경한 상태에 안전하게 되돌리기’를 보장하는 동시성 규약이 아니다. base revision이 바뀌었으면 새 차이를 계산해야 한다. 텍스트 차이가 없더라도 코드 구현 사실이 확인된 것은 아니며, 큰 차이가 곧 중요한 의미 변화도 아니다.

**의존성·호환:** ESM; package exports에서 core와 text diff 경로가 나뉜다. `@dmsnell/diff-match-patch ^1.1.0` 의존성을 선언한다. Node engines는 `^18.0.0 || >=20.0.0`여서 프로젝트의 문서상 Node22.16 범위에 들어간다. 현재 native DOM 모듈 서비스에 bare npm import를 넣는 절차와 실제 타입/브라우저 동작은 검증하지 않았다. 별도 formatter/CSS까지 끌어오지 않는다. [K04][P03]

**라이선스:** 읽은 `MIT-LICENSE.txt`는 MIT, Copyright 2018 Benjamin Eidelman이다. 실제 코드의 복사/상당 부분 재배포 시 저작권·허가 고지를 보존한다. 의존성 고지는 별도 확인한다. [K05]

**유지 비용:** ID 규칙, 배열 재정렬, 수동값 보호, JSON 보안, 적용/취소의 버전 검사. 후보 채택을 재개할 조건은 ‘단순 비교로 읽기 어려운 여러 객체 변경’이 실제 사례로 나타나는 것이다.

## K-O · OpenSpec

**고정점:** `Fission-AI/OpenSpec@9111a7654d7800391459431fff4eaf66e33a3d2e` (main 확인, 2026-10-06), package 1.14.1, archived=false. 주의: HEAD를 릴리스 안정성 보증으로 삼지 않는다. [K09]

**읽은 코드와 시험:**
- `src/core/specs-apply.ts` 1–185, 230–440: `findSpecUpdates`, `buildUpdatedSpec`의 앞부분, 경로 처리, 중복/충돌/누락 검증, 이름 대응 준비. 중간과 후반 실제 적용/쓰기까지 완독하지 않았으므로 원자적 병합 보장은 평가하지 않았다. [K06]
- `src/core/archive.ts` 1–110: `isRetirableSpec`, `describeUnaccountedContent` 등 앞부분. [K07]
- `test/core/specs-apply.requirement-name-near-miss.test.ts` 1–165: 대소문자/간격만 다른 이름의 중복 거절, 명시적 제거·rename 뒤 추가의 정상 대조. 이 테스트의 case를 우리 안정 ID·명시적 삭제 규칙으로 새로 표현하는 것이 유용하다. [K08]

**가져올 범위:** ‘ADDED/MODIFIED/REMOVED/RENAMED를 구별’, ‘연산 구역 밖 요구를 조용히 버리지 않음’, ‘해석할 수 없는 입력을 정상 갱신으로 간주하지 않음’의 검증 원리. 원문 함수를 그대로 복사하는 제안은 아니다. 현재 앱의 ID/출처/history/revision을 유지한 채 적용할 수 있다. [P04][P05]

**배제 이유:** 제목으로 요구를 식별하는 방식을 도입하면 현재 안정 ID의 장점을 잃는다. 2026-10-02 기여자 토론도 병합 방식의 대안을 검토하고 있다. 토론이 열린 상태이므로 ‘곧 폐지 예정’이라고 단정하지 않는다. 상위 템플릿이 agent에게 명세를 갱신하라고 말하는 것과 실행 코드가 검증하는 규칙도 분리해야 한다. [X07]

**의존성·호환:** Node>=20.19.0은 프로젝트의 문서상 Node와 겹친다. 그러나 CLI는 inquirer 계열, chalk, commander, cross-spawn, diff, fast-glob, ora, yaml, zod 등을 쓴다. package의 개발 TS6 계열·Vitest를 현재 TS5.8.3 앱에 통째 옮기는 제안이 아니다. 전이 라이선스/보안/번들은 감사하지 않았다. [K09][P03]

**라이선스:** 실제 LICENSE는 MIT, Copyright 2024 OpenSpec Contributors. 코드 복사 시 저작권·허가문 보존. 이번에는 설계·검사 원리 참고만 한다. [K10]

**유지 비용:** Markdown 문법의 다양성, 이름 변경, 동시에 진행되는 delta, 사후 archive와 실제 코드 사이의 시간차. 수용 기준은 ‘기존 내용 누락/명시적 삭제/구조 충돌’을 구별하는 것이며, 모든 자연어 충돌을 결정적 parser가 해결한다는 약속을 하지 않는다.

## K-C · Codex TypeScript SDK

**고정점:** `openai/codex@27065a91ccbf5ba8532844be3777fcf83b77820d` (2026-10-11). 읽은 package는 **0.0.0-dev**다. 이 값을 npm 설치 버전으로 쓰지 않는다. 공식 문서는 SDK와 exec/App Server가 서로 다른 깊이의 연결 경로임을 설명한다. [K15][C01][C02][C03]

**읽은 코드와 시험:**
- `sdk/typescript/src/thread.ts` 전체: `Thread.run`, `runStreamed`, `runStreamedInternal`, `normalizeInput`. [K11]
- `sdk/typescript/src/exec.ts` 1–285: `CodexExec.run`의 인수 생성·환경·spawn·readline·종료 정리. 뒤 TOML 직렬화/플랫폼 바이너리 해결부는 미열람. [K12]
- `sdk/typescript/src/events.ts` 전체: turn/item 종결 의미. [K13]
- `sdk/typescript/tests/abort.test.ts` 전체: 이미 취소된 신호, 실행/반복 도중 취소, 비취소 정상 결과. 모의 응답 경로이며 이번에 실행하지 않았다. [K14]

**가져올 범위:** 라이브러리 호출을 얇게 감싸고 Studio 인계 ID·revision을 외부 thread/turn 연결 옆에 보관한다. SDK의 spawn/readline을 복사하는 별도 실행기보다 official dependency 유지가 기본 후보다. 실제 어댑터나 파일을 이번에 만들지 않았다.

**추가 보호:** 문서 JSON 형식과 `as ThreadEvent`는 runtime 검증을 대체하지 않는다. 허용 이벤트, 크기, 다른 프로젝트 결과, 실패/중단 상태를 입력 경계에서 검사해야 한다. `exec.ts`는 명시 env가 없으면 부모 env를 전달한다. Studio 연결 프로그램은 필요한 환경만 보존하는 정책을 정하고, 사용자 CLI 인증을 우회 추출/서버 전송하지 않아야 한다. 키 값을 이번 조사에서 읽지 않았다. [K11][K12]

**의존성·호환:** package는 Node>=18/ESM. 읽은 dev manifest만으로 실제 배포 패키지의 CLI 바이너리 포함 방식·해시·지원 OS가 확정되지 않는다. 현재 Node22.16/TS5.8.3과의 설치·타입 검사는 후속 확인이다. 서버 전용이며 브라우저 번들에 넣는 후보가 아니다. [K12][K15][P03]

**라이선스:** root LICENSE 1–135에서 Apache-2.0와 재배포 조건을 읽었고 NOTICE 전체를 읽었다. 배포 대상에 적용되는 라이선스 사본·저작권/기여 고지·변경 파일 표시·관련 NOTICE를 보존해야 한다. NOTICE의 Ratatui 고지가 TS wrapper만의 배포에도 어느 범위로 필요한지는 실제 묶는 CLI/파일 목록으로 판단한다. 원격 서비스 이용 조건은 소스 라이선스와 별개다. [K16][K17]

**유지 비용:** provider/CLI 버전 변화, 프로세스 중단의 OS 차이, stream 오류/누락, env·권한 경계, npm release와 source pin 대응. 양방향 사용자 승인/실행 중 제어가 필요하면 처음부터 App Server 비교를 하고 사설 SDK 확장을 쌓지 않는다.

## K-E · effortless

**고정점:** `HeyCubit/effortless@0690b9cf12b6d1d286a7ceb40ee7e97ce47dd6d6` (main, 2026-10-10), archived=false. 최신 commit 메시지의 기능 설명을 코드 전체 검증으로 세지 않았다.

**읽은 코드와 시험:**
- `bench/quality.mjs` 전체: `ask`, `GRADE`, `pool`, 무작위 A/B, 판정·표 집계. [K19]
- `hooks/register.tsx` 1–160 요청 범위 중 초기 import/상태/정책을 읽음. 말미 큰 SVG 응답 잘림. 전체 Judge·handoff 알고리즘은 미열람이다. [K20]
- `tests/effortless.test.ts` 1–165: `judgeSays`, `engine`, `recordSteps`, Auto off 후 원래 effort 송신, 모델 자동 전환 off의 고정 모델 테스트. mock 결과의 기대값을 읽은 것이고 실행 통과를 확인한 것은 아니다. [K21]

**긍정적인 재사용 범위:** 수동 제어가 자동 추천을 이기는 정책, 추천 모델과 실제 요청 모델·effort를 따로 검사하는 시험 구조, A/B 순서 섞기, 오류 행의 원장 보존. 설치 UI·모델 변경 기능을 고객 앱에 즉시 추가하는 근거는 아니다.

**새로 확인한 평가기 한계 — K19에만 한정:**

| 경로 | 실제 코드의 처리 | 우리의 판정/대안 |
|---|---|---|
| grader 응답에 JSON 구역이 없음 | `tie`, `worse_is_ok:true` 대체값 | 평가불능으로 분리. 동점과 합치지 않음 |
| JSON 구역은 있지만 파싱 실패 | catch 후 error row | 실패 원장은 보존하되 전체 건수/성공 건수와 함께 제시 |
| `worse_is_ok`가 생략/잘못된 값 | `!== false`로 관대하게 허용될 수 있음 | 명시 boolean과 enum 검증 |
| 비용 표 | baseline/routed 비용 집계, grader 비용은 표에 합산 안 함 | 품질 측정 비용과 실행 비용을 분리·명시. 전부 포함했다고 말하지 않음 |
| router 평가처럼 읽힐 수 있는 명칭 | case 파일에 이미 적힌 route 사용 | 답변 품질 비교와 live Judge 선택 정확도는 별도 평가 |

이 결과로 README의 별도 agentic 실험 전체가 틀렸다고 결론내리지 않는다. 그 runner/원장/채점기는 별도 미열람 범위다. 또한 `Math.random()`으로 A/B를 섞는 것과 재현 가능한 seed/순서 기록을 제공하는 것은 다르다. [K19]

**의존성·호환:** 읽은 root 목록에 일반 앱 package.json은 없고, 런타임/테스트는 `claude-code` 및 `claude-code/testing` API를 import한다. 이 엔진·버전 계약과 브라우저 호환을 검증하지 않았다. 현재 TypeScript라는 공통점만으로 native DOM 앱에 붙일 수 있는 패키지가 아니다. 비용/캐시/모델 상수를 공식 provider 지원값처럼 재사용하지 않는다. [K20][K21]

**라이선스:** MIT, Copyright 2026 HeyCubit를 LICENSE에서 확인했다. 복사할 코드에는 해당 고지를 보존해야 하며 플러그인의 MIT가 의존 엔진/로그인/모델 서비스 사용을 포괄 허용하지 않는다. [K22][C05]

**유지 비용:** provider별 지원 변화, 긴 단일 진입 파일에서 정책과 렌더링 분리, judge 지연/오류, 실제 사용량 계측. 즉시 필요한 것은 실패 판정 규칙 참고이지 새로운 Judge 호출 추가가 아니다.

## 범위를 제한한 후보

**Claude Agent SDK:** 공식 연결 후보지만 이번에는 문서/README/목록까지다. 내부 구현·npm 배포물·테스트·파일별 라이선스 확인 전에는 ‘코드 복사 가능 후보’로 올리지 않는다. 사용 약관 경계는 C05에 명시되어 있다. [C05][C07]

**GOV.UK/Linear/Lovable:** 화면 메커니즘 후보다. 코드/컴포넌트/자산을 통째 배포하는 라이선스 검토는 하지 않았다. GOV.UK 페이지의 문서 고지와 별도 npm 컴포넌트 라이선스를 혼동하지 않는다. [A02][A06][A07]

**Spec Kit·JSON Forms·Promptfoo·Durable Streams·Yjs 등:** 초기 기획/기존 요약에서 언급된 후보지만 이번 신규 심층 채택 대상으로 올리지 않았다. 현재 좁은 고객 흐름에 필요한지 먼저 판단하고, 이름이 나온다는 이유로 설치하지 않는다. 특히 과거 버전/라이선스 판단을 최신 사실로 복사하지 않았다. [P10]


---
출처 링크(열람 범위·한계는 `01_SOURCE_MAP.md` 참조)

[A02]: https://lovable.dev/en/blog/versioning-with-lovable-two-point-zero
[A06]: https://linear.app/developers/agent-interaction
[A07]: https://design-system.service.gov.uk/patterns/check-answers/
[C01]: https://learn.chatgpt.com/docs/codex-sdk
[C02]: https://learn.chatgpt.com/docs/app-server
[C03]: https://learn.chatgpt.com/docs/non-interactive-mode
[C05]: https://code.claude.com/docs/en/agent-sdk/overview
[C07]: https://github.com/anthropics/claude-agent-sdk-typescript
[K01]: https://github.com/benjamine/jsondiffpatch/blob/a60db8a232f92ee4b987c14f43f77402885d1a5a/packages/jsondiffpatch/src/filters/arrays.ts
[K02]: https://github.com/benjamine/jsondiffpatch/blob/a60db8a232f92ee4b987c14f43f77402885d1a5a/packages/jsondiffpatch/src/diffpatcher.ts
[K03]: https://github.com/benjamine/jsondiffpatch/blob/a60db8a232f92ee4b987c14f43f77402885d1a5a/packages/jsondiffpatch/test/index.spec.ts
[K04]: https://github.com/benjamine/jsondiffpatch/blob/a60db8a232f92ee4b987c14f43f77402885d1a5a/packages/jsondiffpatch/package.json
[K05]: https://github.com/benjamine/jsondiffpatch/blob/a60db8a232f92ee4b987c14f43f77402885d1a5a/MIT-LICENSE.txt
[K06]: https://github.com/Fission-AI/OpenSpec/blob/9111a7654d7800391459431fff4eaf66e33a3d2e/src/core/specs-apply.ts
[K07]: https://github.com/Fission-AI/OpenSpec/blob/9111a7654d7800391459431fff4eaf66e33a3d2e/src/core/archive.ts
[K08]: https://github.com/Fission-AI/OpenSpec/blob/9111a7654d7800391459431fff4eaf66e33a3d2e/test/core/specs-apply.requirement-name-near-miss.test.ts
[K09]: https://github.com/Fission-AI/OpenSpec/blob/9111a7654d7800391459431fff4eaf66e33a3d2e/package.json
[K10]: https://github.com/Fission-AI/OpenSpec/blob/9111a7654d7800391459431fff4eaf66e33a3d2e/LICENSE
[K11]: https://github.com/openai/codex/blob/27065a91ccbf5ba8532844be3777fcf83b77820d/sdk/typescript/src/thread.ts
[K12]: https://github.com/openai/codex/blob/27065a91ccbf5ba8532844be3777fcf83b77820d/sdk/typescript/src/exec.ts
[K13]: https://github.com/openai/codex/blob/27065a91ccbf5ba8532844be3777fcf83b77820d/sdk/typescript/src/events.ts
[K14]: https://github.com/openai/codex/blob/27065a91ccbf5ba8532844be3777fcf83b77820d/sdk/typescript/tests/abort.test.ts
[K15]: https://github.com/openai/codex/blob/27065a91ccbf5ba8532844be3777fcf83b77820d/sdk/typescript/package.json
[K16]: https://github.com/openai/codex/blob/27065a91ccbf5ba8532844be3777fcf83b77820d/LICENSE
[K17]: https://github.com/openai/codex/blob/27065a91ccbf5ba8532844be3777fcf83b77820d/NOTICE
[K19]: https://github.com/HeyCubit/effortless/blob/0690b9cf12b6d1d286a7ceb40ee7e97ce47dd6d6/bench/quality.mjs
[K20]: https://github.com/HeyCubit/effortless/blob/0690b9cf12b6d1d286a7ceb40ee7e97ce47dd6d6/hooks/register.tsx
[K21]: https://github.com/HeyCubit/effortless/blob/0690b9cf12b6d1d286a7ceb40ee7e97ce47dd6d6/tests/effortless.test.ts
[K22]: https://github.com/HeyCubit/effortless/blob/0690b9cf12b6d1d286a7ceb40ee7e97ce47dd6d6/LICENSE
[P03]: https://github.com/tlsee0813-cmd/agentflow-studio/blob/6666c6bd35a1a01419d3a082b6dfc776ce3db717/app/continuity/README.md
[P04]: https://github.com/tlsee0813-cmd/agentflow-studio/blob/6666c6bd35a1a01419d3a082b6dfc776ce3db717/app/continuity/src/shared/types.ts
[P05]: https://github.com/tlsee0813-cmd/agentflow-studio/blob/6666c6bd35a1a01419d3a082b6dfc776ce3db717/app/continuity/src/shared/domain.ts
[P10]: https://github.com/tlsee0813-cmd/agentflow-studio/blob/6666c6bd35a1a01419d3a082b6dfc776ce3db717/docs/research/reuse-findings.md
[X07]: https://github.com/Fission-AI/OpenSpec/issues/2033
