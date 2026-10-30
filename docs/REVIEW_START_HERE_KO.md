# 설계 검토 시작점 — AgentFlow Studio

2026-10-30 KST. 별도 Claude 세션에서 현재 제품과 웹사이트를 검토할 수 있도록 정리한 **현황과 근거의 안내서**다. 전체 설계 방향·우선순위는 이 정리에서 새로 결정하지 않았다. 기존 제품개발은142 완료 후 멈춘 상태이며, 질문 초안 수리 등 다음 구현은 아직 시작하지 않았다.

## 먼저 볼 것

1. [만들어진 기능·실제 검증·열린 문제](review/2026-10-30/IMPLEMENTED.md) — 사용자 흐름별 현재 상태와 코드/수용 근거.
2. [웹사이트·판본·직접 확인 경로](review/2026-10-30/WEBSITES.md) — 접속 가능한 세 사이트와 로컬판의 차이.
3. [브랜치·PR·보관과 복구](review/2026-10-30/REPOSITORY.md) — 어떤 소스를 읽을지, 정리한 브랜치를 어떻게 찾을지.
4. 필요할 때 [ACTIVE](cycles/ACTIVE.md), [QUESTIONS](QUESTIONS.md), [142 종료 인수인계](COORDINATOR_PAUSE_2026-10-30_KO.md)를 읽는다. 사이클 기록 전체를 처음부터 다시 읽거나 완료 실험을 반복할 필요는 없다.

## 어느 것을 최신이라고 부르는가

| 목적 | 읽을 기준 | 의미 |
| --- | --- | --- |
| 최신 전체 개발 코드 | [work/experience142-reading-delivery](https://github.com/tlsee0813-cmd/agentflow-studio/tree/work/experience142-reading-delivery), 제품 코드 app tree93be1c55734f95e0040cd333e0d8bba3d3adb12b | 여러 수용 구현과 실험 결과가 이어진 개발 계열. 전체 제품 완성/배포 수용을 뜻하지 않는다 |
| 최신 전달된 읽기 체험 | [release/experience142-reading](https://github.com/tlsee0813-cmd/agentflow-studio/tree/release/experience142-reading), source76e3dc8a2939a4055ab1b99526b5cc1c98fd75e7 | 기존 지도 작업용 한정 공개.135 기반+140 읽기만 조합했으며 최신 전체 개발본과 다르다 |
| 기존 전체 공개 기준 | [checkpoint/2026-10-15](https://github.com/tlsee0813-cmd/agentflow-studio/tree/checkpoint/2026-10-15), app treeb670c0ea300050e28cdba9655515ebcf2e03d9d5 | 코드 기준은 공개73. 문서는 최신 정리를 계속 받으므로 HEAD 날짜와 제품 코드 판본을 혼동하지 않는다 |
| GitHub 기본 main | 기본 진입 안내 | 초기 역사 기준. README 안내만 최신화하며 최신 제품 코드를 main으로 통합한 것이 아니다 |

공개73 / 미수용74 / UI 범위 수용75(693d0c7)를 구별한다. PR번호와 사이클번호는 별개다. 특히 **PR75는 cycle135**, **cycle75는 PR45**다.

## 검토자가 구분해야 할 것

- 코드 구현·테스트 통과, 실제 AI 생성 내용의 정확성, 공개 배포, 실제 사용자 효용은 서로 다른 증거다. 작은 관문의 통과를 전체 완성으로 합산하지 않는다.
- 실제 기록 자동 연결기는 없다. 공통 예제는 합성/사후 편집이며, 사용자가 저장한 프로젝트는 해당 브라우저와 origin에 있다. 새 Claude 세션에 사용자의 프로젝트가 자동으로 나타나지 않는다.
- 139의 실제 micro 첫 지도는 한정 수용이다. 136 실제 RETURN은 계약 반려이며 원인 미확인이다. 141은 plan 한정 통과지만 scope/RQ의 필수 전제 판단을 반려했다. 실패를 삭제하거나 완료로 바꾸지 않았다.
- 140 읽기 수리를142로 전달했다. 공개 사이트가 열리고 읽기 화면이 좋아졌다고 “기록→지도→요청→구현→결과 반영” 전체가 검증됐다는 뜻은 아니다.

## 산출물의 위치

| 위치 | 무엇이 들어 있는가 | 읽는 법 |
| --- | --- | --- |
| app/continuity/src, app/continuity/server | 현재 제품 UI·공통 계약·서버 구현 | 최신 개발 branch 또는 정확 source SHA로 읽기 |
| docs/cycles | 사이클별 설계·작성자 결과·Root 수용·실험 실패·최소 증거 | 최신 현황에서 연결한 관문만 먼저 읽기. 번호가 크다고 제품 완성도가 높다는 뜻이 아님 |
| docs/research, docs/design, prototypes, experiments | 연구·시안·별도 실험 | 제품 반영 여부를 수용 기록/코드와 대조. 폴더에 존재한다고 제품 기능으로 세지 않기 |
| docs/transfer | 과거 전달·독립 검증용 산출물 | 당시 SHA와 범위의 기록. 최신 앱을 대신하지 않음 |
| docs/REPOSITORY_ARCHIVE.md | 10월15일의 이전 보관 기록 | 현재 브랜치 목록은 이 문서의 새 저장소 안내를 사용 |

전체 문서의 현행/기록 구분은 [문서 지도](README.md), 코드 배치와 실행 형태는 [구조 개요](ARCHITECTURE_KO.md)에 정리했다.

기존 PROJECT_STATUS·START_HERE·NEW_COORDINATOR_START 본문에는 옛 판본 설명이 남아 있다. app/README.md와 app/docs/PROJECT_STATUS.md는 이전 기본 앱의 기록이고, app/continuity/README.md도 일부 schema/API 설명이 오래돼 최신 판본표로 쓰면 안 된다. 이 정리에서 현행 안내를 위에 두고 과거 기록임을 표시한다. 과거 결과의 원문을 최신 사실처럼 고쳐 쓰지 않는다.

## 새 Claude 세션에 전달할 짧은 문장

> 이 저장소의 docs/REVIEW_START_HERE_KO.md부터 읽고, 연결된 구현 현황과 실제 웹사이트를 대조해 전체 설계 보강점을 검토해 주세요. 최신 전체 개발본·제한 공개142·기존 공개73을 구별하고, 완료된 연구/실험은 회수해 사용해 주세요. 구현·검사·실제 생성 품질·사용자 효용을 분리하고, 현재 부족한 점과 앞으로의 선택을 근거와 함께 제안해 주세요. 이 요청은 검토이며 곧바로 코드 수정·배포를 시작하는 요청이 아닙니다.
