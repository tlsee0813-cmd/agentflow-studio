# 102 결과 — 내구 작업 소유자에 연결한 로컬 CLI preview 실행자 (구현·모델 없는 검증)

작성자 1명(Claude Code)의 구현 결과다. 수용·실제 호출 여부는 총괄 판정이다. **모델/CLI 생성 호출 0**, 설치·계정·권한 변경 0, 기본 공급자·90초·Worker/static/legacy 경로 변경 0. 결정은 [DESIGN.md](DESIGN.md).

## 판본

- 기준 357e9a301fc910c95a3522de3564a9f02863b3ba(app 3fc2ab0421cda167bd3fbb70c5eaa2a2e9dcc0e5).
- 계보: a330ab1 → 2dbc140 → 4eda653 → 9694312 → 93b46c0 → af84755(아래 run4) → 8ae7eb9(상대 `--state` 실행자 수리, run5) → a563855(E21 fixture, Windows 다른 볼륨) → 이 문서를 포함한 최종 커밋(P4 fixture: 재시작 전 정상 정리 관측). 8ae7eb9 이후 제품 코드는 바뀌지 않았다. 중간 커밋은 독립 검토용이며 수용이 아니다.

## 바뀐 곳

- `app/continuity/server/studio.mjs`: `mapExecutor` 서버 주입(지도 jobs 전용), status `map.via`/`jobs.executor`. 주입이 없으면 기존 status·경로 그대로.
- `app/continuity/server/map-jobs.mjs`: 선택적 `prepare`/실행 binding·관측 저장, `own` export. DeepSeek 작업 파일에는 새 필드가 없다.
- `app/continuity/src/client/{studio-api,map-run,app}.ts`, `public/styles.css`: 지도 전용 가능 상태(via jobs), 실행자 오류 문구, 헤더 `지도 정리만 가능`. 질문·계획·결과 정리 조건은 그대로.
- `docs/cycles/2026-10-29-owned-cli-preview-102/preview/`: `cli-capture.mjs`(96 guard 계열), `cli-executor.mjs`, `serve-preview.mjs`, `reconcile-lease.mjs`, `check-ui-flow.mjs`, `policy.example.json`.
- 테스트: `app/continuity/tests/owned-cli102.test.mjs`, `owned-cli102-process.test.mjs`, 무해 가짜 CLI `fake-cli102.mjs`.

## 실행한 검사 (작성자 실행, Linux 원격 컨테이너 Node v22.22.0)

run4, 정확 af84755 · 작업 트리 clean · `AI_MODE=mock`, `ALLOW_PAID_AI=false`, 키 없음:

| 단계 | 결과 |
|---|---|
| `node continuity/scripts/build.mjs` / `check.mjs`(tsc 5.8.3·경계) | 통과 / 통과 |
| 102 focused (`owned-cli102*.test.mjs`) | 25/25, 159초, 종료 뒤 가짜 CLI 프로세스 0 |
| continuity 전체 `node --test continuity/tests/*.test.mjs` | 584/584 |
| `deploy-cloudflare.mjs --dry-run` / `build-static.mjs --preview` | 통과 / 통과 |
| `check-ui-flow.mjs` (Chromium) | 통과: child 2회, job POST 2, A·B 각 읽기 1 |

app 루트 `npm test`는 이번 run에 넣지 않았다. 앞선 실행에서 실패 1건은 기존 `I6R`의 Node `v22.16.0` 고정 검사(이 환경 v22.22.0)였고 102와 무관하다.

이전 판본의 결과는 판본별로 따로 보존했다: run1(2dbc140 이전 executor) 21/22, run2(4eda653) 22/22 + E13 fixture 누수로 종료 지연, run3(9694312) focused 23/24·전체 582/583(둘 다 E17 테스트 순서 문제)·UI 통과. 총괄 Windows run(9694312) 19 pass/2 fail/3 skip의 두 실패(P1 Windows 정리, E17)는 af84755에서 수리했다.

새 경계 반례(가짜/무해 child, 모델 0): 정상 ready·stdin=고정 wrapper+98 FIRST prompt+ask 정확 일치(E1), UTF-8/줄 분할(E2), invalid UTF-8·tool/error/unknown event·exit/signal·turn 미완료·final 없음/불일치·JSON·wire 거절(E3), 선택 cutoff 전후(E4)·같은 tick 경합(E5), 취소·SIGTERM 무시·취소 뒤 완결 응답(E6), close 미수신 시 다른 ID 거절과 verdict 내 결정(E7), leader reap 뒤 신호 없음·pipe 차단과 lease 분리(E13), final 읽기 전 run 폴더 삭제 없음(E14), 버전 probe의 lease 결속(E15), binary 교체: 접수 거절·Linux 시작 image 거절(E16), lease 기록 중 취소/예산 소진 시 child 0(E17), close 뒤 옛 child가 새 lease를 지우지 않음(E18), 설정·final 읽기 지연에도 call verdict ≤ verdictMs(E19), 진행 중 상태 변경 drain 전 handoff 없음·closing 시 job/probe 시작 0(E20), 중복 POST 1회 실행·다른 ID 즉시 거절(E8), 범위·binding·binary/version(E9), HTTP 보안(E10), 기본 경로 불변(E11), Worker/기본 import 경계(E12). 별도 프로세스: launcher SIGKILL 뒤 옛 child 생존·재시작 새 ID 실행 0(P1), 정체 불명 lease는 운영자 확인 전 거절(P2), 정상 종료 중 child 정리(P3), ready 재시작·executor off(keyoff)(P4), 두 launcher 한 상태(P5). 주요 가드는 mutation으로 해당 검사가 실패함을 확인했다(옛 lease 해제·no-close·fence/leaseId·call deadline·drain·pre-spawn closing).

UI(Chromium, 가짜 CLI): DeepSeek 키 없이 헤더 `지도 정리만 가능`, 일반 첫 지도 버튼 → 실행 중 다른 프로젝트 기록 저장·새로고침 → 원 프로젝트 카드에 결과 도착 → 원 프로젝트에서만 명시 반영, 질문 버튼 없음, 동기 `/api/studio/map` 호출 0, child 2회.

## 이후 수리 (총괄 CUA 재생에서 발견)

- 상대 `--state`: 실행자가 상태 폴더를 정규화하지 않아 child에 상대 `{cwd}`/`{final}`이 전달되고 child 작업 폴더 아래로 중첩되어 final ENOENT(제품은 failed로 격리). 실행자를 열 때 호출 작업 폴더 기준 절대 경로로 한 번 정규화한다. 반례 E21(상대 상태 폴더 → 무해 child ready), resolve 제거 mutation에서 E21이 exit 1로 실패함을 확인했다.

## 미확인·한계

- 실제 CLI 0.165.0-alpha.1.2의 인자·격리·event/final 프로토콜, 토큰/과금 hard cap은 확인하지 않았다(실제 호출 0). `policy.example.json`의 인자는 동결 binary의 `exec --help`로 총괄이 확인해야 한다.
- Windows orphan: 이 환경은 Linux다. Windows에서는 group probe가 없어 재시작 뒤 lease는 운영자 확인 전까지 닫혀 있다(fail closed). libuv job object가 launcher 종료 때 child를 끝내는지는 Linux 검사로 보장하지 않는다. 총괄 Windows 실행 결과가 별도 증거다.
- POSIX에서 child가 스스로 setsid로 group을 벗어나면 group probe 범위 밖이다. CLI가 부르는 다른 실행 파일(helper)의 image는 확인하지 않는다. Linux 외에서는 마지막 hash와 exec 사이 교체를 탐지하지 못한다.
- close 미수신·group 미종료는 운영자 확인 전까지 입장을 닫는다(가용성보다 fail closed). 300초는 verdict 상한이며 ready 디스크 저장·OS 종료 완료 보장이 아니다.
