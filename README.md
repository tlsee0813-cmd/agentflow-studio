# AgentFlow Studio

AI와 나눈 개발 기록을 프로젝트 지도로 읽고, 변경 요청과 돌아온 보고를 비교하며 다음 세션에 이어 주는 PC 작업 도구입니다.

## 시작하기

| 하고 싶은 일 | 사용할 곳 |
| --- | --- |
| 설치 없이 화면과 예제 보기 | [공개 예제 체험](https://tlsee0813-cmd.github.io/agentflow-studio/) — AI 서버 없음 |
| 내 작업 기록과 AI 연결 | [PC 사용 안내](docs/USE_STUDIO_KO.md) — PC용 Studio 기본 주소는 http://127.0.0.1:4317 |
| 웹에서 지도·변경 요청 사용 | [웹 Studio](https://agentflow-studio.tlsee0813.workers.dev/) — AI 사용에는 기존 접속 코드 필요 |
| 웹 AI 기록을 PC로 전달 | [웹 AI 연결 안내](docs/USE_STUDIO_KO.md#웹-ai에서-이어가기) — 저장소 소유자의 GitHub 로그인 사용 |

프로젝트는 사용한 브라우저·주소에 저장됩니다. PC와 웹 사이를 옮길 때는 백업을 내보내고 가져오세요. API 키와 접속 코드는 채팅이나 저장소에 올리지 않습니다.

## 현재 판본과 확인 범위

2026-11-01 전달본은 PR93–107의 연결기·인수인계·화면 개선과 PR109의 저장·인증 동시성·근거 제외 이력 수리 및 PR110의 실제 OAuth 복귀 수리를 묶었습니다. 정확한 배포 커밋과 CI, PC 확인 결과는 [전달 결과](docs/releases/2026-11-01/RESULT.md)에 있습니다.

실제 기록 한 건에서 자동 연결 → 지도 생성 → 원문 확인 → 새로고침 복구 → 백업 → MCP 인수인계 회수를 확인했습니다. 긴 기록은 일부 구간만 AI에 전달될 수 있고, 이번 결과에도 근거보다 강하게 해석된 관계 한 건이 남았습니다. 지도와 인수인계는 원문과 함께 검토하는 AI 해석이며, 전체 의미 정확성이나 모든 복잡한 사례의 성공을 보장하는 완료 판정은 아닙니다.

기존 요청·결과 대조의 실제 PC 작성자 증거는 [PR105](https://github.com/tlsee0813-cmd/agentflow-studio/pull/105)에 있고, 이번 총괄의 실제 한 건 검증과 구별합니다. 과거 RETURN·scope 의미 반려는 이번 배포로 통과 처리하지 않았습니다.

## 내 PC에서 실행하기

Node 22.16 이상 22.x와 TypeScript 5.8.3 잠금 의존성을 사용합니다. 처음 준비할 때만 app 폴더에서 잠금 설치를 진행합니다. 이미 준비된 PC는 재설치할 필요가 없습니다.

```powershell
cd app
npm ci --ignore-scripts --no-audit --no-fund
node continuity/scripts/build.mjs
./continuity/scripts/start-local.ps1
```

기존 app/.env는 Node만 읽습니다. 다른 위치에 있다면 시작 스크립트의 -EnvFile에 전체 경로를 지정합니다. 키가 없으면 기록과 예제를 읽을 수 있고 AI 정리는 꺼져 있습니다. Codex CLI를 사용하는 별도 PC 입구는 [앱 설명](app/continuity/README.md)을 따릅니다.

## 검토와 기록

- [현재 상태](docs/cycles/ACTIVE.md) · [남은 질문](docs/QUESTIONS.md)
- [설계 검토 시작점](docs/REVIEW_START_HERE_KO.md) · [문서 지도](docs/README.md) · [구조 개요](docs/ARCHITECTURE_KO.md)
- [이전 브랜치 보관과 복구](docs/review/2026-10-30/REPOSITORY.md)

최신 제품 코드는 work/experience142-reading-delivery 계열입니다. main은 안내용 초기 계보이며 제품 코드 통합 브랜치가 아닙니다. 제한 공개142, 과거 공개73, 미수용74, UI 범위 수용75(693d0c7)는 각각의 판정과 소스를 보존합니다. PR 번호와 사이클 번호는 별개입니다.
