# AgentFlow Studio

AI 개발 도구(Codex·Claude 등)와 주고받은 **개발 기록을 프로그램의 지도로 바꿔 읽게 해 주는 PC 작업 도구**입니다.
요청·작업 보고·코드·검사 자료를 프로젝트의 부분과 관계에 연결하고, 그 위에서 다음 변경을 구상하고, 돌아온 결과를 원래 요청과 대조해 읽습니다.

> **지금 상태 (2026-10-31)** · 실험 단계의 개발 계열입니다. 읽기·근거 왕복은 한정 공개까지 왔고, 이 PC의 Claude Code·Codex 세션 기록을 프로젝트에 자동으로 잇는 연결기와 인수인계 문서가 개발 코드에 들어왔습니다(#78~#91). 외부 검토가 찾은 기록 누락·취소 문제 4건은 #93에서 고쳤습니다. 실제 프로젝트 하나로 처음부터 끝까지 확인하는 일은 아직 남아 있습니다.
> 다만 "기록 → 지도 → 요청 → 구현 → 결과 반영" 전체 왕복을 실제 사용으로 검증한 것은 아닙니다.

---

## 무엇을 하나요

| 단계 | 하는 일 |
| --- | --- |
| 1. 자료 넣기 | 작업 폴더를 연결하면 그 폴더의 Claude Code·Codex 세션이 기록으로 자동으로 들어옵니다. 원문이나 코드·검사 파일을 직접 붙여 넣을 수도 있습니다. 출처와 정확한 원문은 그대로 보존합니다. |
| 2. 지도 만들기 | 기록에서 프로그램의 부분·관계를 뽑아 첫 지도 후보를 만들고, 사람이 확인한 뒤 반영합니다. |
| 3. 부분 읽기 | 지도에서 부분을 골라 현재 상황, 최근 변화, 근거 원문을 오가며 읽습니다. |
| 4. 변경 구상 | 요구와 실제 자료로 바꿀 항목·유지할 조건·확인할 점을 정리하고, 고른 범위를 고정 요청문으로 저장합니다. |
| 5. 결과 읽기 | 돌아온 보고·코드·검사 근거를 고정 요청과 연결해 "보고된 것 / 근거가 있는 것 / 확인된 것"을 나눠 봅니다. |
| 6. 이어 맡기기 | 프로젝트나 한 부분의 인수인계 문서를 AI 호출 없이 만들어 새 세션에 붙여 넣습니다. 그 문서로 시작한 세션은 지도에 "이어받은 세션"으로 표시됩니다. 웹 AI 대화로 이어 가면 기록 요청 문구로 그 대화의 기록을 받아 붙여 넣습니다. |

2~5단계가 어디까지 실제로 확인됐는지는 [만들어진 기능과 남은 문제](docs/review/2026-10-30/IMPLEMENTED.md)에 단계별 근거와 함께 있습니다. 1단계의 자동 연결과 6단계는 그 정리 이후에 들어온 기능이라 자동 테스트와 작성자의 실제 PC 확인(#91)까지만 됐습니다.

## 바로 써 보기

### 설치 없이

[기존 지도 작업용 공개판(142)](https://agentflow-studio-existing-map-124.tlsee0813.workers.dev/)을 엽니다.
예제 프로젝트로 지도 읽기·근거 왕복·변경 구상을 볼 수 있습니다. 첫 지도 생성과 지도 갱신은 이 판에서 막혀 있고, AI 정리는 접속 코드가 필요합니다.
다른 공개 주소와 각각의 차이는 [웹사이트 안내](docs/review/2026-10-30/WEBSITES.md)에 정리돼 있습니다.

### 내 PC에서

Node **22.16 이상 22.x**, npm 10이 필요합니다. 모든 명령은 `app/`에서 실행합니다.

```sh
cd app
npm ci --ignore-scripts --no-audit --no-fund
npm run build && node continuity/scripts/build.mjs
node continuity/server/index.mjs --mock      # http://127.0.0.1:3000
```

키 없이(`--mock`) 실행하면 지도·기록·예제와 세션 연결은 그대로 쓸 수 있고, AI 정리 요청만 `AI_NOT_CONFIGURED`로 정직하게 실패합니다. 대체 응답은 만들지 않습니다.
로컬 서버는 이 PC의 `~/.claude`, `~/.codex` 세션 기록을 **읽기만** 합니다(`STUDIO_SESSIONS=off`로 끔).
실제 AI 정리를 쓰려면 `app/.env`에 `DEEPSEEK_API_KEY=...`를 두고 `node --env-file-if-exists=.env continuity/server/index.mjs`로 실행합니다.
Windows 전용 실행 스크립트, PC에 설치된 Codex로 지도를 정리하는 입구, Cloudflare 배포는 [Studio 앱 안내](app/continuity/README.md)를 봅니다.

## 판본 구분

이 저장소에는 성격이 다른 판본이 함께 있습니다. 검토하거나 기여하기 전에 어느 것을 보는지 먼저 정하세요.

| 판본 | 위치 | 의미 |
| --- | --- | --- |
| 최신 개발 코드 | [`work/experience142-reading-delivery`](https://github.com/tlsee0813-cmd/agentflow-studio/tree/work/experience142-reading-delivery) | 수용된 구현과 실험이 이어진 개발 계열입니다. 새 작업은 여기를 기준으로 합니다. |
| 제한 공개 142 | [`release/experience142-reading`](https://github.com/tlsee0813-cmd/agentflow-studio/tree/release/experience142-reading) | 기존 지도 읽기만 좁게 조합해 공개한 판입니다. 최신 개발 코드와 다릅니다. |
| 기존 공개 73 | [`checkpoint/2026-10-15`](https://github.com/tlsee0813-cmd/agentflow-studio/tree/checkpoint/2026-10-15) | 예전 전체 공개 기준입니다. 문서만 이후에도 갱신됐습니다. |
| `main` | 기본 브랜치 | 초기 역사 기준이며 최신 제품 코드를 담고 있지 않습니다. |

정확한 커밋 SHA와 정리·보관된 브랜치 목록은 [브랜치·PR·보관과 복구](docs/review/2026-10-30/REPOSITORY.md)에 있습니다.

## 저장소 구성

```text
app/
  continuity/        현재 Studio 앱 (화면·공통 계약·서버·배포 스크립트·테스트)
  server/, src/      초기 요청 정리 앱(INIT-004). 설정·오류·한도 모듈은 Studio 서버도 함께 씁니다. 해시로 고정된 기록이라 고치지 않습니다.
  tests/, scripts/   초기 앱의 테스트와 빌드
docs/                설계 문서, 사이클별 기록, 연구, 검토 자료  →  docs/README.md
experiments/         프롬프트·평가 실험 (제품 기능 아님)
prototypes/          화면·흐름 시안 (제품 기능 아님)
examples/            Studio 요청 흐름으로 실제로 만들어 본 작은 시제품 (사이클 110)
.github/workflows/   PR마다 Linux·Windows에서 도는 검사 (실제 AI 호출 없음)
```

구조와 데이터 흐름은 [구조 개요](docs/ARCHITECTURE_KO.md)에서 그림과 함께 설명합니다.

## 문서

| 읽을 때 | 문서 |
| --- | --- |
| 처음 왔을 때 | 이 README → [구조 개요](docs/ARCHITECTURE_KO.md) |
| 설계를 검토할 때 | [설계 검토 시작점](docs/REVIEW_START_HERE_KO.md) |
| 원하는 문서를 찾을 때 | [문서 지도](docs/README.md) |
| 코드를 고치거나 PR을 올릴 때 | [기여 안내](CONTRIBUTING.md) |
| 현재 판단과 열린 질문 | [ACTIVE](docs/cycles/ACTIVE.md) · [QUESTIONS](docs/QUESTIONS.md) |

## 진행 중인 작업

화면 다듬기와 서버 시작·설정 점검 개선이 별도 PR로 이어지고 있습니다.
병합 전까지는 위 설명과 다를 수 있는 세부 사항이 있으니, 최신 상태는 [열린 PR 목록](https://github.com/tlsee0813-cmd/agentflow-studio/pulls)에서 확인하세요.
