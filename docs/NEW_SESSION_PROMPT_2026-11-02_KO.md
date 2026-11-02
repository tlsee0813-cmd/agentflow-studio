# 다음 세션 시작 프롬프트 — 2026-11-02 후속 수리 이어받기

아래 본문을 PC의 로컬 Claude Code 세션(또는 새 클라우드 세션)에 그대로 붙여 넣는다. 작성 시점의 최신 커밋은 `claude/compassionate-ritchie-or1h11`의 `4f3256f`다. 시작할 때 원격 HEAD와 로컬 미커밋 변경을 먼저 확인한다.

---

AgentFlow Studio 개발을 이어받아 줘. 먼저 아래를 전부 읽고 파악한 뒤에 작업해. 파악이 끝나면 "현재 상태 요약 10줄"과 "첫 작업 제안 3개"를 먼저 말하고, 내가 고르기 전에는 코드를 바꾸지 마.

## 1. 저장소와 브랜치

- GitHub: `tlsee0813-cmd/agentflow-studio`
- `main`: 안내용 초기 계보. 최신 코드가 아니다. README는 아직 11월 1일 전달 결과를 가리킨다.
- `work/experience142-reading-delivery`: PC에 전달된 개발 계열. PR #111(분할 지도 생성)까지 병합됨. 병합 코드 `1fd5bdb8`.
- `claude/compassionate-ritchie-or1h11`: 그 위에 얹은 11월 2일 후속 수리. 최신 `4f3256f`. **아직 work 계열에 병합하지 않았고, 실제 AI 모델로 성공을 확인하지 못했다.** 이 브랜치를 work에 병합할지는 내가 정한다. 네가 임의로 다른 브랜치에 푸시하거나 이력을 고치지 마.
- 이 브랜치의 커밋 순서: `5297c01` 실패 진단 → `1a32ce6` 경로 결정 통합 → `41027d2` 첫 지도 항목 단위 제외 → `91b8b66` 병합 → `4d867ee` 기록 삭제·중복 방지 → `4f3256f` 추출 단서 완화.

## 2. 이 PC 환경 (값은 출력하지 말 것)

- 체크아웃: `C:\Users\이준혁\OneDrive\바탕 화면\agentflow-studio` (OneDrive 안의 바탕 화면. `$env:USERPROFILE\Desktop`이 아니다). 현재 `claude/compassionate-ritchie-or1h11`이 체크아웃되어 있다.
- `node`는 PATH에 없다. Codex 앱에 내장된 node를 쓴다. app 폴더에서:
  ```powershell
  $node = (Get-ChildItem "$env:LOCALAPPDATA\OpenAI\Codex\runtimes" -Filter node.exe -Recurse -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName; if (-not $node) { $node = "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" }; $node
  ```
- PowerShell 실행 정책이 .ps1을 막는다. 정책을 바꾸지 말고 이번 실행만 허용한다: `powershell -ExecutionPolicy Bypass -File .\continuity\scripts\start-local.ps1 -NodePath $node`
- 시작 스크립트는 4317 포트에 Studio가 이미 떠 있으면 새로 띄우지 않는다. 코드를 바꾼 뒤에는 먼저 끈다:
  `Get-NetTCPConnection -LocalPort 4317 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`
- 빌드: `& $node continuity/scripts/build.mjs` (app 폴더). 패키지 재설치는 필요 없다(의존성 변경 없음).
- 키: `app/.env`(DeepSeek·연결 설정), `%LOCALAPPDATA%\AgentFlowStudio\openai.env`(OpenAI). 서버만 읽는다. 값을 채팅·로그·GitHub에 쓰지 않는다. 삭제·재발급하지 않는다.
- 저장 데이터: `app/continuity/.studio-data/` (작업 기록 `map-jobs-4317`, 분할 단계 장부 `map-jobs-4317/first-map`, 거절 보관 `refused-4317`). 삭제·초기화하지 않는다.
- 실패 원응답을 보려면 `app/.env`에 `STUDIO_KEEP_REFUSED=on`을 넣고 재시작한다. 그러면 거절된 단계마다 비밀값을 가린 JSON이 `refused-4317`에 남는다.
- 사용자 원문(KORU 기록)은 비공개다. 공개 저장소·채팅에 올리지 않는다.

## 3. 먼저 읽을 문서 (이 순서)

1. `docs/cycles/ACTIVE.md` 맨 위 "2026-11-02 후속 수리" 절, 그 아래 "PC 분할 생성 전달" 절.
2. `docs/design/START_FLOWS_AND_AI_BATCH_KO.md`: 세 시작 흐름(붙여넣기 / 처음부터 자동 연결 / 붙여넣기 후 자동 연결), 경로 결정, AI 단계·모델·상한·교정 횟수, 한도표, 남긴 불일치 11건.
3. `docs/releases/2026-11-02/HANDOFF.md`, `RESULT.md`, `DESIGN.md`: 11월 2일 전달 당시의 범위·증거·설계 원칙.
4. `docs/USE_STUDIO_KO.md`, `app/continuity/README.md`: 사용자 관점의 동작과 PC 실행.
5. `docs/QUESTIONS.md`: 남은 질문과 과거 반려 이력(공개73·반려74·UI75(693d0c7)·136 RETURN·141 scope 반려는 유지한다. 다시 열지 않는다).
6. `CONTRIBUTING.md`: 검사 명령과 문서·PR 약속.

## 4. 제품이 무엇인지

사용자가 다른 AI(Claude Code, Codex 등)와 개발하며 남긴 기록(대화, 현황 보고)을 붙여 넣거나 자동으로 가져오면, AI가 그 기록을 "프로젝트 지도"(부분·주장·관계)로 정리한다. 모든 주장은 원문 구간을 정확히 인용해야 하고(`N01.07` 같은 구간 별칭), 인용이 원문과 맞지 않으면 반영하지 않는다. 이후 변경 요청과 돌아온 보고를 대조하고 다음 세션에 인수인계한다. PC 도구이며 브라우저 저장소에 프로젝트를 둔다.

지키는 원칙: 원문을 자르거나 고쳐서 검증을 통과시키지 않는다. 모델 출력을 수선·재키잉하지 않는다(문제 항목만 제외하고 고정 분류의 진단을 남긴다). 전송·과금이 불명인 단계를 자동 재전송하지 않는다. 다른 공급자로 대체하지 않는다. 보고를 확인된 사실로 승격하지 않는다. 자동 검사 통과를 제품 완성으로 말하지 않는다. 실패한 원응답을 성공으로 덮지 않는다.

## 5. 코드 지도 (`app/continuity/`)

- 서버(Node, PC 전용): `server/index.mjs` 시작 → `studio.mjs` API·경로 결속 → `map-jobs.mjs` 내구 작업 → `map-pipeline.mjs` 분할 파이프라인(DeepSeek 추출 `extract-n` → gpt-6.1-sol 설계 `plan` → gpt-6.1-terra 부분 작성 `render-n`(3부분씩) → 전역 `global`, 단계마다 교정 1회) → `map-partition.mjs`(구간 나누기·추출 영수증 검증) → `map-blueprint.mjs`(설계·조각·결합 검증, 첫 지도 항목 제외 `combineRenderedReading`) → `map-pipeline-store.mjs`(단계 결과·비용 장부) → `map-provider.mjs`(DeepSeek/OpenAI 호출) → `map-stage-diagnostic.mjs`(거절 진단 고정 분류) → `map-pipeline-host.mjs`(키 파일·거절 보관). 단일 호출 경로는 `studio.mjs`의 `callStudioModel`. `worker.mjs`는 공개 Worker(분할 없음).
- 공용(브라우저·서버 공유, `src/shared/`, 빌드하면 `dist/public/shared/`): `map-reading.ts`(요청 만들기 `buildMapAsk`, 응답 검증 `validateMapReply`, 적용 `applyReading`, 제외 진단 `attachExclusions`), `map-route.ts`(경로 결정·구간 수·기록 맞춤·안내 문구), `evidence-span.ts`(구간 별칭), `domain.ts`(프로젝트 변경: `pasteRecord`, `removePastedRecord`), `validation.ts`(저장 형식 검증), `types.ts`.
- 브라우저(`src/client/`): `app.ts`(화면·호스트), `map-run.ts`(정리 실행·작업 추적·오류 문구 `mapErrorText`), `map-jobs.ts`(작업 API), `return-view.ts`(기록·결과 패널, "이 기록 지우기"), `auto-sync.ts`(자동 연결), `studio-api.ts`(status 파싱).
- 검사: app 폴더에서 `& $node continuity/scripts/check.mjs`, `& $node continuity/scripts/build.mjs`, `& $node --test continuity/tests/*.test.mjs`(현재 1,025건), `npm run check`. 브라우저 smoke는 `python continuity/tests/studio_browser.py`(Playwright, 스텁 공급자). CI(`.github/workflows/verify.yml`)는 Node 22.16.0 정확 버전·Windows·Linux로 같은 검사를 돈다. 모의 공급자 검사이며 실제 모델 품질의 증거가 아니다.

## 6. 지금 상태와 직전 실패

- 사용자가 PC 화면에서 실제 긴 기록(KORU, 11,562자)을 첫 지도로 정리하면 실패했다. 옛 코드에서는 "AI 응답이 근거 규칙에 맞지 않아"만 나왔고, 새 코드에서는 "근거 읽기 1/7 구간을 한 번 바로잡은 AI 응답도 근거 규칙(단서의 원문 위치)에 맞지 않아"까지 나왔다. 즉 DeepSeek 추출 단서의 구간 이름이 규칙에 안 맞았다.
- `4f3256f`에서 추출 단서를 참고 자료로 취급해 잘못된 단서만 빼고 진행하도록 바꿨다(처리 판본 `first-map-divided.7`). **이 코드로 같은 기록을 다시 돌려 본 결과는 아직 없다.** 다음 단계(설계 `plan`, 부분 정리 `render`, 전역 `global`)에서 새 거절이 나올 수 있다.
- 첫 지도 조각·전역 검증은 항목 하나가 틀리면 그 항목만 제외하고 진단을 남긴다(`41027d2`). 부분 자체 위반, 근거가 없는 새 부분, 주장이 전부 제외된 부분, 모순, 키 같은 글은 여전히 전체 거절이다.
- 거절 시 작업 오류 `detail`에 `{stage, phase, total, rule|reason, path, category}`가 남고 화면이 단계·규칙을 말한다. `STUDIO_KEEP_REFUSED=on`이면 가려진 원응답이 파일로 남는다.
- 붙여넣은 기록은 지도에 읽히기 전이면 기록 화면의 "이 기록 지우기"로 지울 수 있다. 같은 글을 앞뒤 공백·줄바꿈 종류만 다르게 다시 붙이면 같은 기록으로 본다.
- 세션 디스크 문제로 node 바이너리를 복사하는 테스트 2개 파일(`owned-cli102*.test.mjs`, `pc-entry128.test.mjs`)은 마지막 커밋에서 다시 돌리지 못했다. PC에서 전체 검사를 한 번 돌려 확인한다.

## 7. 첫 작업 순서 (내가 다른 요구를 하지 않으면)

1. `git status --short`, `git log --oneline -3`, 원격 HEAD 확인. 미커밋 변경이 있으면 보고하고 건드리지 않는다.
2. app 폴더에서 빌드·전체 검사(`check.mjs`, `build.mjs`, `node --test`, `npm run check`)를 돌려 1,025건이 통과하는지 확인한다. 실패가 있으면 원인부터 보고한다.
3. 4317을 끄고 `STUDIO_KEEP_REFUSED=on` 상태로 다시 켠 뒤, 사용자에게 같은 KORU 기록으로 "기록으로 지도 정리"를 한 번 실행해 달라고 요청한다. 결과를 셋 중 하나로 분류한다: 성공(제외 진단 몇 건인지) / 단계 거절(어느 단계·규칙인지) / 그 밖의 오류(코드).
4. 거절이면 `refused-4317`의 해당 파일을 읽어 모델이 실제로 무엇을 틀렸는지 확인하고, 원칙(§4)을 지키는 가장 좁은 수정을 한다. 프롬프트를 바꾸면 처리 판본 문자열(`PIPELINE_RECIPE`)을 올리고 테스트 핀을 갱신한다.
5. 수정마다 검사를 돌리고, PC에 반영(끄기 → 빌드 → 켜기)까지 마친 뒤에 "됐다"고 말한다. 브랜치에만 올린 상태를 "고쳤다"고 말하지 않는다.

## 8. 하지 말 것

- `main`, `work/experience142-reading-delivery`, `checkpoint/*`에 직접 푸시하거나 이력을 고치지 않는다. 병합은 내가 결정한다.
- 키·접속 코드·사용자 원문을 채팅·커밋·로그에 쓰지 않는다. `.env`, `openai.env`, `.studio-data`, `Downloads`의 백업을 지우거나 덮지 않는다.
- 실행 중인 4317을 이유 없이 끄지 않는다(코드 반영 때만, 정리 작업이 진행 중이지 않을 때).
- 환경 재설치, 계정 전환, 패키지 재설치, 실행 정책 영구 변경을 하지 않는다.
- 모델 응답을 고쳐서 통과시키거나, 실패한 단계를 자동 재시도·다른 모델로 대체하지 않는다.
- 완료 연구·반려 판정(73/74/75/136/141)을 다시 시작하지 않는다.
- 공개 Worker 배포, 불명 과금 단계 재개 UI는 내가 요청하기 전에는 하지 않는다.

## 9. 보고 방식

- 맨 앞에 결과부터: 됐는지, 안 됐으면 어느 단계에서 무엇이 틀렸는지.
- "검증했다"와 "PC에 반영했다"와 "실제 모델로 확인했다"를 구분해서 말한다.
- 긴 설명보다 다음에 내가 실행할 명령 한두 줄을 준다. 명령은 PowerShell이며 app 폴더 기준으로 쓴다.
- 문서를 고칠 때는 `docs/cycles/ACTIVE.md` 맨 위 절에 한 줄 더하는 정도로 하고, 과거 기록 문서의 본문은 고치지 않는다.
