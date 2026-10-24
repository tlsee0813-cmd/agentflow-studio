# AgentFlow 현재 상태

2026-10-24 KST. **시각 재설계42 수용·기존 공개 GitHub Pages 갱신 완료.** [PC 체험본](https://tlsee0813-cmd.github.io/agentflow-studio/) · [판단·최소 증거·한계](2026-10-24-visual-design-42/DECISION.md) · [제품 기준](../PROJECT_STATUS.md) · [질문별 근거](../QUESTIONS.md).

## 현재 제품과 배포

- source `caf6126a4a2e592dc4f17626f0440d13a1d4c188`, app tree `9ba47af6a58cf97d717e743a862553ea2cf1053d`. [PR24](https://github.com/tlsee0813-cmd/agentflow-studio/pull/24)와 정확 양OS CI 성공을 확인했다. 후속 증거 문서 커밋과 제품 SHA는 구분한다.
- Pages `78356d033e455f2a255a5d03c9790495eb9c7d66`. [배포 파일/키 검사](2026-10-24-visual-design-42/DEPLOYMENT.json)와 [공개 HTTP19개 동일성](2026-10-24-visual-design-42/HTTP_VERIFICATION.json)을 확인했다. 실제 AI 없는 브라우저 MOCK·preview 저장 접두사다. 과거 private Sites35는 최신 체험본이 아니다.
- 홈의 시작 두 행, 연속 지도와 붙은 선택 패널, 문서형 작업 편집을 같은 글자·간격·표면·아이콘으로 구성했다. 초안·caret·예제 비저장·페이지/지도/카메라 복귀를 보존한다.
- 중간 후보의 헤더/팝오버, 참고 편집 높이, 관리 메뉴, 기록 많은 카드 소속 잘림과 반복 pan 취소를 재현·수정했다. 작성자·독립 실행·총괄 시각 판단·미실행을42 기록에서 구분한다.
- 임의 큰 지도·실제 브라우저 줌/IME·사람 사용성·실제AI 의미 품질은 미검증이다. 펼친 원문의 출처 메타 밀도는 남는다. 과거 반례와 GUIDE107 HOLD를 유지한다.

## 포함된 이전 범위

- [경험41](2026-10-24-workspace-experience-41/DECISION.md): 기능 흐름의 수용 기록이다. 사용자가 기본 시각 품질을 반려해42에서 시각 체계를 다시 구성했다.

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
| Pro42 | Oracle af-visual-design-42-20261024,exec16422 | 완료·공식 비교/반례·총괄 선택 |
| DeepSeek42 | session-c9e4b2eb-3c26-4855-8908-e8514492ea2d | 완료·Dify 고정 소스12행 추출·원문 대조 |
| Claude42 | session_013cKbrEwsEY47DiQW4LRQce,후속11까지 | caf6126 반환·유일 구현 작성자 |
| Cloud42 | local/01a168ed-bd09-7102-a483-781946e370b6,요청5~11 | 완료·제공 ZIP 독립 실행·최종 범위는42 판단 기록 |
| 독립 Sol High42 | /root/visual42_structure,/root/visual42_verify | 완료·정적/Windows 실행 분리·최종 최소 증거 |

## 다음 범위와 운영

Q04/Q13의 PC 흐름은41에 이어42의 시각 체계·반복 pan·소속 가독성까지 좁게 수용했다. Q02/Q06은39에서 선택한40의 좁은 검토 흐름을 유지한다. 실제 연결·자동 동일성·일반 추출기는 남아 있으며 질문 전체를 일괄 개발하지 않는다. 완료한 연구를 처음부터 반복하지 않는다.

총괄만 agentflow-coordinator/Ops를 쓴다. Pro 비교, Claude 좁은 구현, 준비된 Cloud 또는 작성자와 분리한 로컬 실행, DeepSeek 출처 있는 좁은 분류, Sol6.1 High 보조를 사용한다. Cloud는 해시 고정 공개 runtime ZIP을 정상 첨부해 독립 실행했다. Git 직접 조회/소스 재빌드는 프록시 오류로 하지 못했고, 웹 UI 이미지 출력 실패와 별도 Windows 원본 직접 검토를 구분한다. GitHub 연결은 정상이며409 HEAD 변경 응답을 인증 실패로 오해하지 않는다. 환경 재설치·계정 전환은 하지 않았다.

공개 Pages 허용·DeepSeek 키 공개 금지·로컬/저장소 정돈이 사용자 결정이다. runtime은 gh-pages, 결정/최소 증거는 각 cycle 한곳에 둔다. 큰 원로그/중복 ZIP은 공유하지 않는다. 38에서 자동 승인 검토가 차단한 강제 일괄 삭제는 재시도하지 않았고 약144MiB의 과거 잔여물은 보존했다.40의 전용 임시8,394,735bytes와 병합 브랜치는 정리 완료.41의 정리는 [RELEASE](2026-10-24-workspace-experience-41/RELEASE.md)에 기록한다. 기존 dirty checkout·원본 JSONL·키/워커 환경은 보존한다. 사람 사용 기록 제출을 관문으로 만들지 않는다.

42의 임시299파일·23,700,547bytes와 병합 브랜치도 [정리 완료](2026-10-24-visual-design-42/CLEANUP.json). 공개 탭은 최종 자산으로 갱신했다.
