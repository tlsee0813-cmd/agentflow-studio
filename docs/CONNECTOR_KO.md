# AgentFlow를 AI 세션에 직접 붙이기 (커넥터 설계)

> 2026-10-31. "로컬 기록 파일을 읽는 대신 커넥터처럼 세션에 연동할 수 없나?"에 대한 답과, 이번에 들어간 최소 구현입니다.

## 결론

된다. 다만 "어디서 쓰는 AI냐"에 따라 길이 달라서, 사용자가 고르는 연결 방법은 **세 가지**로 묶는다.

| 고르는 것 | 이런 사람에게 | 어떻게 붙나 | 상태 |
| --- | --- | --- | --- |
| **자동 읽기** | 이 PC에서 Claude Code·Codex를 쓰는 사람 (기본) | Studio가 이 PC의 세션 파일을 읽는다. 설치할 것 없음 | 있음 |
| **AgentFlow 커넥터** | 같은 사람인데, 새 세션이 인수인계를 **스스로** 받고 일을 마치면 **스스로** 기록하게 하고 싶을 때 | AI 도구에 MCP 서버를 하나 추가 (명령 한 줄) | **이번 PR (로컬)** |
| **웹 AI 커넥터** | claude.ai 웹·모바일, Claude 데스크톱 채팅에서 일하는 사람 | claude.ai 설정의 사용자 지정 커넥터에 주소 하나 추가 | 설계만. 공개 배포는 확인 후 |

hooks(도구를 부르지 않아도 자동으로 남기는 방법)는 따로 고르는 칸으로 두지 않고, 다음 단계에서 **AgentFlow 커넥터 설치에 함께 묶는다**(아래 "다음 단계"). 사용자 입장에서는 "커넥터를 켰다" 하나로 보이게 한다.

## 왜 이렇게 나눴나: 각 도구가 지원하는 것

| | 로컬 MCP (stdio) | 원격 MCP (HTTP) | 자동 실행(hooks) |
| --- | --- | --- | --- |
| **Claude Code** | 된다 (`claude mcp add`, 프로젝트의 `.mcp.json`) | 된다 | 된다. `SessionStart`(나온 글이 세션 맥락에 들어감), `UserPromptSubmit`, `Stop`, `SessionEnd` 등. 입력 JSON에 `session_id`, `transcript_path`, `cwd` |
| **Codex** | 된다 (`~/.codex/config.toml`의 `[mcp_servers.*]`) | 된다 | 된다. `SessionStart`, `UserPromptSubmit`, `Stop`, `SessionEnd` 등. `hooks.json` 또는 `config.toml`의 `[hooks]`. 처음 한 번 `/hooks`에서 신뢰해야 돈다. SessionStart의 출력은 맥락에 들어감 |
| **claude.ai 웹·모바일** | 안 된다 | **된다**. 사용자 지정 커넥터 = 인터넷에서 닿는 원격 MCP 서버(Streamable HTTP). OAuth, 고정 헤더, 무인증 중 하나 | 없다 |
| **Claude 데스크톱 채팅** | 된다 (데스크톱 확장 MCPB, 설정 파일) | 된다 | 없다 |

핵심 두 가지:

1. **이 PC의 Claude Code·Codex는 이미 자동이다.** 세션 파일에 사람의 요청과 최종 답이 모두 있으므로, 기록만 놓고 보면 커넥터가 더 주는 게 없다. 커넥터가 새로 주는 것은 **반대 방향**, 즉 AI가 Studio에서 인수인계를 직접 받아 가는 것이다.
2. **웹 claude.ai는 PC의 127.0.0.1에 닿을 수 없다.** Anthropic 클라우드가 접속하므로 공개 HTTPS 주소의 원격 서버가 있어야 한다. 그래서 웹용은 따로 묶는다.

## 도구 호출 vs 자동 기록

| | AI가 도구를 부른다 (MCP) | 도구 없이 자동 (세션 파일 / hooks) |
| --- | --- | --- |
| 빠뜨림 | AI가 잊으면 안 남는다 | 안 빠진다 |
| 내용 | AI가 정리한 요약 (요청 원문을 그대로 옮기라고 지시) | 사람이 쓴 원문과 최종 답 그대로 |
| 인수인계 받기 | **된다** (AI가 필요할 때 부름) | SessionStart hook이면 시작할 때 자동으로 넣을 수 있다 |
| 쓸 수 있는 곳 | 웹 포함 어디서나 | 이 PC의 Claude Code·Codex만 |

**추천**: 기록은 빠지지 않는 쪽(자동 읽기)을 기본으로 두고, 커넥터는 ① 인수인계를 받아 가는 통로, ② 세션 파일이 없는 곳(웹)의 기록 통로로 쓴다. Claude Code에서 자동 읽기와 커넥터 기록을 둘 다 켜면 같은 요청이 두 번(원문 한 번, AI 요약 한 번) 들어갈 수 있다. 지금은 그대로 두고, 다음 단계에서 "자동 읽기 중인 폴더의 Claude Code·Codex 커넥터 기록은 원문 기록에 붙여 보고로만 쓴다" 같은 규칙으로 정리한다.

## 이번 PR: 로컬 AgentFlow 커넥터

```
AI 세션 (Claude Code·Codex)
  └─ MCP stdio ─ app/continuity/connector/agentflow-mcp.mjs   (패키지 설치 없음, Node만)
                   └─ HTTP ─ 이 PC의 Studio 127.0.0.1:4317
                               ├─ /api/studio/connector/records   AI가 남긴 기록 → 받은 기록함
                               └─ /api/studio/connector/handover  브라우저가 둔 최신 인수인계 → AI가 받아 감
브라우저 (Studio 탭)
  └─ 자동 연결이 1분마다: 받은 기록함에서 이 프로젝트 폴더의 기록을 가져와 저장 → 지도 갱신
                          프로젝트가 바뀌었으면 인수인계 문서를 새로 만들어 둠
```

- **도구 두 개**: `agentflow_handover`(인수인계 받기), `agentflow_record`(요청 원문·한 일·바꾼 파일 기록). 지도 조회는 인수인계 문서에 "프로젝트 한눈에·부분과 관계·맡긴 변경 요청"이 다 들어 있어 따로 두지 않았다.
- **어느 프로젝트로 가나**: 커넥터를 띄운 작업 폴더(또는 그 안쪽)에 자동 연결된 프로젝트. 기록은 세션 가져오기와 같은 머리줄(`[Claude Code 세션 기록 · 제목 · 작업 폴더 … · 브랜치 …]`)로 저장되어, 지도·인수인계·세션 이름이 기존 기록과 똑같이 읽는다. 머리줄은 서버가 만들고, AI가 보낸 글로 바꿀 수 없다.
- **저장 위치**: 프로젝트는 지금처럼 브라우저에만 있다. Studio는 받은 기록함(최근 14일, 500개)과 프로젝트별 최신 인수인계 하나를 `app/continuity/.studio-data/connector-<port>/connector.json`에 둔다(`.gitignore`에 있음, `STUDIO_CONNECTOR_DIR`로 위치 변경, `STUDIO_CONNECTOR=off`로 끔).
- **비밀값**: 키·토큰·비밀번호처럼 보이는 곳은 파일에 쓰기 전에 `[가려진 비밀값]`으로 바꾼다. 커넥터 자체는 키를 갖지 않는다. Studio에 접속 코드를 걸었다면 `AGENTFLOW_ACCESS_CODE`로 넘긴다.
- **경계**: 세션 목록과 같다. 같은 origin과 `X-AgentFlow-Request: 1`만 받으므로 다른 웹사이트는 못 부른다(허용 origin 목록에 있어도 거절). localhost Host 검사도 그대로. Worker·정적 빌드·제한 공개판에는 없다.

### 켜는 법

Studio를 평소처럼 켜고(`start-local.ps1`, 4317), 프로젝트를 작업 폴더에 자동 연결해 둔 뒤:

```sh
# Claude Code (작업 폴더에서)
claude mcp add agentflow -- node "<저장소>/app/continuity/connector/agentflow-mcp.mjs"
```

```toml
# Codex: ~/.codex/config.toml
[mcp_servers.agentflow]
command = "node"
args = ["<저장소>/app/continuity/connector/agentflow-mcp.mjs"]
```

다른 포트면 `AGENTFLOW_URL=http://127.0.0.1:4327`, 작업 폴더를 정해 주려면 `AGENTFLOW_FOLDER`.

### 확인한 것

- 이 컨테이너에서 Studio(4317, AI 없이)를 켜고, 브라우저에서 새 프로젝트를 저장소 폴더에 자동 연결한 상태로 **Claude Code(`claude -p`)에 커넥터를 붙여** "인수인계를 받아 첫 제목 줄을 알려 주고, 이 요청을 기록해 줘"를 시켰다. Claude Code가 `# 인수인계: 라이브 시험`을 그대로 답했고, 남긴 기록이 40초 뒤 그 프로젝트의 기록으로 들어왔다(가져온 기록 2개 → 3개).
- 테스트 `continuity/tests/connector143.test.mjs`: 기록 머리줄·비밀값·폴더 범위·재시작 유지, 입력 검사, 인수인계 교체, 라우트 경계, 실제 stdio로 initialize→도구 목록→기록→인수인계, Studio가 꺼졌거나 거절할 때의 안내.
- 아직 안 한 것: leek PC(Windows)의 실제 Claude Code·Codex 앱에서 확인.

## 웹 AI 커넥터 (claude.ai용) 설계

공개 배포는 leek 확인 뒤에 한다. 결정이 필요한 것은 아래 "정할 것".

- **서버**: 이미 있는 Cloudflare Worker에 `/mcp`(Streamable HTTP)를 더한다. 도구는 로컬과 같은 두 개.
- **저장**: 프로젝트는 계속 브라우저에 둔다. Worker에는 **받은 기록함**만 둔다(사용자별, Durable Object 또는 KV). Studio 탭(공개 주소든 로컬이든)이 열리면 받아 가고, 받아 간 기록은 지운다. 14일이 지나면 지운다.
- **인수인계 받기**: 웹 AI가 인수인계를 받으려면 브라우저가 그 문서를 Worker에 올려 둬야 한다. 즉 **프로젝트 요약이 클라우드에 저장된다.** 그래서 이것은 프로젝트마다 켜는 선택으로 둔다.
- **인증과 비밀값**:
  - 최소안: Studio가 사용자마다 긴 무작위 **연결 주소**(`https://…/mcp/<비밀값>`)를 만들어 주고, 사용자는 그 주소를 claude.ai 커넥터에 붙인다. 쉽지만 주소가 새면 누구나 기록을 넣을 수 있으므로, Studio에서 언제든 폐기·재발급할 수 있게 한다.
  - 정석: OAuth 2.1(claude.ai는 동적 클라이언트 등록을 지원). 공개 디렉터리에 올리거나 여러 사람이 쓰면 이쪽.
  - Worker의 서명 키 같은 비밀값은 지금 DeepSeek 키처럼 `secret_text` 바인딩에만 넣고, 화면 번들·응답·로그에는 넣지 않는다. 받은 기록은 저장 전에 가린다.
- **로컬 Studio와 잇기**: 로컬 Studio도 같은 받은 기록함을 가져올 수 있게 하면, 웹에서 한 일이 PC 지도에도 들어온다(브라우저가 Worker에 연결 주소의 비밀값을 들고 요청).

### 정할 것 (leek)

1. 웹 커넥터 인증: 연결 주소(빠름) / OAuth(정석)
2. 인수인계를 클라우드에 올리는 것을 허용할지(프로젝트마다 켜기)

## 다음 단계

1. **커넥터 설치에 hooks 묶기 (Claude Code 플러그인)**: 플러그인 하나에 MCP 서버와 hooks를 같이 넣으면 설치 한 번으로 끝난다.
   - `SessionStart`: 이 폴더의 인수인계를 세션 맥락에 자동으로 넣는다(AI가 도구를 부르지 않아도 됨).
   - `Stop`: 대화가 끝난 순간 Studio에 알려, 2분 기다리지 않고 바로 기록을 가져가게 한다.
   - Codex도 같은 hooks가 있어 같은 방식으로 붙는다.
2. **중복 정리**: 자동 읽기 중인 폴더의 Claude Code·Codex 커넥터 기록은 원문 기록과 합친다.
3. **설정 화면**: 자동 연결 패널에 "연결 방법" 세 가지(자동 읽기 / AgentFlow 커넥터 / 웹 AI 커넥터)를 보여 주고, 커넥터는 복사할 설치 명령을 띄운다.
4. **웹 AI 커넥터**: 위 "정할 것"이 정해지면 Worker에 구현하고, 확인 뒤 배포.
5. **더 붙일 것** (유사 도구 조사, `docs/research/integration-landscape-2026-10-31.md` 7절): 기록 도구의 보고를 요청 id와 함께 `agentflow.return.2` 후보로 받아 사용자가 확인한 뒤 반영하기, 부분·관계만 돌려주는 지도 조회 도구, 대화창 안에 지도 카드를 띄우는 MCP Apps, Claude 데스크톱용 MCPB 패키지와 MCP Registry 등록.

## 참고

- Claude 커넥터(원격 MCP) 만들기: https://claude.com/docs/connectors/building
- Codex hooks: https://learn.chatgpt.com/docs/hooks
- MCP stdio 전송: 한 줄에 JSON-RPC 메시지 하나 (https://modelcontextprotocol.io)
