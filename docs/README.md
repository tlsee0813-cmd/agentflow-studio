# 문서 지도

`docs/`에는 지금 쓰는 안내와 개발 과정의 기록이 함께 있습니다. 이 페이지는 **무엇을 먼저 읽고, 무엇은 필요할 때만 찾아보면 되는지** 나눠 둔 목록입니다.

> 표시 · **현행**은 지금 상태를 설명하는 안내입니다. **기록**은 작성 당시의 사실을 그대로 보존한 문서라, 판본·상태 설명이 지금과 다를 수 있습니다. 기록 문서의 본문은 고쳐 쓰지 않고, 낡은 경우 맨 위에 현행 안내로 가는 줄을 둡니다.

## 1. 처음 읽을 것 (현행)

| 문서 | 내용 |
| --- | --- |
| [README](../README.md) | 제품 소개, 바로 써 보기, 판본 구분 |
| [구조 개요](ARCHITECTURE_KO.md) | 코드 배치, 서버 요청, 실행 형태, 데이터 저장 |
| [기여 안내](../CONTRIBUTING.md) | 개발 환경, 검사, 키 관리, 문서·PR 약속 |
| [Studio 앱 안내](../app/continuity/README.md) | 화면 구성, 로컬·Windows·PC Codex 실행, API, Cloudflare·정적 빌드 |

## 2. 설계를 검토할 때 (현행)

| 문서 | 내용 |
| --- | --- |
| [설계 검토 시작점](REVIEW_START_HERE_KO.md) | 검토자가 구분해야 할 판본과 증거의 종류, 산출물 위치 |
| [만들어진 기능과 남은 문제](review/2026-10-30/IMPLEMENTED.md) | 사용자 흐름 단계별 구현·확인 범위·근거, 판본별 차이 |
| [웹사이트 안내](review/2026-10-30/WEBSITES.md) | 공개 주소별 판본과 한계, 새 브라우저에서 볼 수 있는 화면 |
| [브랜치·PR·보관과 복구](review/2026-10-30/REPOSITORY.md) | 정리한 브랜치·태그와 복구 방법 |
| [ACTIVE](cycles/ACTIVE.md) | 사이클별 최신 판단(위가 최신) |
| [QUESTIONS](QUESTIONS.md) | 연구 질문과 지금까지 쌓인 근거 |

## 3. 제품 방향과 설계

| 문서 | 내용 | 상태 |
| --- | --- | --- |
| [제품 방향과 연구 계획](PRODUCT_DIRECTION_AND_RESEARCH_PLAN_KO.md) | 제품의 목적, 원칙, 연구 주제 (개정 3.1, 2026-10-15) | 방향 기준 |
| [검토 반영 기록](REVIEW_DECISIONS_APPENDIX_KO.md) | 방향 문서의 판단 이유와 코드 근거 | 부록 |
| [소프트웨어 지도 설계](SOFTWARE_MAP_DESIGN_KO.md) | 전체 구성·묶음·표현 설계 (v1.3.1, 2026-10-26) | 설계 제안, 일부만 구현 |
| [AgentFlow 커넥터 설계](CONNECTOR_KO.md) | AI 세션에 직접 붙이는 세 가지 연결 방법, 로컬 MCP 커넥터, 웹 claude.ai용 원격 커넥터 계획 (2026-10-31) | 로컬 커넥터 구현, 웹은 설계만 |
| [design/](design/) | 지도·구성 시안 HTML과 이미지, SPATIAL101 시안 | 시안 |

## 4. 인수인계와 운영 기록 (기록)

총괄 세션이 바뀔 때 남긴 문서입니다. 최신은 맨 아래입니다.

| 문서 | 시점 |
| --- | --- |
| [START_HERE](START_HERE.md) | 공개 MOCK 시절의 첫 사용 안내 |
| [PROJECT_STATUS](PROJECT_STATUS.md) | 공개73 시절의 제품 기준·공개 버전표 |
| [REPOSITORY_ARCHIVE](REPOSITORY_ARCHIVE.md) | 2026-10-15 브랜치 보관 기록 |
| [NEW_COORDINATOR_START_KO](NEW_COORDINATOR_START_KO.md) · [NEW_SESSION_PROMPT_KO](NEW_SESSION_PROMPT_KO.md) | 2026-10-15 새 총괄 시작 안내와 전달 문구 |
| [COORDINATOR_HANDOFF_2026-10-24_KO](COORDINATOR_HANDOFF_2026-10-24_KO.md) · [handoffs/2026-10-24](handoffs/2026-10-24/) | 2026-10-24 인수인계와 당시 확인 상태 |
| [COORDINATOR_HANDOFF_2026-10-28_KO](COORDINATOR_HANDOFF_2026-10-28_KO.md) | 2026-10-28 인수인계 |
| [COORDINATOR_PAUSE_2026-10-30_KO](COORDINATOR_PAUSE_2026-10-30_KO.md) | 142 전달 뒤 일시정지 |

## 5. 사이클·검증 기록 (기록)

| 위치 | 내용 |
| --- | --- |
| [cycles/](cycles/) | 사이클마다 한 폴더(`날짜-주제-번호`). 설계, 작성자 결과, 독립 검토, 총괄 수용/반려, 최소 증거. 번호가 크다고 완성도가 높다는 뜻은 아닙니다 |
| [reviews/use106](reviews/use106/) | USE106 수정의 독립 검토와 Windows CI 수리 |
| [transfer/](transfer/) | 과거 전달·독립 검증용 산출물. 당시 SHA 기준이며 최신 앱을 대신하지 않습니다 |
| [review/2026-10-30/evidence](review/2026-10-30/evidence/) | 2026-10-30 검토 자료의 HTTP·제품 사실 증거 |

코드 주석과 테스트 이름의 번호(`AF100`, `flow090.test.mjs` 등)는 이 사이클 번호입니다. 근거를 찾을 때는 `cycles/`에서 같은 번호를 찾으면 됩니다.

### 개별 후보 노트

사이클 폴더 체계 이전(2026-10-12 ~ 10-15)에 `docs/` 바로 아래 남긴 단일 문서들입니다. 모두 **기록**입니다. 일부는 다른 기록에서 링크하고 있어 위치를 그대로 두었습니다.

| 문서 | 내용 |
| --- | --- |
| [idea022-results](idea022-results.md) | IDEA022 실측 결과, AI 내용 품질 보류 |
| [idea023-results](idea023-results.md) | IDEA023 실측 결과, 전체 채택 보류 |
| [quality024-t1-results](quality024-t1-results.md) | QUALITY024-T1 기술 결과와 blind 평가 |
| [quality025-status](quality025-status.md) | QUALITY025 실제 결과와 blind 평가 회수 |
| [quality026-design](quality026-design.md) | QUALITY026 경량 작업계획 설계와 실험 인계 |
| [flow049-outcome-home](flow049-outcome-home.md) | FLOW049 목적 중심 프로젝트 홈 |
| [flow083-project-entry](flow083-project-entry.md) | FLOW083 첫 사용, 내 프로젝트, 요청 흐름 |
| [fix088-intent-report-focus](fix088-intent-report-focus.md) | FIX088 현재 의도와 늦은 보고 분리 |
| [flow090-spatial-workspace](flow090-spatial-workspace.md) | FLOW090-A 공간형 작업 공간 첫 구현 |
| [flow090-map-operations](flow090-map-operations.md) | FLOW090-B1 공간 지도 조작 계약 |
| [flow091-usability-cleanup](flow091-usability-cleanup.md) | FLOW091-U 화면·문구·탐색 정리 |
| [flow091-background-contract](flow091-background-contract.md) | FLOW091-C 저장한 구상을 작업문 배경으로 연결 |
| [flow094-mock-scope](flow094-mock-scope.md) | FLOW094-M 검토 요청이 실행 지시로 바뀌던 MOCK 결함 |
| [flow095-handoff-dedupe](flow095-handoff-dedupe.md) | FLOW095 작업문의 요청 원문 반복 정리 |
| [guide097-area-guidance](guide097-area-guidance.md) | GUIDE097 영역 구상에서 첫 요청 초안까지 |
| [spatial102-enter-first](spatial102-enter-first.md) | SPATIAL102 진입 중심 틀 첫 단계 |

## 6. 연구와 실험 (기록)

| 위치 | 내용 |
| --- | --- |
| [research/](research/) | 질적 조사, 재사용 후보 판단, IDEA013~020 프롬프트·평가 결과, 외부 설계 의견 |
| [../experiments/](../experiments/) | IDEA013·014·016 실험 원본과 실행 스크립트 |
| [../prototypes/](../prototypes/) | 화면·흐름 시안 |
| [../examples/reel-label-guide](../examples/reel-label-guide/) | Studio 요청 흐름으로 만든 PC 시제품 (사이클 110) |

연구·시안 폴더에 있다고 제품 기능인 것은 아닙니다. 제품에 들어갔는지는 수용 기록과 코드로 대조합니다.

## 7. 초기 앱 문서 (기록)

`app/README.md`와 `app/docs/`는 첫 요청 정리 앱(INIT-003·004, 2026-10-10)의 기록입니다. 지금 화면은 `app/continuity/`이며, 초기 앱은 공용 서버 모듈과 회귀 검사 때문에 남아 있습니다.
