# 기여 안내

AgentFlow Studio에서 코드나 문서를 바꿀 때 지키는 약속을 모았습니다. 처음이라면 [README](README.md)와 [구조 개요](docs/ARCHITECTURE_KO.md)를 먼저 읽어 주세요.

## 어디에서 시작하나요

- **새 작업의 기준 브랜치는 `work/experience142-reading-delivery`입니다.** `main`은 초기 역사 기준이라 최신 제품 코드가 없습니다.
- 작업 브랜치를 새로 만들고, 기준 브랜치로 PR을 엽니다. 다른 사람이 만든 브랜치의 역사는 다시 쓰지 않습니다.
- 공개판(`release/*`)과 보관용 `checkpoint/*`는 배포·기록 기준이라 일반 작업의 대상으로 삼지 않습니다.

## 개발 환경

| 도구 | 판본 |
| --- | --- |
| Node | 22.16 이상 22.x (CI는 정확히 22.16.0) |
| npm | 10.x, `app/package-lock.json`으로 잠긴 설치 |
| TypeScript | 5.8.3 (잠긴 개발 의존성, 빌드가 판본을 확인합니다) |
| Python | 3.13, 브라우저 검사용 Playwright 1.57.0 |

```sh
cd app
npm ci --ignore-scripts --no-audit --no-fund
npm run build && node continuity/scripts/build.mjs
node continuity/server/index.mjs --mock      # http://127.0.0.1:3000
```

런타임 외부 패키지는 없습니다. 새 의존성을 더하기 전에는 왜 필요한지 PR에 적어 주세요.

## 검사 돌리기

CI(`.github/workflows/verify.yml`)와 같은 순서입니다. 모두 `app/`에서 실행하며 실제 AI를 호출하지 않습니다.

```sh
# Studio (대부분의 변경은 여기)
node continuity/scripts/check.mjs                 # 타입·문법·키 경계
node continuity/scripts/build.mjs
node --test continuity/tests/*.test.mjs
node continuity/scripts/deploy-cloudflare.mjs --dry-run
node continuity/scripts/build-static.mjs --preview

# 초기 앱 (app/server, app/src를 건드렸다면)
npm run check
npm test

# 브라우저 검사 (선택, Playwright 필요)
python -m pip install -r tests/browser-requirements.txt
python -m playwright install --with-deps chromium
python tests/browser.py
python continuity/tests/studio_browser.py
```

PR을 올리기 전에 바꾼 영역의 검사는 로컬에서 통과시키고, 돌리지 못한 검사가 있으면 PR 본문에 그렇다고 적어 주세요.

## 키와 개인 자료

- 실제 API 키는 `app/.env`에만 둡니다. `.env`, `*.key`, `private/`, `secrets/` 등은 `.gitignore`에 있습니다.
- 키, 접속 코드, 개인 PC 경로, 실제 사용자 기록 원문을 커밋·로그·PR 본문에 넣지 않습니다.
- 브라우저 번들과 정적 빌드에 키 이름이나 공급자 주소가 들어가면 빌드가 실패합니다. 이 검사를 끄지 않습니다.
- 실제 유료 AI 호출이 필요한 검증은 PR 검사에 넣지 않고, 따로 기록합니다.
- 세션 기록 읽기를 검사할 때는 합성 홈 폴더(`continuity/tests/sessions-fixture.mjs`)만 씁니다. 실제 `~/.claude`·`~/.codex`의 대화를 테스트나 증거 파일에 넣지 않습니다.

## 코드 약속

- 브라우저와 서버가 함께 쓰는 규칙은 `continuity/src/shared/`에 둡니다. 화면 코드에 같은 검증을 다시 쓰지 않습니다.
- `server/studio.mjs`는 `node:` 모듈 없이 import돼야 합니다. Worker에서도 같은 코드가 돌기 때문입니다.
- 화면 색·간격·모서리는 `continuity/public/styles.css` 맨 위 `:root`의 토큰(`--s-*`, `--r-sm`·`--r-md`·`--r-pop`·`--r-lg` 등)을 씁니다. 새 값을 직접 적지 않습니다.
- 서버에 새 오류 코드를 만들면 화면 안내 문구(`continuity/src/client/studio-api.ts`의 `ERROR_TEXT`)도 함께 더합니다. `error-codes.test.mjs`가 빠진 것을 잡습니다.
- AI가 실패하면 실패를 보여 줍니다. 모의 답이나 추측으로 성공처럼 채우지 않습니다.
- 사용자의 원래 기록은 고쳐 쓰지 않습니다. 저장 스키마를 바꾸면 기존 저장값을 옮기는 경로와 테스트를 함께 둡니다.
- 테스트를 건너뛰거나 지워서 검사를 통과시키지 않습니다. 교체된 화면의 테스트를 정리할 때는 이유를 남깁니다.

## 문서 약속

- **한국어가 기본입니다.** 코드 식별자, 명령, 오류 코드는 원래 표기를 그대로 씁니다.
- 날짜는 `2026-10-30`처럼 쓰고, 기준 시각이 중요하면 KST를 밝힙니다.
- **현재 안내와 과거 기록을 구분합니다.** 사이클 기록·인수인계·검증 결과는 당시의 사실이라 본문을 최신 사실처럼 고쳐 쓰지 않습니다. 내용이 낡았으면 맨 위에 현재 안내로 가는 한 줄을 덧붙입니다.
- "구현됨", "테스트 통과", "실제 AI 결과가 맞음", "공개 배포됨", "사용자에게 쓸모 있음"은 서로 다른 증거입니다. 하나가 확인됐다고 다른 것까지 됐다고 쓰지 않습니다.
- 새 문서를 만들면 [문서 지도](docs/README.md)에 한 줄을 더해 주세요.
- **해시로 고정된 파일은 한 글자도 고치지 않습니다.** `app/README.md`, `app/docs/*.md`를 비롯해 `app/fixtures/init009/init008-source.sha256`과 `app/fixtures/init007b/init006-source-hashes.json`에 적힌 파일은 평가 게이트가 바이트 단위로 확인합니다. `app/` 아래 파일을 고치기 전에 두 목록에 있는지 먼저 확인하고, 있으면 설명은 [문서 지도](docs/README.md)처럼 고정되지 않은 곳에 씁니다.

## PR 올리기

- 제목은 무엇이 달라지는지 한 문장으로 씁니다.
- 본문에는 바꾼 것, 바꾸지 않은 것(범위 밖), 돌린 검사, 남은 한계를 적습니다.
- 사이클과 연결된 작업이면 사이클 번호와 기록 위치를 적습니다. PR 번호와 사이클 번호는 다르니 섞지 않습니다.
