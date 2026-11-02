# 다음 세션 시작 프롬프트 — 2026-11-02

PC의 로컬 Claude Code 세션(app 폴더 기준)에 그대로 붙여 넣는다.

---

AgentFlow Studio를 이어받아, 이 PC에서 "기록으로 첫 지도 만들기"가 실제 AI 모델로 끝까지 성공하게 만들어 줘. 내가 기록을 붙여 넣어 테스트하지 않을 거다. 테스트 기록은 네가 직접 마련하고(공개 문서나 이 PC의 Claude Code/Codex 세션 기록처럼 비밀값 없는 긴 글), 실패하면 원인을 고치고 다시 돌려서, 실제로 지도가 만들어졌을 때만 보고해. 중간 보고는 막혔을 때만 해.

## 저장소
- `tlsee0813-cmd/agentflow-studio`. 작업 브랜치 `claude/compassionate-ritchie-or1h11`(최신 `e725dbc`). 이 브랜치에만 푸시한다. `main`·`work/experience142-reading-delivery`에는 푸시하지 않는다.
- 먼저 읽을 것: `docs/cycles/ACTIVE.md` 맨 위 절, `docs/design/START_FLOWS_AND_AI_BATCH_KO.md`, `app/continuity/README.md`의 "분할 지도 정리" 절. 원칙은 `docs/releases/2026-11-02/DESIGN.md`.

## 이 PC
- 체크아웃 `C:\Users\이준혁\OneDrive\바탕 화면\agentflow-studio`. `node`는 PATH에 없다. app 폴더에서:
  `$node = (Get-ChildItem "$env:LOCALAPPDATA\OpenAI\Codex\runtimes" -Filter node.exe -Recurse -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName`
- 빌드 `& $node continuity/scripts/build.mjs`. 검사 `& $node continuity/scripts/check.mjs`, `& $node --test continuity/tests/*.test.mjs`, `npm run check`.
- Studio 끄기 `Get-NetTCPConnection -LocalPort 4317 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`. 켜기 `powershell -ExecutionPolicy Bypass -File .\continuity\scripts\start-local.ps1 -NodePath $node`. 코드를 바꾸면 끄기 → 빌드 → 켜기.
- 키는 `app/.env`(DeepSeek)와 `%LOCALAPPDATA%\AgentFlowStudio\openai.env`(OpenAI). 값을 출력·복사하지 않는다. `app/.env`에 `STUDIO_KEEP_REFUSED=on`을 넣으면 거절된 단계의 원응답이 `app/continuity/.studio-data/refused-4317`에 남는다. `.studio-data`는 지우지 않는다.
- 비용 상한은 정리당 $1, 월 $20(OpenAI). 테스트는 이 안에서 한다.

## 지금 상태
- 분할 파이프라인: DeepSeek 추출 → gpt-6.1-sol 설계 → gpt-6.1-terra 부분 작성 → 전역. 코드는 `app/continuity/server/map-pipeline.mjs`, 검증은 `map-partition.mjs`·`map-blueprint.mjs`·`src/shared/map-reading.ts`.
- 실제 기록으로 마지막 실패는 추출 단계였고 `4f3256f`에서 완화했다. 그 뒤로 실제 모델 실행은 없다. 설계·부분 작성·전역 단계에서 새 거절이 나올 수 있다. 거절되면 화면과 작업 오류 `detail`에 단계·규칙이 나오고, 보관 파일에 원응답이 남는다.
- 모의 검사 1,025건은 통과 상태다. PC에서 전체 검사를 한 번 돌려 확인한다.

## 규칙
- 모델 응답을 고쳐서 통과시키지 않는다. 틀린 항목만 제외하고 진단을 남긴다. 자동 재시도·다른 모델 대체 없음.
- 프롬프트나 검증을 바꾸면 `PIPELINE_RECIPE` 판본을 올리고 테스트를 맞춘다. 수정마다 검사를 돌린다.
- 키·원문을 커밋·채팅에 쓰지 않는다. 환경 재설치·패키지 재설치·실행 정책 영구 변경 없음.

## 보고
- 성공하면: 어떤 기록(길이), 몇 단계·몇 호출, 제외 진단 몇 건, 커밋 해시. 그리고 내가 쓸 기록으로 해 볼 때 주의할 점 한두 줄.
- 막히면: 어느 단계, 어떤 규칙, 원응답에서 모델이 실제로 틀린 것, 네가 시도한 수정과 결과.
