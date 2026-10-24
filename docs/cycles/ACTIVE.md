# AgentFlow 현재 상태

2026-10-24 KST. **경험41 수용·기존 공개 GitHub Pages 갱신 완료.** [PC 체험본](https://tlsee0813-cmd.github.io/agentflow-studio/) · [41 판단·독립검증·한계](2026-10-24-workspace-experience-41/DECISION.md) · [제품 기준](../PROJECT_STATUS.md) · [질문별 근거](../QUESTIONS.md).

## 현재 제품과 배포

- 수용 source `6840496f2d4a41d7e396f0febea3cc4cb1f90702`, app tree `5f42a2c6f5cbdb295cbb7ad7a71a1e36275b66f9`. [PR23 merged](https://github.com/tlsee0813-cmd/agentflow-studio/pull/23), [정확 양OS CI](2026-10-24-workspace-experience-41/CI.md). 증거 문서 후속 커밋과 제품 SHA는 구분한다.
- 공개 Pages 배포 `77a3c0bd18e536bcb99b342c5d5b20fd84ea32be`. runtime20개·HTTP19개 일치, [공개 화면·정리](2026-10-24-workspace-experience-41/RELEASE.md). 실제 AI 없는 브라우저 MOCK이며 preview 저장 접두사를 쓴다. 과거 private Sites35는35 그대로이고 최신 체험본이 아니다.
- 프로젝트 홈→비저장 예제 지도→부분 선택→실제 작업문 편집→반복 지도 복귀→예제 닫기→빈 내 프로젝트 시작을 연결했다. 지도 상단을 줄이고 작업문을 첫 화면으로 올렸다. 원문·근거는 펼쳐 읽는다.
- 1280/1440/125% 상당에서 초안·입력 선택·카메라·선택·접힘과 실제 페이지/지도 위치를 독립 검증했다. 긴 동일접두어60자 이름은1280/1440 15px,125% 상당14.53px와 구별 끝/전체 이름 접근을 확인했다. 125% 상당은 CSS viewport/DPR 구성이며 실제 브라우저 줌 조작은 아니다.
- 임의 규모 큰 지도·실제 줌·IME·다른 탭 live·실제AI 의미 품질·사람 사용성은 미검증이다. 과거34/26/28의 일반 반례와 GUIDE107 HOLD를 유지한다.

## 포함된 이전 범위

- [결합38](2026-10-24-entry-integration-38/DECISION.md):36fix2+37, source c7329aa, PR21 merged. 1280 복귀 안내 때문에 지도 높이가 줄던 반례·예제 비저장·초안 보존 확인.
- [관측39](2026-10-24-organizer-observation-39/RESULT.md): 실제 JSONL 한 표본과 고정 project 사본, DeepSeek 출처 분류와 독립 대조. 실제 project handoff 연결 근거 없음, 수신 dry-run NOT_RUN.
- [검토40](2026-10-24-source-proposals-40/DECISION.md): source44cfc9a, PR22 merged. 연결 대기 제안의 출처/원문 검토·제외/되돌림·근거 분리만 수용했다. 실제 project 적용이나 자동 동일성 병합은 없다. 이전 공개d2ecd381은 rollback 기준이다.

## 접수와 반환 — 중복 제출 금지

| 담당/주제 | 원본 접수·반환 | 상태 |
|---|---|---|
| Claude37 | session_01KJRKarPuyzvnMWCkvYQbW1, 후속2/4,0fa38e0 | 완료·38에 결합·수용 |
| 독립 Sol High36/38 | /root/verify36_prepare,beb559/c7329aa | 완료·cycle38 최소 증거 |
| Pro38 가독성 | Oracle af-map-readable-delta-20261024,exec71068 | completed·exit0·원문3출처 대조 |
| DeepSeek 정리v0 | session-a924bcea-2100-41b0-8112-474736972dd0,c7329aa·실제8사건 | completed·exit0·독립 보정 완료 |
| 독립 정리v0 | /root/organizer_inputs,같은 실제표본/고정project | 완료·관측39 |
| Claude40 | session_014rmcC4wWchSKoq5jwVkZtF,후속2/3,44cfc9a | 완료·수용·PR22 |
| Pro40 | Oracle af-source-review-40-20261024,exec3771 | completed·exit0·기존 연구 재사용 |
| 독립 Sol High40 | /root/proposal40_review,248320d→44cfc9a | 완료·전체회귀/최종문구delta 구분 |
| Claude41 | session_01UkFFD6VJkUvYpFHh8Zorw8,같은 문제 후속13회,6840496 | 완료·수용·PR23 |
| Pro41 | Oracle af-workspace-experience-41-20261024,exec55225 | completed·exit0·Dify/VSCode 공식 대안·반례, 화면 실행 아님 |
| 독립 Sol High41 실행 | /root/experience41_audit,b74 실행→684 테스트만 차이 | 완료·3크기 대표/보존·wheel/center/zero·수신 경계 |
| 독립 Sol High41 정적 | /root/experience41_source_review,exact684 | 완료·계약/검사 변경 검토, 실행과 구분 |

## 다음 범위와 운영

Q04/Q13의 PC 선택·편집·복귀와 대표 가독성은41에서 수용했다. Q02/Q06은39에서 선택한40의 좁은 검토 흐름을 유지한다. 실제 연결·자동 동일성·일반 추출기는 남아 있으며 질문 전체를 일괄 개발하지 않는다. 완료한 연구를 처음부터 반복하지 않는다.

총괄만 agentflow-coordinator/Ops를 쓴다. Pro 비교, Claude 좁은 구현, 준비된 Cloud 또는 작성자와 분리한 로컬 실행, DeepSeek 출처 있는 좁은 분류, Sol6.1 High 보조를 사용한다. Cloud durable 호스트 접근 실패 때문에 이번 실행은 독립 로컬로 했다. GitHub 연결은 정상이며409 HEAD 변경 응답을 인증 실패로 오해하지 않는다. 환경 재설치·계정 전환은 하지 않았다.

공개 Pages 허용·DeepSeek 키 공개 금지·로컬/저장소 정돈이 사용자 결정이다. runtime은 gh-pages, 결정/최소 증거는 각 cycle 한곳에 둔다. 큰 원로그/중복 ZIP은 공유하지 않는다. 38에서 자동 승인 검토가 차단한 강제 일괄 삭제는 재시도하지 않았고 약144MiB의 과거 잔여물은 보존했다.40의 전용 임시8,394,735bytes와 병합 브랜치는 정리 완료.41의 정리는 [RELEASE](2026-10-24-workspace-experience-41/RELEASE.md)에 기록한다. 기존 dirty checkout·원본 JSONL·키/워커 환경은 보존한다. 사람 사용 기록 제출을 관문으로 만들지 않는다.
