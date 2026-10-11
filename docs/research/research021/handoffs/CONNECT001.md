# CONNECT001에 전달할 참고안 — 지금 적용 후보 최대 3개

상태: **연구 제안 / 미확정 / 실행 없음**. CONNECT001의 공식 연동 연구를 대체하지 않는다. 아래의 ‘지금’은 연결 설계에 반영할 판단이며, 제품 어댑터 구현·키 접근·유료 실험 승인이 아니다.

## C21-1 · 관측인지 새 실행인지 먼저 나누고 공식 경로 하나로 좁히기

**불편:** ‘CLI 연결’이 기존 작업의 읽기인지, 새로운 모델 호출/코드 변경 실행인지 불분명하면 권한과 비용 경계가 사라짐.

**기존 해결책:** Codex SDK/exec, 더 깊은 양방향 App Server, Claude hooks/Agent SDK의 서로 다른 표면. [C01][C02][C03][C04][C05]

**최소 범위:** 하나의 사용자 행동에 대해 후보 경로를 선택한다. 단순 새 작업 호출/결과 수집에는 official SDK wrapper를, 진행 중 제어·승인이 핵심이면 App Server를 비교한다. 기존 세션을 읽는 요청에 resume/start를 자동 붙이지 않는다. Claude 로컬 사용자 도구 관측과 고객용 SDK 서비스를 분리한다.

**유지 비용:** CLI/SDK 지원 버전·실제 배포물 확인, auth/permission/OS 차이. Codex WebSocket experimental/unsupported 표시와 Anthropic의 제3자 claude.ai 로그인 제공 제한을 제품 조건으로 남긴다. 소비자 구독 한도를 API 크레딧으로 환산하지 않는다. [C02][C05]

**범위 밖:** 터미널 스크래핑, 비공식 JSONL 수정, 자격증명 복사, 공개 포트, 공급자 런타임 재작성.

## C21-2 · 도구 생명주기 영수증과 고객 완료를 분리

**불편:** turn/item 종료를 ‘요구 구현 완료’로 잘못 표시할 위험.

**기존 해결책:** Codex 이벤트 타입의 종결 의미, Claude routines가 구분하는 run 종료와 실제 성공, 현 앱의 revision/인계 기록. [K13][C06][P04][P05]

**최소 범위:** 인계 ID/revision와 provider thread/turn 등의 실제 반환 식별자를 연결한다. 원 이벤트 종류·성공/실패/중단·수신 시각·관측 범위를 보존하고, 현재 작업 반영은 별도 검증 경계를 거친다. 표면 계약은 IDEA020/총괄과 맞추되 새 범용 event bus를 먼저 만들지 않는다.

**유지 비용/확인 관점:** 오래된 인계의 늦은 결과, 같은 결과 재수신, 다른 작업공간, 취소 뒤 도착한 이벤트, 파싱 오류에서 잘못된 상태 승격이 없어야 한다. 실제 API가 제공하지 않는 ID/순서 값은 지어내지 않는다.

**범위 밖:** 실행 보고를 서명된 객관 사실로 취급, 각 이벤트마다 AI 판단 호출, 전체 테스트/요구 자동 PASS.

## C21-3 · 작은 변경 신호 + 제한된 재조회, 무손실 관측은 미확인으로

**불편:** 파일 하나 바뀔 때마다 전체 요구를 재작성하면 노이즈·비용·수동값 손상이 늘어남.

**기존 해결책:** 공식 hooks의 특정 도구/파일 사건, Codex의 저장 thread 읽기, Linear의 일시적 활동 요약. [C04][C02][A06]

**최소 범위:** 승인된 작업공간과 관련 파일/인계에 대해서만 신호를 연결하고, 의미를 판단할 수 없으면 검토 자료로 둔다. FileChanged를 무제한 저장소 감시자로 오해하지 않는다. 연결 단절 뒤에는 ‘연속 관측 중단/새 확인 필요’를 표시할 수 있어야 한다. 누락 복구를 검증하기 전 ‘실시간 완전 동기화’라고 말하지 않는다.

**유지 비용/확인 관점:** 실제 provider 세션 범위, 재연결/누락/중복, 읽기 권한, 파일→요구 대응의 오경보. 합성 event fixture로 프로그램 경계를 먼저 검사하는 것은 가능하나, 이를 실제 provider 통합 성공으로 표시하지 않는다.

**범위 밖:** CRDT·분산 스트림·전 파일 감시·전 자동 의미 동기화. 이 조사에서 별도 연결 실험 코드를 만들지 않았다.

## 나중으로 미룰 것

상시 다중 에이전트 조율, 원격 호스트, managed schedule/routines 재구현, 자동 모델 전환, 비용 최적화 확약, 전역 파일 복구. 후속 읽기 목록은 `09_FOLLOWUP_PACKAGES.md`의 F21-1/F21-5를 사용하되, CONNECT001이 이미 해결한 범위는 재조사하지 않는다.


---
출처 링크(열람 범위·한계는 `01_SOURCE_MAP.md` 참조)

[A06]: https://linear.app/developers/agent-interaction
[C01]: https://learn.chatgpt.com/docs/codex-sdk
[C02]: https://learn.chatgpt.com/docs/app-server
[C03]: https://learn.chatgpt.com/docs/non-interactive-mode
[C04]: https://code.claude.com/docs/en/hooks
[C05]: https://code.claude.com/docs/en/agent-sdk/overview
[C06]: https://code.claude.com/docs/en/routines
[K13]: https://github.com/openai/codex/blob/27065a91ccbf5ba8532844be3777fcf83b77820d/sdk/typescript/src/events.ts
[P04]: https://github.com/tlsee0813-cmd/agentflow-studio/blob/6666c6bd35a1a01419d3a082b6dfc776ce3db717/app/continuity/src/shared/types.ts
[P05]: https://github.com/tlsee0813-cmd/agentflow-studio/blob/6666c6bd35a1a01419d3a082b6dfc776ce3db717/app/continuity/src/shared/domain.ts
