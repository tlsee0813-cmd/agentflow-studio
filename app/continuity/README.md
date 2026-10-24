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

화면에서 바꿀 수 있는 저장 데이터는 부분의 이름과 설명뿐이며, 도메인의 `editArea`를 거칩니다. 정리 결과는 프로젝트와
분리된 키(`agentflow.studio.answers.1`)에 둡니다. 예제의 정리 결과는 메모리에만 둡니다.

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

## Studio API

`server/studio.mjs`의 `createStudioHandler({ env })`는 표준 `(Request) => Promise<Response>`입니다. `node:` import가 없습니다.

| 경로 | 내용 |
|---|---|
| `GET /api/studio/status` | `{ ai: 'deepseek' \| 'off', model, access: 'open' \| 'code' }` |
| `POST /api/studio/ask` | `studio.1` 요청(부분과 기록 최대 14개) → 검증된 `{ headline, situation[], changes[], next[], answer, refs[] }` |

- 키: `env.DEEPSEEK_API_KEY`에서만 읽습니다. 공급자 Authorization 헤더로만 쓰고, 응답·로그·번들에는 넣지 않습니다.
- 공급자: `https://api.deepseek.com/chat/completions`, JSON mode, 모델 `DEEPSEEK_MODEL`(기본 `deepseek-flash`).
- 경계: 같은 origin만 허용합니다. 다른 origin은 `STUDIO_ALLOWED_ORIGINS`에 정확히 적힌 것만 CORS로 허용합니다.
  POST에는 `X-AgentFlow-Request: 1` 헤더와 JSON이 필요합니다. `STUDIO_ACCESS_CODE`를 설정하면 사용자가 입력한
  코드(`X-Studio-Access`)를 요구합니다.
- 한도(선택): `STUDIO_TIMEOUT_MS`, `STUDIO_MAX_TOKENS`, `STUDIO_REQUESTS_PER_MINUTE`, `STUDIO_MAX_CONCURRENT`, `STUDIO_CALL_CAP`.
- 로컬 Node: `server/app.mjs`가 기존 localhost Host 검사를 먼저 하고 그다음 `/api/studio/*`를 handler에 넘깁니다.
  기존 `/api/continuity`·`/api/guidance` 경계는 바뀌지 않았습니다.
- handler는 `node:` 없이 import됩니다(`server/worker.mjs`는 Worker 형식의 얇은 예시). 이번 범위의 실행은 로컬 서버입니다.

## 정적 빌드 (공개 Pages 체험)

```sh
node continuity/scripts/build-static.mjs    # 새 화면의 정적 체험: 지도·기록은 그대로, 정리 요청은 'AI 서버 미연결'
```

빌드 결과는 `continuity/static-dist`이고 CSP는 `connect-src 'none'`입니다. 선택적으로 `STUDIO_API_BASE=same-origin`이나
`https://origin`을 주면 그 서버로 요청하고, CSP도 그에 맞춥니다. 출력에 키 이름이나 공급자
주소가 있으면 빌드가 실패합니다.

## 검사

- `node --test continuity/tests/*.test.mjs`: 기존 도메인·수신·저장 검사와 `studio.test.mjs`(투영, 계약, 키·origin·오류 경계,
  `node:` 없는 handler).
- `python continuity/tests/studio_browser.py`: 스텁 공급자로 돌리는 흐름 스모크(실제 키 사용 안 함).
- 예전 continuity 브라우저 스위트는 교체된 UI의 좌표와 DOM을 단언하던 것이라 UI와 함께 정리했습니다.
