# 100 결과: 로컬 지도 정리의 내구 작업 (구현·합성 검증)

기준 `0967c6e`(98/99 공유 `033ef84` + 100 DESIGN). 구현 전 고정 선택은 [DESIGN](DESIGN.md) "구현 전 고정 선택". 이 기록은 **합성 공급자(stub)로 한 구현·검증**이며 새 실제 모델 호출 0, 90초·model·token·prompt·검증기·의미 기준 변경 0이다. 첫 지도 의미/시간 수용이 아니다.

## 구현 범위

| 경계 | 위치 |
|---|---|
| 입력 codec `map-input.1`, binding·접수 검증(공유) | `app/continuity/src/shared/map-job.ts` |
| Node 전용 작업 저장·소유·실행·취소·확인·tombstone | `app/continuity/server/map-jobs.mjs` (studio.mjs/Worker는 import하지 않음) |
| 작업 경로 `/api/studio/jobs…`, status `jobs` 광고(주입 시에만) | `server/studio.mjs`(Node 무의존 유지), `server/app.mjs`(이 경로만 본문 512 KiB), `server/index.mjs`(기본 저장소 `app/continuity/.studio-data/map-jobs-<port>`) |
| 브라우저 예약(영구 저장 전용 adapter, WebLock), 작업 API | `src/client/map-jobs.ts` |
| 접수·회수·명시 반영·취소·버림·중단 표시 | `src/client/map-run.ts`(97 경로·`MapRunState` 모양 불변), `src/client/app.ts`, `studio-api.ts`, `public/styles.css` |
| 검사 | `tests/durable100.test.mjs`(27), `tests/durable100-process.test.mjs`(4, 실제 별도 프로세스), `tests/studio_browser.py` `map100_flow`(기본 CI 흐름 + `map100` 단독), `tests/studio-smoke-server.mjs`(`STUDIO_JOBS_DIR`, 호출별 보류 `STUDIO_STUB_GATE`) |

## 구현 중 독립 검토 반영 (root/Sol 지적 → 수리 → 반례)

| 지적 | 수리 | 반례 검사 |
|---|---|---|
| 다른 ID 같은 entry 동시 접수 | 접수 검사→내구 기록 전역 직렬화 | B2 |
| 취소 후 running 잔류·limiter | 호출 종료 시 항상 정리, 반납 1회 | B3 |
| 완료 시 ready/바이트 상한 초과 | 실행 중 작업이 ready 자리·최대 파일(640 KiB) 예약 | B4 |
| close 후 늦은 기록 | fence 후 abort·실행 promise 대기·소유 해제 | B7 |
| 404만으로 예약 폐기 | 같은 권한 cancel tombstone 먼저 확정, 보내는 탭이 살아 있으면(WebLock hold) 기다림 | B6, D8, 브라우저 7 |
| 잘못된 권한의 존재/접수 구별 | 재접수·조회·취소·확인 모두 404, ACCEPTING은 같은 권한만 | B1, B2 |
| 복구 결과의 seq·A→B→A 외부 저장 | 이 페이지가 직접 만든 저장 번호만 연속 허용(owned 여부 무관) | D9, D13 |
| reservation 귀속 변조(import copy) | 응답 id·전체 binding·bindingHash 대조 후에만 load/ack, 저장본은 entry/project/lifecycle 귀속 확인 | D10, D11 |
| localStorage 불가 시 메모리 대체 | 작업 예약은 영구 저장 전용, 실패는 그대로 노출·fail closed | D12 |
| 버림/본 의도 유실 | 의도를 먼저 보존, 로컬·서버 둘 다 실패면 ready 유지+명시 오류, 처리 중 반영·새 정리 불가 | D14, D15 |
| `app/.gitignore` 변경이 init009 지문(I9.01) 깨뜨림 | 되돌리고 `app/continuity/.gitignore`로 이동 | I9.01 단독 재실행 통과 |

## 실행한 명령과 결과 (이 컨테이너: Node v22.22.0, TS 5.8.3 lock, Chromium 1243 + Python Playwright 1.57.0)

- `node continuity/scripts/build.mjs`, `node continuity/scripts/check.mjs`: 통과.
- `node --test continuity/tests/*.test.mjs`: 559/559 통과(100 신규 31 포함). `durable100*.test.mjs` 반복 실행 각 통과.
- `node continuity/scripts/deploy-cloudflare.mjs --dry-run`: prepared(Worker 모듈에 `map-jobs.mjs` 미포함), `build-static.mjs --preview`: 통과.
- `python continuity/tests/studio_browser.py map100` 1280×720·1440×900 통과; `… map97` 통과(구형 경로: 스모크 서버가 jobs 미광고).
- 전체 기본 브라우저 흐름(`python continuity/tests/studio_browser.py`) 두 번을 구별해 기록한다.
  - 1회차(무효): 실행 도중 내가 `dist`를 다시 빌드해 `overview_flow`가 `#import-file` 대기 30초 초과로 실패했다(앞 3개 흐름 통과 후). 원본 로그는 작업 컨테이너 `/tmp/claude-0/keep/browser-full-run1-rebuilt-dist.log`. 코드 판정에 쓰지 않는다.
  - 2회차(`bf60630`과 같은 소스의 안정 빌드, 중간 재빌드 없음): exit 0, `ok` 33줄(새 AF100 흐름, AF97, 기존 전체 흐름, 접속 코드·실패·키 없음·정적 상태 포함). 로그는 작업 컨테이너 `/tmp/claude-0/keep/browser-full-run2-stable.log`. Linux 1회이며 Windows·정확 Node 22.16 CI는 root 범위다.
- app 루트 `npm run check` 통과. `npm test` 277/279: I9.01은 위 `.gitignore`로 원인 확인 후 수리·재통과, I6R `INVALID_EVAL_OPTIONS`는 이 컨테이너 Node v22.22.0(정확히 v22.16.0 요구)의 환경 차이이며 app 소스 변경 없음.
- provider 호출 수는 stub의 `called-<n>`·호출 카운터로 명시 단언하고, 완료 판정은 조건 대기(서버 상태/파일/저장소)로 한다.

## 검사하지 못한 범위·위험

- 정확 CI(Node 22.16.0, Windows 2022 포함)는 root 범위. Windows named pipe 소유·junction 별칭·rename 재시도는 코드만 있고 이 컨테이너에서 실행하지 못했다. macOS는 pid lock만(약한 보장).
- 실제 DeepSeek 장기 생성, 90초 이후 완결, 원격 취소/과금 중단 여부: 관측 없음(표시도 미보장으로 함). 총괄의 실제89 응답 재생 확인은 하지 않았다.
- Linux abstract socket은 network namespace 단위: 서로 다른 컨테이너가 같은 볼륨을 쓰면 막지 못한다.
- tombstone은 지우지 않는다(10000개 상한 도달 시 새 접수만 `JOB_STORE_FULL`). 수동 정리 절차는 없다.
- 새로고침 뒤 그 entry를 직접 편집하고 나서 반영하면 이 페이지 저장이므로 허용되지만, 다른 창이 그 사이 저장했다면 결과는 반영하지 않고 버린다(재생성 없음, 사용자가 다시 정리).
- 실행 중 응답을 내구 저장하지 못하면 이 프로세스에서는 `failed: JOB_STORE_FAILED`로 보이고, 재시작 후에는 `interrupted`로 보인다.

## 재현

```
cd app && npm ci --ignore-scripts --no-audit --no-fund && node continuity/scripts/build.mjs
node --test continuity/tests/durable100.test.mjs continuity/tests/durable100-process.test.mjs
python continuity/tests/studio_browser.py map100 [스크린샷폴더]
```
