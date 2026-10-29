# 102 구현 결정 — 내구 작업 소유자에 연결한 로컬 CLI preview 실행자

[101 DESIGN](../2026-10-29-owned-cli-contract-101/DESIGN.md)과 [WORK_ORDER_102](../2026-10-29-owned-cli-contract-101/WORK_ORDER_102.md)의 구현 결정이다. 기준은 357e9a301fc910c95a3522de3564a9f02863b3ba(app 3fc2ab0421cda167bd3fbb70c5eaa2a2e9dcc0e5). 모델·CLI 생성 호출은 0이다.

## 연결 경계

- `createStudioHandler({ jobs, mapExecutor })`: 서버 코드만 실행자를 줄 수 있다(env·브라우저 입력 없음). 실행자는 **지도 작업(jobs)에만** 쓰인다. `/ask`·`/plan`·`/scope`·`/digest`·동기 `/map`은 기존 DeepSeek 키 조건 그대로다. 실행자가 없거나 job store가 없으면 기존 경로와 status가 바이트 단위로 같다.
- status: `ai`는 DeepSeek 키만 말한다. 실행자가 준비되면 `map: { model, prompt, via: 'jobs' }`, `jobs.executor: { id, model, state, problem, policy }`. state는 ready/unverified/busy/unsettled/unavailable. 다른 공급자 fallback은 없다(실행자 불가면 map 자체를 광고하지 않는다).
- map-jobs: 선택적 `run.prepare(ask)`가 접수 때 실행 binding(실행자 ID·CLI 판본·binary SHA-256·model·reasoning·인자 template hash·wrapper hash·prompt hash·299/300 정책·전체 policy hash)을 원 operation 파일에 함께 원자 저장한다. 조회·재시작·keyoff에서 현재 설정으로 바꾸지 않는다. 실행 관측(시각·종료 방식·usage; 출력·경로 없음)은 같은 binding 아래 저장한다. binding이 없는 100 기록은 당시 HTTP 계약으로 읽힌다.
- client: `map.via === 'jobs'`이면 지도 버튼은 내구 작업으로만 동작하고 동기 `/map`은 부르지 않는다. 헤더는 ai=off여도 `지도 정리만 가능`으로 표시하고 질문·계획·결과 정리는 꺼진 채 둔다.
- 실행자는 `docs/cycles/2026-10-29-owned-cli-preview-102/preview/`에 격리된 Node 전용 모듈이며 launcher(`serve-preview.mjs`)만 import한다. `server/index.mjs`·`worker.mjs`·`studio.mjs`는 child_process나 이 경로를 import하지 않는다.

## 입력과 결과

- stdin은 96 실행기의 고정 wrapper 그대로: prefix + 현재 `map6Prompt(ask)`(98 FIRST, m6-177d450624b5) + suffix + `JSON.stringify(ask)`(뒤 개행 없음). wrapper hash를 binding에 넣는다. 첫 지도(FIRST map.6)만 받는다(`EXECUTOR_SCOPE`).
- ready는 exit 0, 허용 event(thread/turn/item, item은 agent_message·reasoning만), turn.completed, final 파일 = 마지막 agent_message byte 일치, fatal UTF-8, stdout 512KiB/stderr 128KiB/final 128KiB, JSON, `validateMapReply(wire, ask)`를 모두 통과한 원 wire만. 수선·필터·요약 대체 없음. tool/error/unknown event는 거절.

## 시간 정책

- child는 299,000ms 선택 구간 안에 close되어야 한다. 모든 결정(거절·close 미수신 포함)은 300,000ms에서 100ms 여유를 둔 시각까지 내린다. 디스크 ready 저장·OS 종료(settled)는 이 보장 밖이며 따로 관측한다.
- lease 기록·binary 재확인 뒤 child를 시작하기 직전에 취소 또는 선택 예산 소진을 다시 보고, 해당하면 child를 시작하지 않는다(lease는 never-started로 해제).
- CLI 토큰·과금 hard cap은 미확인이다. 출력 byte·시간 제한은 토큰/과금 한도가 아니다.

## 수명·입장(global 1 / queue 0 / retry 0)

- 실행자 상태 폴더는 job store와 같은 OS 소유권(Linux abstract socket, Windows named pipe)으로 한 프로세스만 연다. 포트가 달라도 같은 상태 폴더면 두 번째 launcher는 실행자 없음이다.
- child(버전 probe 포함)마다 시작 전에 내구 lease를 쓰고, child가 사라졌음이 확인되고 결과 소비가 끝난 뒤에만 lease·run 폴더를 지운다. 이 사이에는 다른 ID도 입장하지 못한다.
- POSIX: child는 자기 process group의 leader다. 신호는 leader가 reap되기 전(exit 미관측)에만 group에 보낸다. 그 뒤에는 숫자로 신호하지 않고 `kill(-pgid, 0)` probe만 한다. group이 비지 않으면 unsettled로 남는다(fail closed). Windows: child만 종료 요청하고 close로 판단한다(group 추적 없음).
- 재시작: 남은 lease는 Linux boot_id가 다르거나 POSIX group probe가 ESRCH일 때만 자동 해제한다. pid 없는 lease, Windows의 lease, 손상 lease는 운영자 확인(`reconcile-lease.mjs --attest-closed`, 상태 폴더 소유 중에는 거절) 전까지 모든 새 ID를 거절한다. 100의 interrupted 표시만으로 슬롯을 비우지 않는다. 어떤 lease의 pid/group도 kill하지 않는다.
- binary: 열 때·접수 때·시작 직전에 파일 SHA-256을 다시 확인한다. Linux에서는 job child가 입력을 받기 전에 `/proc/<pid>/exe`를 hash하고, 그 확인이 끝날 때 leader가 reap되지 않았을 때만 입력을 쓴다. Linux 외에서는 마지막 hash와 exec 사이의 교체를 탐지하지 못한다. CLI가 다른 실행 파일(helper)을 부르는 경우는 확인 범위 밖이다.
