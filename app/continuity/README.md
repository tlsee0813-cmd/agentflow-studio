# AgentFlow Studio (continuity)

> 저장소 전체 안내는 [README](../../README.md), 코드 구조는 [구조 개요](../../docs/ARCHITECTURE_KO.md)에 있습니다. 이 문서는 Studio 앱의 실행·API·배포 세부를 다룹니다.

Codex·Claude에서 평소처럼 개발한 기록(요청·작업 보고·확인 자료)을 프로젝트의 부분에 연결해서 보여 줍니다.
보이는 것은 구조, 최근 변화, 진행 상태, 다음에 판단할 것입니다. 프로젝트를 작업 폴더에 연결하면 이 PC의 Claude Code·Codex
세션이 기록으로 자동으로 들어옵니다(로컬 서버가 읽거나, 서버가 없으면 브라우저에서 `.claude`·`.codex` 폴더를 골라 읽음).
예제는 전달받았다고 가정하고 쓴 기록이며, 실제 수신 모델(`agentflow.return.2`)로 만들어집니다.

## 화면

1. **프로젝트**: 공통 예제와 이 브라우저에 저장된 프로젝트가 보입니다. 예전 판으로 저장한 프로젝트도 그대로 읽습니다.
2. **지도**: 창에 고정된 캔버스입니다. 노드는 고정 크기이고 이름과 상태만 표시합니다. 그룹은 저장된 포함 관계(containment)
   그대로 그리고, 선은 저장된 관계(relations)를 그립니다. 왼쪽에는 최근 변화가 있습니다. 드래그로 이동하고,
   Ctrl/⌘+휠이나 버튼으로 확대·축소합니다.
3. **부분 상세**: 노드를 선택해야 열립니다. 순서는 지금 상황 → 최근 변화 → 안의 부분·연결 → 기록 원문 → 정리 결과입니다.
   아래 입력에서 ‘지금 상황 정리’, ‘다음에 판단할 것’을 누르거나 직접 질문하면 서버가 DeepSeek에 요청합니다.
   응답에서 근거 기록과 지도 위 관련 부분으로 이동할 수 있습니다. Esc나 지도 클릭으로 닫습니다.

홈에서 내 프로젝트를 만들고, 지도에서 부분과 하위 부분을 추가하거나 이름·설명을 고칠 수 있습니다. 기존 도메인 함수를 사용하며 원래 기록을 고쳐 쓰지 않습니다. 정리 결과와 질문 초안은 프로젝트와 분리된 키에 둡니다. 예제의 정리 결과와 초안은 메모리에만 둡니다.

## 내 AI 세션 연결하기

새 프로젝트의 빈 지도는 **내 AI 세션 자동 연결**을 먼저 권합니다. 이미 쓰던 프로젝트라면 지도 위 **자동 연결 안 됨** 표시를 누릅니다. 작업 폴더를 고르면 연결됩니다.

1. **세션을 어디서 읽을지.** 로컬 서버로 열었다면 서버가 이 PC의 `~/.claude`·`~/.codex`를 읽으므로 고를 것이 없습니다.
   서버 없이 열었다면 **세션 폴더 고르기**로 `.claude`나 `.codex` 폴더를 직접 고릅니다(Chrome·Edge의 폴더 접근). 둘 다 쓰면 하나씩 두 번 고릅니다. `.claude`만 고르면 Codex 기록은 들어오지 않는다고 패널이 알려 줍니다. 다음 방문 때 브라우저가 한 번 더 허용을 물을 수 있습니다.
2. **어느 작업 폴더인지.** 세션이 있는 작업 폴더 목록에서 하나를 누르거나 경로를 직접 적습니다. 그 폴더의 최근 14일, 세션 10개까지로 첫 지도를 만듭니다. 폴더를 연결하면 그 안쪽 폴더(예: 저장소의 `app/`)에서 연 세션도 함께 들어오므로, 목록의 세션 수에도 안쪽 폴더의 세션이 포함되고 이미 연결된 폴더의 안쪽 폴더는 다시 나오지 않습니다.
3. **그다음부터는 자동입니다.** 이 프로젝트가 탭에 열려 있는 동안, 대화가 약 2분간 잠잠해진 세션의 새 내용이 기록으로 들어오고 지도가 갱신됩니다.
   지도 갱신은 AI 호출이라 5분 간격, 하루 30회까지만 합니다. 탭을 닫아 둔 동안 쌓인 대화는 다시 열 때 가져옵니다.
   지도 갱신을 **취소**하거나 결과를 버리면, 새 기록이 들어오기 전까지 자동으로 다시 시작하지 않습니다(직접 누르면 갱신합니다).

가져오는 것은 사람이 쓴 요청과 도구의 최종 답, 바뀐 파일 이름뿐입니다. 도구 출력·추론·주입된 문맥은 뺍니다.
- 제목 없는 세션(Codex 등)은 첫 요청으로 이름이 붙습니다(예: Codex 「예약 확정 문자 보내 줘」).
- Codex 앱의 worktree 모드 대화도 원래 작업 폴더의 기록으로 들어옵니다.
- Claude 프로젝트·Remote Control로 진행한 세션은 사람이 쓴 말만 요청으로 풀어 담고, 다른 Claude가 전달한 지시는 `(다른 Claude가 전달한 지시)`로 표시한 요청으로 담습니다. 그 지시로 한 작업은 그때의 시각으로 따로 들어옵니다.
- 갈라 쓴 세션(fork·branch)과 되감은(rewind) 대화는 같은 기록을 두 번 가져오지 않습니다.
- 하위 에이전트가 세션보다 늦게 끝나 그 파일만 바뀌어도, 그 작업(바꾼 파일)을 다음 확인 때 가져옵니다.
- 자동 연결 중에는 손으로 붙여 넣은 기록·자료도 다음 자동 지도 갱신 때 함께 AI에 보냅니다.

**키·비밀번호 가리기.** 세션에서 가져온 기록뿐 아니라 직접 붙여 넣은 글, 웹 AI가 써 준 기록도 저장할 때 키·토큰·비밀번호처럼 보이는 곳을 `[가려진 비밀값]`으로 바꿉니다. "비밀번호는 …", "토큰은 …"처럼 한국어로 적은 것도 가립니다.
저장소가 나뉜 프로젝트는 **폴더 추가**로 여러 작업 폴더를 묶을 수 있고, 지도에서 부분마다 어느 세션이 다뤘는지 보입니다.

## 인수인계 문서

세션을 바꿀 때는 지도 위 **인수인계 문서**(프로젝트 전체) 또는 부분의 ⋯ 메뉴(그 부분만)에서 문서를 만들어 새 세션에 그대로 붙여 넣습니다.
지도와 기록에 있는 내용만 담고 AI를 부르지 않습니다. 세션 이름은 사람이 직접 쓴 첫 요청으로 짓고(다른 Claude가 전달한 지시로만 시작한 세션은 그 지시의 글로), 최근 흐름에는 최근 요청 6개와 각 답변의 끝 문단을 문장 처음부터 보여 주며, 그보다 앞선 요청이 있으면 빠졌다고 적습니다. 작업 폴더 밖에서 바뀐 파일(도구의 임시 파일 등)은 경로 대신 개수로만 적습니다. 문서의 마지막 표지 줄을 빼고 복사해도, 문서 아래에 적은 새 요구는 그대로 기록에 남습니다. 문서에는 `af-handover:코드` 표시가 들어 있어, 자동 연결된 폴더에서 이 문서로 시작한 세션은 지도에 **인수인계로 이어받음**으로 표시되고 문서 자체는 새 작업 기록으로 다시 들어오지 않습니다.

**웹 AI 대화로 이어 갈 때**는 기록이 저절로 들어오지 않습니다. 인수인계 창에서 **기록 요청 문구 복사**를 눌러 그 대화에 붙여 넣고, 나온 답을 **돌아와 읽기 › 기록 붙여넣기**에 넣어 저장합니다. 같은 문구는 기록 붙여넣기 칸의 **웹 대화용 기록 요청 문구 복사**에도 있습니다.

## 로컬 실행 (`app/` 디렉터리)

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run build && node continuity/scripts/build.mjs
```

**실제 AI 모드**: `app/.env`에 서버 키를 둡니다. `.env`는 `.gitignore`에 있어 커밋되지 않고, 브라우저에도 전달되지 않습니다.

```sh
echo 'DEEPSEEK_API_KEY=sk-...' > .env              # app/.env (선택: DEEPSEEK_MODEL=...)
node --env-file-if-exists=.env continuity/server/index.mjs
```

`http://127.0.0.1:3000`을 엽니다. 오른쪽 위에 `AI 정리 · deepseek-flash`가 보이면 실제 AI 모드입니다.
키 없이 실행하거나 `--mock`을 붙이면 `AI 키 없음`이 표시되고 정리 요청은 `AI_NOT_CONFIGURED`로 실패합니다.
대체 응답은 만들지 않습니다. 포트는 `PORT=3100`처럼 바꿀 수 있습니다.

Windows에서 빌드가 이미 있다면 PowerShell로 `./continuity/scripts/start-local.ps1`을 실행할 수 있습니다. `app/.env`가 있으면 읽고(없으면 AI만 꺼짐) 백그라운드에서 실행한 뒤 `http://127.0.0.1:4317`을 엽니다. 키 파일을 다른 비공개 위치에 보관했다면 `-EnvFile 'C:\private\studio.env'`를 지정합니다. 기존 Node 또는 Codex에 설치된 Node를 재사용하며 패키지를 설치하지 않습니다. 이미 같은 포트의 Studio가 실행 중이면 다시 띄우지 않으므로, 키를 새로 넣었다면 먼저 그 Studio를 끄고 실행합니다. 브라우저 저장은 주소별이므로 같은 포트를 계속 사용하세요. "이 시스템에서 스크립트를 실행할 수 없으므로"(UnauthorizedAccess)가 나오면 Windows 실행 정책 때문이니, 정책을 바꾸지 않고 이번 실행에만 허용합니다: `powershell -ExecutionPolicy Bypass -File .\continuity\scripts\start-local.ps1 -EnvFile '<키 파일 경로>'`.

### 시작이 안 될 때

서버는 시작하지 못하면 `AgentFlow Studio did not start: …` 한 줄을 남기고 종료 코드 1로 끝납니다. 스택이나 키 값은 출력하지 않습니다.

| 안내 | 할 일 |
|---|---|
| `only --mock is supported` | `--mock` 말고는 인자를 받지 않습니다. 키·주소는 `app/.env`에 둡니다 |
| `port … is already in use` | 이미 같은 포트에서 무언가 돌고 있습니다. `PORT=3100`처럼 다른 포트를 줍니다 |
| `INVALID_SERVER_CONFIG` 등 | `PORT`, `AI_MODE`, `AI_*` 한도, `DEEPSEEK_BASE_URL` 값을 확인합니다 |
| `… is not a usable value and was ignored` | 시작은 됩니다. 이름이 나온 `STUDIO_*`·`DEEPSEEK_*` 설정을 쓸 수 없어 기본값을 썼다는 경고입니다 |

Ctrl+C나 서비스 종료(SIGTERM)를 받으면 지도 작업 보관소를 정리해 닫고 종료 코드 0으로 끝납니다. 그때 돌던 지도 정리는 다음 시작 때 "중단됨"으로 남습니다.

### PC에서 설치된 Codex로 지도 정리하기 (선택)

이 PC에 이미 설치·로그인된 Codex CLI로 첫 지도와 이후 기록 대조를 하려면 `start-local.ps1` 대신 아래를 실행합니다(`app/` 디렉터리, 빌드 후). 정책 파일을 쓸 필요가 없습니다.

실행 조건: Windows의 PowerShell 7(`pwsh`)에서 확인했습니다(7.6.5). Windows PowerShell 5.1에서는 그 PC의 스크립트 실행 정책에 따라 이 스크립트 실행이 막힐 수 있습니다. 이 스크립트는 실행 정책을 바꾸지 않습니다.

```powershell
./continuity/scripts/start-pc.ps1                          # 시작(이미 실행 중이면 다시 열기), 브라우저가 열림
./continuity/scripts/start-pc.ps1 -CodexPath 'C:\…\codex.exe'  # codex.exe를 찾지 못했다고 하면 경로를 알려 주기
./continuity/scripts/start-pc.ps1 -Stop                    # 종료(시작 뒤 codex.exe가 바뀌거나 지워져도 종료됨)
```

- 주소는 `http://127.0.0.1:4327`입니다(기본 DeepSeek 실행 4317과 다른 주소). 브라우저 저장은 주소별이라 4317에서 만든 프로젝트는 여기에서 보이지 않습니다. 옮기려면 백업 파일로 내보내고 가져오세요.
- 허용된 Codex(codex-cli 0.165.0-alpha.1.2, 정해진 SHA-256)만 씁니다. 다른 판본이면 설명하고 시작하지 않습니다. 설치·업데이트·다운로드·로그인·계정 변경은 하지 않습니다. 모델(gpt-6.1-sol, high)·권한·시간(299초 선택/300초 판정)은 고정이며 고를 수 없습니다.
- 시작·다시 열기·종료는 생성 요청을 보내지 않습니다. 지도 정리는 화면에서 ‘기록으로 지도 정리’를 누를 때만 합니다.
- 4327에 다른 서버가 있으면 이 입구로 착각하지 않고 멈춥니다(`-Port`로 다른 포트 선택). 다른 프로세스를 끝내거나 작업 기록·실행 잠금을 지우지 않습니다.
- 지도 정리가 실행 중이면(종료를 요청하는 사이에 시작된 정리 포함) `-Stop`은 종료하지 않고 그렇다고 알려 줍니다. 결과 없이 중단해도 되면 `-Stop -InterruptRunning`.
- 지도 실행기를 쓸 수 없는 상태(예: Codex 판본이 바뀜)여도 같은 입구로 다시 열려 이미 받은 결과를 읽을 수 있고, `-Stop`으로 종료됩니다. 새 지도 정리만 막힙니다.
- 이전 실행이 끝났는지 확인되지 않으면(예: PC가 갑자기 꺼짐) 새 지도 정리는 막힌 채로 시작하고 그렇게 알려 줍니다. 이미 받은 결과는 읽을 수 있습니다.
- `app/.env`에 DeepSeek 키가 있으면 질문·변경 구상 등 다른 기능에 쓰고, 없으면 그 기능만 꺼집니다(지도 정리와 무관).

## Studio API

`server/studio.mjs`의 `createStudioHandler({ env })`는 표준 `(Request) => Promise<Response>`입니다. `node:` import가 없습니다.

| 경로 | 내용 |
|---|---|
| `GET /api/studio/status` | `{ ai: 'deepseek' \| 'off', model, access: 'open' \| 'code' }`와, 해당할 때 `digest`·`map`·`release`·`jobs` 상태 |
| `POST /api/studio/ask` | `studio.1` 요청(부분과 기록 최대 14개) → 검증된 `{ headline, situation[], changes[], next[], answer, refs[] }` |
| `POST /api/studio/map`, `/plan`, `/scope`, `/digest` | 기록으로 지도 정리, 변경 구상, 고른 범위의 전제 검토, 여러 부분 자료 읽기. 요청·응답 계약은 `src/shared/map-reading.ts`, `plan-api.ts`, `scope-api.ts`, `digest-api.ts`. 제한 공개판(`worker-existing-map.mjs`)은 `map`과 `jobs`를 `MAP_WITHHELD`로 거절 |
| `GET /api/studio/sessions?folder=…`, `GET /api/studio/sessions/<id>?since=…` | 로컬 Node 서버만(`server/sessions.mjs`, `STUDIO_SESSIONS=off`로 끔): 이 PC의 Claude Code(`CLAUDE_CONFIG_DIR` 또는 `~/.claude`)·Codex(`CODEX_HOME` 또는 `~/.codex`) 세션 목록과 한 세션의 대화. 읽기만 하며 경로가 아니라 목록의 ID로만 요청. 같은 origin만 허용 |
| `POST /api/studio/jobs`, `GET /api/studio/jobs/<id>`, `POST …/<id>/cancel`, `POST …/<id>/ack` | AF100, 로컬 Node 서버만: 지도 정리를 이 PC의 작업으로 보관(`server/map-jobs.mjs`, 기본 `continuity/.studio-data/map-jobs-<port>`, `STUDIO_JOBS_DIR`/`STUDIO_JOBS=off`). 회수 권한은 `X-Studio-Operation` 헤더로만. 창을 닫아도 실행기가 켜져 있으면 계속되고, 실행기가 꺼지면 중단으로 남는다. Worker·정적 빌드는 광고하지 않는다. |

- 키: `env.DEEPSEEK_API_KEY`에서만 읽습니다. 공급자 Authorization 헤더로만 쓰고, 응답·로그·번들에는 넣지 않습니다.
- 공급자: `https://api.deepseek.com/chat/completions`, JSON mode, 모델 `DEEPSEEK_MODEL`(기본 `deepseek-flash`).
- 경계: 같은 origin만 허용합니다. 다른 origin은 `STUDIO_ALLOWED_ORIGINS`에 정확히 적힌 것만 CORS로 허용합니다.
  POST에는 `X-AgentFlow-Request: 1` 헤더와 JSON이 필요합니다. `STUDIO_ACCESS_CODE`를 설정하면 사용자가 입력한
  코드(`X-Studio-Access`)를 요구합니다.
- 한도(선택): `STUDIO_TIMEOUT_MS`, `STUDIO_MAX_TOKENS`, `STUDIO_REQUESTS_PER_MINUTE`, `STUDIO_MAX_CONCURRENT`, `STUDIO_CALL_CAP`.
- 로컬 Node: `server/app.mjs`가 기존 localhost Host 검사를 먼저 하고 그다음 `/api/studio/*`를 handler에 넘깁니다.
  기존 `/api/continuity`·`/api/guidance` 경계는 바뀌지 않았습니다.
- handler는 `node:` 없이 import됩니다. `server/worker.mjs`가 Cloudflare에서 같은 API와 정적 화면을 연결합니다.

## Cloudflare Workers

`app/`에서 `node continuity/scripts/deploy-cloudflare.mjs --dry-run`으로 빌드·업로드 대상만 확인합니다.
기존 Node와 TypeScript를 재사용하며 Wrangler나 별도 서버 환경을 설치하지 않습니다.
실제 배포는 깨끗하게 커밋된 HEAD에서만 실행하고, 그 SHA의 CI 성공을 먼저 확인합니다.

```sh
node --env-file=/private/cloudflare.env --env-file=/private/studio.env continuity/scripts/deploy-cloudflare.mjs
```

- `cloudflare.env`: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`. Workers 편집 권한을 사용할 계정 하나에 한정합니다.
- `studio.env`: `DEEPSEEK_API_KEY`, `STUDIO_ACCESS_CODE`, 선택 `DEEPSEEK_MODEL`.
  AI 이용 코드는 사용자만 보관합니다. 공개 AI 배포에서는 빈 코드를 허용하지 않습니다.
- 기본 Worker 이름은 `agentflow-studio`이며 `CLOUDFLARE_WORKER_NAME`으로 바꿀 수 있습니다.
  계정의 `workers.dev` 하위 도메인이 먼저 설정되어 있어야 합니다.
- 화면은 정적 자산, `/api/studio/*`는 같은 주소의 Worker로 배포합니다. 키와 이용 코드는 `secret_text` 바인딩에만 넣습니다.
  공개 자산과 서버 코드에 실제 비밀 값이 포함되면 업로드 전에 중단합니다.
- `BUILD.txt`와 Worker 배포 메시지에 원본 SHA를 남깁니다. 배포 뒤 상태 API, AI 이용 코드 경계, 실제 응답을 확인합니다.
  요청 한도는 인스턴스 메모리 기준이며 계정 전체의 영구 사용량 한도는 아닙니다.
- 프로젝트는 브라우저 주소별 저장입니다. Pages/로컬/Workers 간에는 자동 이전되지 않습니다. 기존 주소의 저장 내용은 유지됩니다.

배포 절차는 Cloudflare의 [Direct Uploads](https://developers.cloudflare.com/workers/static-assets/direct-upload/)와
[module/secret metadata](https://developers.cloudflare.com/workers/configuration/multipart-upload-metadata/)를 사용합니다.

## 정적 빌드 (공개 Pages 체험)

```sh
node continuity/scripts/build-static.mjs    # 새 화면의 정적 체험: 지도·기록은 그대로, 정리 요청은 'AI 서버 미연결'
node continuity/scripts/build-static.mjs --preview  # 기존 공개 Pages 갱신: 이전 미리보기 저장 공간 유지
```

빌드 결과는 `continuity/static-dist`이고 CSP는 `connect-src 'none'`입니다. 선택적으로 `STUDIO_API_BASE=same-origin`이나
`https://origin`을 주면 그 서버로 요청하고, CSP도 그에 맞춥니다. 출력에 키 이름이나 공급자
주소가 있으면 빌드가 실패합니다.

## 검사

- `node --test continuity/tests/*.test.mjs`: 기존 도메인·수신·저장 검사와 `studio.test.mjs`(투영, 계약, 키·origin·오류 경계,
  `node:` 없는 handler).
- `python continuity/tests/studio_browser.py`: 스텁 공급자로 돌리는 흐름 스모크(실제 키 사용 안 함).
- 예전 continuity 브라우저 스위트는 교체된 UI의 좌표와 DOM을 단언하던 것이라 UI와 함께 정리했습니다.
