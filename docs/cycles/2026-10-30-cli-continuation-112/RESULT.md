# 112 결과 — 소유 CLI의 map.6 후속 읽기 opt-in (구현·모델 없는 검증)

단일 작성자(Claude Code)의 구현 결과다. 수용과 실제 호출 선택은 총괄 판정이다. **모델/CLI 생성 호출 0**, 설치·계정·키·환경 변경 0, 기본 DeepSeek·Worker·공개 경로·prompt·validator·source kind·codec 변경 0. 결정은 [DESIGN.md](DESIGN.md).

## 판본

- 기준 83d545dc5192a86556cfaffb70a6ec86526eda14(app 5736b7949d50ba92c07ae583ff22c618c25c3e94), branch `work/experience112-cli-continuation`. 102 branch/PR61은 건드리지 않았다.
- 코드·테스트 SHA 0cdabb9e15021a876000fec2f48b8843bad61751. 그 뒤 커밋은 이 문서의 검사 결과 기입뿐이다.

## 바뀐 곳

- `docs/cycles/2026-10-29-owned-cli-preview-102/preview/cli-executor.mjs`: 정책 `scope`(first 기본 | map6-later), 범위 거절(`EXECUTOR_SCOPE`/`EXECUTOR_SCHEMA`), 접수 binding의 `scope`·`promptKind`·`prompt`·`promptSha256`·`askSha256`, call 직전 재확인, `describe().scope`. `policy.example.json`에 scope 예시.
- `app/continuity/src/client/{studio-api,map-run,app}.ts`: status의 executor scope 읽기, `EXECUTOR_SCHEMA` 문구, 헤더 title의 범위 설명.
- 테스트: `owned-cli112.test.mjs`, 합성 후속 사례 `later112-case.mjs`, 가짜 CLI `file` 모드, 102 E1의 binding/describe 기대값에 새 필드.

## 검사 (작성자 실행, Linux 원격 Node v22.22.0, 가짜 CLI)

정확 0cdabb9, 작업 트리 clean, `AI_MODE=mock`·`ALLOW_PAID_AI=false`·키 없음:

| 단계 | 결과 |
|---|---|
| `continuity/scripts/build.mjs` / `check.mjs`(이 환경 tsc) | 통과 / 통과 |
| continuity 전체 `node --test continuity/tests/*.test.mjs` (102·102 process·112 포함) | 596/596, 167초 |
| `deploy-cloudflare.mjs --dry-run` / `build-static.mjs --preview` | 통과 / 통과 |
| 102 `check-ui-flow.mjs` (Chromium, 첫 지도) | 통과: child 2, job POST 2 |
| 종료 뒤 가짜 CLI·preview 프로세스 | 0 |

이 전에 102·process·112 focused 첫 실행은 31/32였다(158초, 900초 상한 안에서 스스로 종료, 프로세스 0). 실패 1건은 102-E1이 실행자 status 설명을 새 `scope` 필드 없이 정확 비교한 기대값이었고, 기대값에 `scope: 'first'`만 더해 E1 단독 재확인 뒤 위 전체 실행에 포함했다.

112 새 경계:
- 112-1 scope 없음=first이며 정책 hash가 112 이전 공식과 동일, first 명시도 동일, map6-later는 hash가 다름, 그 밖의 값(later/all/map6/빈 값/null/숫자)은 정책 오류.
- 112-2 기본 first 정책은 후속 ask를 접수 전 `EXECUTOR_SCOPE`로 거절(기록·child 0). 첫 지도는 그대로 ready, binding prompt id가 112 이전 값과 같음.
- 112-3 opt-in: 후속 ask가 정상 job으로 ready. child stdin = 96 wrapper + 실제 후속 지침(MAP6_PROMPT) + 원 ask, binding은 later/그 지침 hash/ask hash(첫 지도 hash 아님). 중복 POST child 1회, executor off·키 없는 재시작에서 같은 ready 회수. 브라우저 쪽과 같은 decode·hash 확인·`validateMapReply`·`applyReading` 결과가 원 입력에 직접 적용한 결과와 전체 동일: 고정 요청 원문 sources, prior target, claim/record/part alias, claim 정정(C01 대체)·open claim, evidence 원자료의 code/test 대응, 정정 기록에 의한 prior 철회(이전 대응은 이력으로 남음).
- 112-4 binding과 다른 ask·지침·지침 id·kind·ask hash·scope·잘린 ask는 lease 없이 `EXECUTOR_CHANGED`, child 0. opt-in에서도 첫 ask는 first 지침으로 결속. map.6 아닌 ask는 `EXECUTOR_SCHEMA`.
- 112-5 기존 first 정책의 ready 결과는 opt-in 실행자에서도 같은 결과·binding으로 회수(재결속 없음).
- 112-6 브라우저 status 읽기: scope first/map6-later만 받고 미상 값은 표시하지 않음, ai 값은 그대로.
- mutation: 접수 범위 거절 제거→112-2 실패, 실행 직전 재확인 제거→112-4 실패, 후속을 첫 지도 hash로 기록→112-3 실패.

합성 응답은 그 ask에 맞춰 작성자가 쓴 것으로, 실제 모델 성공·의미 품질의 증거가 아니다.

## 미확인·한계

- 실제 CLI로 후속 ask를 실행하지 않았다. 후속 지침·더 큰 입력(111은 ask 32,764 byte)에서의 시간·토큰·과금은 미관측이며 299/300초·출력 상한은 기존 그대로다. 토큰/과금 hard cap 미확인.
- 111 실제 입력의 두 반환 자료는 정상 붙여넣기(N, pasted)라 code/test 대응을 만들 수 없다(evidence 원자료만 가능, 기존 계약). 112는 이 source kind·validator·입력 UI를 바꾸지 않았고, 이는 별도 제품 한계로 남긴다.
- Windows 실행·잠긴 TS 5.8.3 독립 검증은 총괄 분담이다. UI 화면 재생은 하지 않았다(헤더 title 문구는 타입 검사로만 확인).
