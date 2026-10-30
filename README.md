# AgentFlow Studio

AI 개발 도구(Codex·Claude 등)와 주고받은 **개발 기록을 프로그램의 지도로 바꿔 읽게 해 주는 PC 작업 도구**입니다.
요청·작업 보고·코드·검사 자료를 프로젝트의 부분과 관계에 연결하고, 그 위에서 다음 변경을 구상하고, 돌아온 결과를 원래 요청과 대조해 읽습니다.

> **이 `main` 브랜치에는 제품 코드가 없습니다.** 초기 역사 기준으로 남겨 둔 브랜치이며, 이 README는 안내판 역할만 합니다.
> 코드와 문서는 아래 **최신 개발 코드** 브랜치에 있습니다.

## 어디로 가면 되나요

| 하려는 일 | 바로 가기 |
| --- | --- |
| 설치 없이 써 보기 | [기존 지도 작업용 공개판(142)](https://agentflow-studio-existing-map-124.tlsee0813.workers.dev/) |
| 코드 보기·내 PC에서 실행하기 | [최신 개발 코드 README](https://github.com/tlsee0813-cmd/agentflow-studio/tree/work/experience142-reading-delivery#readme) |
| 구조 파악하기 | [구조 개요](https://github.com/tlsee0813-cmd/agentflow-studio/blob/work/experience142-reading-delivery/docs/ARCHITECTURE_KO.md) |
| 원하는 문서 찾기 | [문서 지도](https://github.com/tlsee0813-cmd/agentflow-studio/blob/work/experience142-reading-delivery/docs/README.md) |
| 설계 검토하기 | [설계 검토 시작점](https://github.com/tlsee0813-cmd/agentflow-studio/blob/work/experience142-reading-delivery/docs/REVIEW_START_HERE_KO.md) |
| 기여하기 | [기여 안내](https://github.com/tlsee0813-cmd/agentflow-studio/blob/work/experience142-reading-delivery/CONTRIBUTING.md) |

## 판본 구분

| 판본 | 위치 | 의미 |
| --- | --- | --- |
| 최신 개발 코드 | [`work/experience142-reading-delivery`](https://github.com/tlsee0813-cmd/agentflow-studio/tree/work/experience142-reading-delivery) | 수용된 구현과 실험이 이어진 개발 계열. 새 작업의 기준입니다. |
| 제한 공개 142 | [`release/experience142-reading`](https://github.com/tlsee0813-cmd/agentflow-studio/tree/release/experience142-reading) | 기존 지도 읽기만 좁게 조합해 공개한 판입니다. |
| 기존 공개 73 | [`checkpoint/2026-10-15`](https://github.com/tlsee0813-cmd/agentflow-studio/tree/checkpoint/2026-10-15) | 예전 전체 공개 기준입니다. |
| `main` | 이 브랜치 | 초기 역사 기준. 제품 코드를 담고 있지 않습니다. |

## 지금 상태 (2026-10-30)

실험 단계의 개발 계열입니다. 지도 읽기와 근거 왕복은 한정 공개까지 왔고, 이 PC의 Claude Code·Codex 세션 기록을 프로젝트에 자동으로 잇는 연결기가 개발 코드에 들어왔습니다.
"기록 → 지도 → 요청 → 구현 → 결과 반영" 전체 왕복을 실제 사용으로 검증한 것은 아닙니다. 단계별 근거는 [만들어진 기능과 남은 문제](https://github.com/tlsee0813-cmd/agentflow-studio/blob/work/experience142-reading-delivery/docs/review/2026-10-30/IMPLEMENTED.md)에 있습니다.
