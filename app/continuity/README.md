# AgentFlow Studio (continuity)

Codex·Claude에서 평소처럼 개발한 기록(요청·작업 보고·확인 자료)을 프로젝트의 부분에 연결해서 보여 줍니다.
보이는 것은 구조, 최근 변화, 진행 상태, 다음에 판단할 것입니다. 기록 연결기는 아직 없습니다. 예제는 전달받았다고
가정하고 쓴 기록이며, 실제 수신 모델(`agentflow.return.2`)로 만들어집니다.

## 화면

1. **프로젝트**: 예제 2개와 이 브라우저에 저장된 프로젝트(`idea015.project.7`, 기존 저장 그대로)가 보입니다.
2. **지도**: 창에 고정된 캔버스입니다. 노드는 고정 크기이고 이름과 상태만 표시합니다. 그룹은 저장된 포함 관계(containment)
   그대로 그리고, 선은 저장된 관계(relations)를 그립니다. 왼쪽에는 최근 변화가 있습니다. 드래그로 이동하고,
   Ctrl/⌘+휠이나 버튼으로 확대·축소합니다.
3. **부분 상세**: 노드를 선택해야 열립니다. 순서는 지금 상황 → 최근 변화 → 안의 부분·연결 → 기록 원문 → 정리 결과입니다.
   아래 입력에서 ‘지금 상황 정리’, ‘다음에 판단할 것’을 누르거나 직접 질문하면 서버가 DeepSeek에 요청합니다.
   응답에서 근거 기록과 지도 위 관련 부분으로 이동할 수 있습니다. Esc나 지도 클릭으로 닫습니다.

홈에서 내 프로젝트를 만들고, 지도에서 부분과 하위 부분을 추가하거나 이름·설명을 고칠 수 있습니다. 기존 도메인 함수를 사용하며 원래 기록을 고쳐 쓰지 않습니다. 정리 결과와 질문 초안은 프로젝트와 분리된 키에 둡니다. 예제의 정리 결과와 초안은 메모리에만 둡니다.

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

Windows에서 빌드가 이미 있다면 PowerShell로 `./continuity/scripts/start-local.ps1`을 실행할 수 있습니다. `app/.env`를 읽고 백그라운드에서 실행한 뒤 `http://127.0.0.1:4317`을 엽니다. 키 파일을 다른 비공개 위치에 보관했다면 `-EnvFile 'C:\private\studio.env'`를 지정합니다. 기존 Node 또는 Codex에 설치된 Node를 재사용하며 패키지를 설치하지 않습니다. 이미 같은 포트의 Studio가 실행 중이면 다시 띄우지 않습니다. 브라우저 저장은 주소별이므로 같은 포트를 계속 사용하세요.

### PC에서 설치된 Codex로 지도 정리하기 (선택)

이 PC에 이미 설치·로그인된 Codex CLI로 첫 지도와 이후 기록 대조를 하려면 `start-local.ps1` 대신 아래를 실행합니다(`app/` 디렉터리, 빌드 후). 정책 파일을 쓸 필요가 없습니다.

실행 조건: Windows의 PowerShell 7(`pwsh`)에서 확인했습니다(7.6.5). Windows PowerShell 5.1에서는 그 PC의 스크립트 실행 정책에 따라 이 스크립트 실행이 막힐 수 있습니다. 이 스크립트는 실행 정책을 바꾸지 않습니다.

```powershell
./continuity/scripts/start-pc.ps1                          # 시작(이미 실행 중이면 다시 열기), 브라우저가 열림
./continuity/scripts/start-pc.ps1 -CodexPath 'C:\…\codex.exe'  # codex.exe를 찾지 못했다고 하면 경로를 알려 주기
./continuity/scripts/start-pc.ps1 -Stop                    # 종료
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
| `GET /api/studio/status` | `{ ai: 'deepseek' \| 'off', model, access: 'open' \| 'code' }` |
| `POST /api/studio/ask` | `studio.1` 요청(부분과 기록 최대 14개) → 검증된 `{ headline, situation[], changes[], next[], answer, refs[] }` |
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
