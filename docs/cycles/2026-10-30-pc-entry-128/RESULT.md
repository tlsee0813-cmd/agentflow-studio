# 128 결과 — 설치된 Codex로 시작하는 선택형 PC 입구 (작성자 구현·fixture 검증)

단일 작성자(Claude Code)의 결과다. 실제 Windows PC 확인·고정 정책 실물 대조·독립 검토·최종 CI는 Root 담당이며 아직이다. **새 AI 생성 0**(시작·health·version probe 포함 실제 CLI 실행 0), 104·121·122 재실행 0, 설치·로그인·계정·키·기본 공급자 변경 0. 기본 `start-local.ps1`(DeepSeek)·Worker·공개73/127은 바꾸지 않았다. 결정은 [DESIGN.md](DESIGN.md).

## 판본

- 기준 8d41378581e6e999e54747ae9eaac4973eae94a9(app d5a6be031fb06b925a1511e06c5845f15d56ec14), branch `work/experience128-pc-entry`.
- 코드·검사 SHA a967c993a44bf6d16fa618f650f7f958c24045d9 (app tree a4d9efc0fb1a20d70245ea3529b8765473e0fe9f). 그 뒤 커밋은 이 문서뿐이다.

## 사용법

`app/`에서, 빌드 후 PowerShell: `./continuity/scripts/start-pc.ps1`(시작/다시 열기), `-CodexPath '…\codex.exe'`(못 찾을 때), `-Stop`(종료), `-Stop -InterruptRunning`(실행 중 정리를 결과 없이 중단하고 종료). 주소 `http://127.0.0.1:4327`. 자세한 문구는 `app/continuity/README.md`.

## 바뀐 곳

- `app/continuity/scripts/pc-entry.mjs`(새, Node): `check`/`serve`/`stop`. 기존 `createContinuityApp`·studio handler·AF100 job store·AF102 `openCliExecutor`를 그대로 조립한다.
  - 정책: [ACCEPTED_POLICY.json](ACCEPTED_POLICY.json)과 같은 고정 값(실행 파일 경로만 이 PC에서 정함). binary SHA-256 5c1b…3f, codex-cli 0.165.0-alpha.1.2, gpt-6.1-sol/high, 299초 선택/300초 판정, 같은 격리 인자, scope map7-later. 명령줄에는 정책·모델·인자를 바꾸는 옵션이 없다(모르는 옵션은 거절).
  - 실행 파일: `--codex`로 지정하거나, PATH의 `codex(.exe)`와 Windows npm 전역 패키지의 vendor `codex.exe`만 본다. 바이트 SHA-256이 고정 값과 같은 것만 쓴다(실행해서 고르지 않음). 없으면 설명하고 멈춘다(exit 3).
  - 포트의 서버를 이 입구로 보는 조건: status의 실행자 ID·scope·model·정책 identity(12자) 일치, job store durable, 그리고 이 입구의 job store와 실행자 상태 폴더를 실제로 누군가 소유 중. 하나라도 아니면 다른 서버로 보고 멈춘다(exit 4).
  - 시작: job store나 실행자 상태를 다른 프로세스가 소유하면 서버를 띄우지 않는다. 미확정 lease가 있으면 그대로 띄우되 새 지도 정리는 닫힌 상태로 알린다(lease는 건드리지 않음).
  - 종료: 실행마다 임의 nonce를 run 파일에 쓰고, `stop`은 그 nonce를 담은 요청 파일만 쓴다. 해당 run만 순서대로 끝난다(102의 store fence → child 대기 → lease 해제 → 소유 해제). 프로세스에 신호를 보내거나 죽이지 않는다. 실행 중이면 `--interrupt-running` 없이 거절.
- `app/continuity/scripts/start-pc.ps1`(새): Node를 찾아 `check` → 비어 있으면 `serve`를 `Start-Process -WindowStyle Hidden`으로 → `check`가 ours가 될 때까지 대기 → 브라우저. 한국어 안내. 선택 DeepSeek 키는 `--env-file-if-exists`로 Node만 읽는다.
- `cli-executor.mjs`: 정책 identity 계산을 `policyHash()`로 꺼냈다(같은 계산, 실행자도 이것을 쓴다). 계약 변경 없음.
- README 사용법, 검사 `pc-entry128.test.mjs`, UI 제어 fixture `check-entry-ui.mjs`.

## 작성자 검사 (Linux 원격 컨테이너, Node v22.22.0, 잠긴 TS 5.8.3 — 제어 fixture)

정확 a967c99, 작업 트리 clean, `AI_MODE=mock`·`ALLOW_PAID_AI=false`·키 없음. 실행 명령은 `app/`에서:

| 단계 | 결과 |
|---|---|
| `node continuity/scripts/build.mjs` / `node continuity/scripts/check.mjs` (TS 5.8.3) | 통과 / 통과 |
| `node --test continuity/tests/{pc-entry128,owned-cli102,owned-cli102-process,owned-cli112,condition116,condition118,source-entry114}.test.mjs` | 68/68, 154초 |
| `node continuity/scripts/deploy-cloudflare.mjs --dry-run` | 통과. `worker.mjs`·`index.mjs`·`studio.mjs`는 `pc-entry`/`cli-executor`를 import하지 않음 |
| `node ../docs/cycles/2026-10-30-pc-entry-128/check-entry-ui.mjs` (Chromium 1280×720) | 통과: job POST 0, child 0 |
| 종료 뒤 가짜 CLI·pc-entry 프로세스 | 0 |

pc-entry128(8건): 고정 정책 = ACCEPTED_POLICY(경로 제외), 모르는 binary 실행 없이 거절(지정·PATH·npm vendor, `.cmd` 제외, 명령줄 정책 옵션 거절), 포트 free/ours/other(기본 서버·다른 경로 정책·같은 status를 흉내만 내는 서버) 구별, nonce 종료·다시 열기 뒤 보관 결과 동일·생성 0, 실행 중 종료 거절과 명시 중단 뒤 interrupted, 오래된 run 파일·다른 서버에는 종료 요청이 닿지 않음, 미확정 lease 유지·새 지도 닫힘, 다른 프로세스가 소유한 store/state 위에 서버를 띄우지 않음. 네 가드(상태 소유 확인·nonce·실행 중 거절·hash)를 각각 제거하는 mutation은 해당 검사를 실패시켰다.

UI fixture: 헤더 `지도 정리만 가능`(title에 범위 `첫 지도와 이후 기록·요청 대조까지`와 다른 기능 off), 새 프로젝트 → 기록 붙여넣기·저장 → `기록으로 지도 정리` 버튼 활성(누르지 않음), 질문 버튼 없음, 순서 종료 → 같은 주소 재시작 → 같은 프로젝트·기록과 버튼.

제어 fixture의 의미: 이 Node binary의 복사본을 codex 자리에, 102 테스트의 무해 가짜 CLI를 응답자로 썼다. 실제 codex 판본·hash·인자 동작은 여기서 실행하지 않았고 고정 정책은 자료로만 대조했다.

## Root 대기 / 미확인

- `start-pc.ps1`은 이 환경에 PowerShell이 없어 실행하지 못했다. Windows에서의 Hidden 시작·다시 열기·`-Stop`·한국어 출력, 실제 설치 경로 탐색(PATH/`%APPDATA%\npm` vendor)과 실제 binary hash 일치는 Root PC 확인이 필요하다.
- 실제 설치 Codex로 정상 시작 → 정확 실행자 → 원문 입력까지의 실사용 증거는 Root 몫이다. 이 결과의 UI 확인은 fixture다.
- 4327은 4317(기본)과 다른 주소라 브라우저 저장이 다르다. 4317의 기존 프로젝트를 쓰려면 백업 내보내기/가져오기가 필요하다(자동 이전 없음).
- 첫 지도 일반성·생성 품질·두 자료의 최신 통합 의미·121 실제 away/ready 반영은 여전히 미해결이며 이번 범위가 아니다.
