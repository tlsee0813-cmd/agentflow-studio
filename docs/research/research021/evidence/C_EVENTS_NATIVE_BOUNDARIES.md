# C · 이벤트, 변경 감지와 재사용 가능한 연결

## 먼저 서로 다른 세 연결을 분리

아래 분류는 우리의 설계 제안이다. **기존 도구에서 사용자가 이미 하는 일을 관측**, **Studio가 새 실행을 시작**, **Studio 내부 기록만 수정**은 권한·비용·성공의 의미가 다르다. 단일 ‘연결됨’ 토글로 합치지 않는다. 이 조사에서는 어느 연결도 실제 설치/실행하지 않았다.

## 제공자가 이미 하는 것

| 제공자 경로 | 공식 확인한 표면 | 재구현하지 않을 것 | 남아 있는 Studio 고객 문제 |
|---|---|---|---|
| Codex SDK/exec | TS SDK start/run/resume, JSONL, 취소 신호, output schema | 모델 루프·CLI 실행 포장·자체 대화 엔진 | 어떤 인계 revision의 결과인지, 수동값과 충돌하는지 |
| Codex App Server | thread/turn/item, 지침/이력 읽기, 진행 중 추가 입력·중단, 승인 관련 양방향 API | 자체 Codex wire protocol과 터미널 화면 스크래핑 | 관측과 제어 권한 분리, 실행 상태→요구 수용의 연결 |
| Claude Code | 메모리·세션·체크포인트·hooks | 일반적 세션 메모리·비공식 JSONL 수정·전체 rewind | 다른 도구로 넘기는 기준·범위·보고 연결 |
| Claude Agent SDK / routines | 세션/도구/권한/실행 구조, 관리 실행의 상태 | 독자적인 다중 실행 런타임·스케줄러를 먼저 만드는 일 | 코드 수행 결과와 고객의 완료 기준을 대조 |

이 표는 기능군의 존재만 요약한다. 호환 버전·설치 환경·제품 사용 허락까지 승인했다는 뜻이 아니다. [C01][C02][C03][C04][C05][C06][B01][B02]

## Codex: 실제 코드를 읽은 결과

고정 commit `27065a91ccbf5ba8532844be3777fcf83b77820d`의 `Thread.runStreamedInternal`은 exec 스트림을 읽고 thread ID를 저장하며 출력 스키마 임시 자원을 정리한다. `run`은 결과 항목/마지막 응답/usage를 모으고 turn 실패를 오류로 올린다. `CodexExec.run`은 인수·환경·프로세스·줄 단위 출력·종료를 담당한다. 이 코드를 복사해 새로운 실행기를 만들기보다 제공자 어댑터에서 공식 패키지를 감싸는 선택이 먼저다. [K11][K12]

중요한 경계 두 가지가 있다. 첫째, 이 TS 코드의 JSON 파싱은 `as ThreadEvent` 타입 단언이며 자체 런타임 스키마 검증이 아니다. 둘째, `item.completed`는 성공뿐 아니라 실패의 종결도 포함한다. 따라서 앱의 ‘요구 충족’이나 ‘통합 완료’에 직결하면 안 된다. `AbortSignal` 관련 테스트는 선행/도중 취소와 정상 대조를 실제 mock 경로로 검사한다. 테스트를 읽었지만 실행하지 않았다. [K11][K13][K14]

공식 App Server에서 저장 이력 읽기(`thread/read`)와 실행 재개/구독은 다르다. 진행 중 입력은 `expectedTurnId`를 가진 `turn/steer` 경로이고, 중단 요청과 최종 interrupted 상태도 분리된다. WebSocket 경로는 문서에서 experimental/unsupported로 표시돼 있다. 설치 CLI가 생성한 스키마에 맞춰 확인해야 하며 공개 원격 포트를 여는 기본 설계로 쓰지 않는다. [C02]

**추천:** 연결 검토의 첫 경로는 사용 사례에 따라 공식 SDK 또는 로컬 stdio App Server 중 하나로 좁힌다. ‘App Server가 있으면 기존 모든 CLI 세션을 무손실로 자동 감시’한다는 가정은 금지한다. 중간 연결 단절 뒤 누락 복구·동일 세션 공유 범위는 후속 독립 읽기/합성 실험 대상으로 남긴다. 더 큰 실행 UI가 필요하지 않으면 SDK의 단순성이 유리하고, 실행 중 양방향 제어가 필수라면 SDK에 사설 우회 제어를 얹기보다 App Server를 비교한다.

## Claude: hooks를 읽었다고 전 파일 감지가 구현되는 것은 아니다

공식 hooks 문서에서 `FileChanged`의 matcher는 watch 목록을 만들 때 `|`로 나눈 **literal 파일 이름**이다. 이때 regex를 넣으면 그 이름의 파일을 보려는 의미가 될 수 있다. 동적 watchPaths 경로도 있지만, 이를 범용 저장소 전체 변경 피드로 해석해서는 안 된다. PostToolUse와 Stop 역시 도구/응답 경계이며 요구 충족 증거가 아니다. 실제 설치 버전과 활성 설정 범위를 확인해야 한다. [C04]

**인증 경계:** Claude Agent SDK 공식 안내는 사전 승인이 없는 제3자 제품에서 claude.ai 로그인 또는 한도를 제공하는 경로를 허용된 기본값으로 안내하지 않는다. API 키 방식 등을 안내한다. 개인 로컬 Claude 도구를 쓰는 시나리오와, Studio가 고객에게 운영하는 SDK 기반 서비스를 구분해야 한다. effortless의 개인 플러그인 설명을 고객용 SaaS 인증 허락으로 옮기지 않는다. [C05][K18]

Claude TS SDK는 README/예제 목록 수준만 확인했다. 내부 엔진을 공개 소스처럼 복사 가능한 것으로 가정하지 않는다. 반면 공식 routines 문서는 green run이 인프라 실행 종료이지 prompt의 실질 성공을 뜻하지 않는다고 직접 구분한다. 이 구분은 Studio만의 새 발명이라고 주장할 것이 아니라 현재 공식 도구도 요구하는 경계로 받아들이면 된다. [C06][C07]

## 이벤트를 고객에게 전달하는 최소 구조 — 제안

**이벤트 기록:** 제공자·설치 버전·프로젝트/작업 연결·실행/turn 식별자·발생 시각과 수신 시각·원 이벤트 종류·관측 범위. 제공자가 주지 않은 순서 번호/이벤트 ID/신뢰도는 지어내지 않는다.

**수신:** 같은 이벤트 재수신을 중복 반영하지 않고, 오래된 인계의 결과를 최신 작업에 덮어쓰지 않는다. 큐 저장·검증·화면 갱신을 구별한다. 마지막 이벤트 ID를 기억했다는 사실만으로 처리 완료 ACK나 누락 없는 재생을 보장하지 않는다. 현재 앱의 revision/late-response 보호 원리를 재사용하되 새 연결 계약은 CONNECT001·총괄이 확정한다. [P04][P05]

**고객 표시:** 평상시 진행 신호는 한 줄로 갱신하고, 실제 판단이 필요한 차이만 현재 작업 옆에 둔다. 예: ‘이전 인계 v7의 보고가 도착함—현재 작업 v9에는 자동 반영하지 않음’. 상세에서는 대상 인계·원 보고·확인 근거를 열 수 있게 한다. 이벤트 원문 전체를 초보자에게 읽게 하지는 않는다.

**관측의 끝:** 파일 변경 이벤트→파일이 바뀌었다는 후보 신호; 실행 종료→프로세스/turn 종료; 검사 통과→특정 버전·환경·검사 범위에서의 결과. 어느 단계도 자동으로 모든 요구가 충족됐다는 뜻은 아니다. 관측 자료를 묶은 검사·사람의 수용을 필요한 범위에서 연결한다. 단, 단순 문구 수정까지 항상 다른 모델의 승인을 요구하지 않는다.

이 구조는 CloudEvents/Kafka/새 DB를 도입하라는 제안이 아니다. 현재 단일 앱에 충분한 작은 어댑터/버전 검사로 해결될 때 대형 이벤트 플랫폼은 유지 비용만 늘어난다. 모델에 모든 파일 이벤트를 보내는 설계도 정보 노출·노이즈·비용 때문에 후순위다.

## effortless는 연결 엔진이 아니라 정책/평가 참고

실제 `bench/quality.mjs`의 무작위 A/B 순서, 답변 모델 기록, 오류 행 보존은 참고할 수 있다. 그러나 경로가 case 파일에 지정돼 있어 이 스크립트만으로 live effort judge 정확도를 입증하지 않는다. 파싱 실패와 평가 불확실성을 성공 계열에 흡수하지 않는 규칙을 별도로 세워야 한다. 전체 agentic 벤치의 타당성까지 이 파일 하나로 부정하지도 않았다. [K19]

프로덕션 진입 파일은 `claude-code` 엔진 API에 의존한다. 읽은 테스트는 Auto off 뒤 이전 Judge 값이 아니라 앱의 effort가 실제 step으로 전달되는지를 mock으로 검사한다. 이 **추천값/수동값/전송값을 따로 검증하는 메커니즘**은 좋지만, Claude 모델·cache 상수·UI 렌더러를 현재 native DOM 앱에 옮길 이유는 없다. 전체 런타임/함수 구현은 읽지 않았다. [K20][K21]


---
출처 링크(열람 범위·한계는 `01_SOURCE_MAP.md` 참조)

[B01]: https://code.claude.com/docs/en/memory
[B02]: https://code.claude.com/docs/en/checkpointing
[C01]: https://learn.chatgpt.com/docs/codex-sdk
[C02]: https://learn.chatgpt.com/docs/app-server
[C03]: https://learn.chatgpt.com/docs/non-interactive-mode
[C04]: https://code.claude.com/docs/en/hooks
[C05]: https://code.claude.com/docs/en/agent-sdk/overview
[C06]: https://code.claude.com/docs/en/routines
[C07]: https://github.com/anthropics/claude-agent-sdk-typescript
[K11]: https://github.com/openai/codex/blob/27065a91ccbf5ba8532844be3777fcf83b77820d/sdk/typescript/src/thread.ts
[K12]: https://github.com/openai/codex/blob/27065a91ccbf5ba8532844be3777fcf83b77820d/sdk/typescript/src/exec.ts
[K13]: https://github.com/openai/codex/blob/27065a91ccbf5ba8532844be3777fcf83b77820d/sdk/typescript/src/events.ts
[K14]: https://github.com/openai/codex/blob/27065a91ccbf5ba8532844be3777fcf83b77820d/sdk/typescript/tests/abort.test.ts
[K18]: https://github.com/HeyCubit/effortless/blob/0690b9cf12b6d1d286a7ceb40ee7e97ce47dd6d6/README.md
[K19]: https://github.com/HeyCubit/effortless/blob/0690b9cf12b6d1d286a7ceb40ee7e97ce47dd6d6/bench/quality.mjs
[K20]: https://github.com/HeyCubit/effortless/blob/0690b9cf12b6d1d286a7ceb40ee7e97ce47dd6d6/hooks/register.tsx
[K21]: https://github.com/HeyCubit/effortless/blob/0690b9cf12b6d1d286a7ceb40ee7e97ce47dd6d6/tests/effortless.test.ts
[P04]: https://github.com/tlsee0813-cmd/agentflow-studio/blob/6666c6bd35a1a01419d3a082b6dfc776ce3db717/app/continuity/src/shared/types.ts
[P05]: https://github.com/tlsee0813-cmd/agentflow-studio/blob/6666c6bd35a1a01419d3a082b6dfc776ce3db717/app/continuity/src/shared/domain.ts
