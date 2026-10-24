# AgentFlow 현재 상태

2026-10-24 KST. **출처 제안 검토40 수용·기존 공개 GitHub Pages 갱신 완료.** [PC 체험본](https://tlsee0813-cmd.github.io/agentflow-studio/) · [판단·검증·한계](2026-10-24-source-proposals-40/DECISION.md) · [제품/배포 기준](../PROJECT_STATUS.md) · [질문별 근거](../QUESTIONS.md). 인계4a9873a5와 원격 HEAD/ACTIVE/QUESTIONS를 대조한 뒤 기존 반환·연구를 회수하고 차이만 반영했다.

## 현재 제품과 배포

- 최신 수용 source `44cfc9ade567b3b7cfe66af57d9762d5bf1ead39`, app tree `c6172dd71c592ae331931b5d9e5ca5b60b0e77d0`. [40 판단·독립검증](2026-10-24-source-proposals-40/DECISION.md), [정확 양OS CI](2026-10-24-source-proposals-40/CI.md). 아래38 흐름 위에 홈의 작은 기록 검토 진입→예제/JSON→제안/원문 왕복·제외/분리→홈 복귀를 더했다. 검토는 탭 메모리만 쓰며 실제 project 연결/적용은 없다.
- 현재 Pages 배포 `d2ecd38141384ce54b69563f2512a15beb4a53f8`, runtime20개·HTTP19개 일치. [배포/키 포함0건](2026-10-24-source-proposals-40/DEPLOYMENT.json). 이전38 배포는 rollback 기준이며 최신 공개판은40이다.

- 이전38 수용 source `c7329aa8b941791633d5f22da4ca105188aab0be`, app tree `af4556e7463fa76ce36938220c52447bd539cd3f`.36fix2 포함, 최신 인계 문서 보존. checkpoint로 fast-forward. [PR21 merged](https://github.com/tlsee0813-cmd/agentflow-studio/pull/21).
- 프로젝트 홈→비저장 예제 지도→부분/작업→이어가기→지도 복귀→예제 닫기→빈 내 프로젝트 시작.1280에서 복귀 안내가 지도 높이를 줄이던 반례를 수정했다. 초안·기존 프로젝트 bytes·지도 memo 보존과 예제 저장0을 독립 확인했다.
- 정확 source의 [CI](2026-10-24-entry-integration-38/CI.md)는 양OS success. 첫 Windows main app 시작5000ms timeout은 기록하고 같은 SHA의 Windows를 한 번 재실행했다. skip을 통과로 세지 않는다. [독립 실행](2026-10-24-entry-integration-38/independent38/REPORT.md)은 별도 Windows Chrome155/Node24이며 CI143/Node22와 구별한다.
- 이전38 공개 게시 `4ebf8fa39df1353f9853aa3819c6917a609aa74b`. Git runtime17개와 HTTP runtime16개 해시 일치, 공개 화면 예제 왕복 확인. [배포 manifest](2026-10-24-entry-integration-38/DEPLOYMENT.json). 실제 AI 없는 브라우저 MOCK, preview 저장 접두사로 옛 공개 demo 데이터와 분리한다. 기존 private Sites35는 그대로이며 최신 체험본이 아니다.
- 1280 기본78% 작은 글씨·긴 동일접두어·큰지도·125%·IME·다른탭 live·실제AI 의미품질·사람 사용성은 해결/검증되지 않았다.34/26/28 반례와 GUIDE107 HOLD는 유지한다.

## 접수와 반환 — 중복 제출 금지

| 담당/주제 | 원본 접수·반환 | 상태 |
|---|---|---|
| Claude37 복귀 수정 | session_01KJRKarPuyzvnMWCkvYQbW1, 동일 문제 후속 메시지2/4; 반환0fa38e0 | 완료·app tree 동일하게 결합·수용. 남은 작성자 회귀도 회수 완료 |
| 독립 Sol High36/38 | /root/verify36_prepare;38beb559/c7329aa | 완료. source/검사 수정 없음. 대표4PNG·환경/exit/해시만 cycle38에 공유 |
| Pro 가독성 비교 | Oracle af-map-readable-delta-20261024, exec71068 | completed·exit0·원문3출처 대조. [결정](2026-10-24-entry-integration-38/READABILITY_DECISION.md): 구조/시야를 유지한 저배율 이름·이유 표현 B를 후속 단일장면 실험후보로만 선택 |
| DeepSeek 정리v0 | session-a924bcea-2100-41b0-8112-474736972dd0, c7329aa·실제8사건 | completed·exit0·후보3개 반환. 원문/고정project 독립대조 후 보정 완료 |
| 독립 Sol High 정리v0 | /root/organizer_inputs, 같은 실제표본과 고정project 사본 | 완료. 실제기록과 project handoff 연결 없음. 수신dry-run NOT_RUN. [관측39](2026-10-24-organizer-observation-39/RESULT.md) |
| Claude40 | session_014rmcC4wWchSKoq5jwVkZtF, 후속2/3; 최종44cfc9a, PR22 | 완료·수용. 기존37 세션과 분리, 후속PR 요청은 기존22 재사용 |
| Pro40 | Oracle af-source-review-40-20261024, exec3771 | completed·exit0. 공식2패턴·3반례 선택. 과거 연구 반복 없음 |
| 독립 Sol High40 | /root/proposal40_review, 248320d→44cfc9a | 완료. 초기 전체회귀와 최종문구 delta 재검사 구분, 대표2PNG·합친로그 공유 |

## 다음 범위와 운영

[정리v0 관측39](2026-10-24-organizer-observation-39/RESULT.md)를 근거로 **Q06의 출처 있는 연결 대기 제안 최소흐름**을 다음 제품 범위로 선택했다. Q02는 이름 후보·동일성 불명 상태를 보존하는 경계만 포함한다. 자동 동일성 병합·가짜 handoff/anchor·기존 return.2 확장은 선택하지 않았다. [40](2026-10-24-source-proposals-40/DECISION.md)에서 이 검토 흐름만 구현·수용했다. 실제 연결·자동 동일성·일반 추출기는 남아 있으며 수신 dry-run은 NOT_RUN이다. 질문 목록 전체를 일괄 개발하지 않는다. Q13 가독성은 단일장면 후속 실험 근거로 남긴다.

총괄만 agentflow-coordinator/Ops를 사용한다. Pro 비교, Claude 좁은 구현, 준비된 Cloud 또는 독립 로컬 실행, DeepSeek 출처 있는 좁은 분류, Sol High 보조를 쓴다. Cloud durable 호스트 접근 실패 때문에 이번 실행은 독립 로컬로 했다. GitHub 연결 재조회는 정상, 계정 전환/환경 재설치는 하지 않았다.

사용자 추가 결정: 공개 Pages 허용, DeepSeek 키 공개 금지, 로컬/저장소 정돈. 이전38에서 배포17파일과 인수 후 코드·증거71개 blob을 실제 키와 대조해 포함0건. runtime은 gh-pages, 결정·최소증거는 각 cycle 한곳에만 둔다. 큰 원로그/중복ZIP은 커밋하지 않으며 게시회수 후 38의 임시생성물 약49.5MiB를 정리했다. 강제 일괄 삭제가 자동 승인 검토에서 차단되어 약144MiB의 잔여물과 완료 통합 브랜치는 남겼다. 경로·정리 경계는 cycle38 DECISION에 기록했다. 기존 dirty checkout·원본 JSONL·키/워커 환경은 보존한다. 사람 사용 기록 제출을 진행 관문으로 만들지 않는다.

40의 후속 정리: GitHub 공유 회수 뒤 이번 전용 evidence/runtime 임시파일8,394,735bytes와 병합된 source-proposals-40 브랜치만 정리했다. 대표2PNG·합친로그는 cycle40 한곳에 유지한다. 이전38 잔여물은 그대로다.
