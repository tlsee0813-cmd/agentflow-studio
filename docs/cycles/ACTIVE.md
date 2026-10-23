# AgentFlow 현재 상태

2026-10-23 KST · 단일 총괄: 현재 Codex 대화. 사용자의 연속 진행 지시에 따라 진행한다. **현재 배정은 이 파일**, 과거 판정은 각 RESULT, 제품/배포 기준은 [PROJECT_STATUS](../PROJECT_STATUS.md)를 따른다.

## 지금 진행하는 일

**35 — 최신 PC 흐름의 독립 체험본 게시 완료.** [결과·공유 근거·한계](2026-10-23-isolated-preview-35/RESULT.md) · [PR19](https://github.com/tlsee0813-cmd/agentflow-studio/pull/19) · [PC 체험본](https://agentflow-studio-pc-preview-20261023.eagerllama11.chatgpt.site). Claude 별도 세션의 최종81f8a32를 양OS CI·독립 Cloud 양PC·Sol 코드/원자료 검토·총괄 대표 화면으로 대조하고 a6ea322에 병합했다. app 전체가 후보와 동일하고 직전 문서를 보존했다. 검증된 정적17개 파일의 길이/SHA256을 대조해 owner-private Sites에 게시했다. 실제 로그인·목록·예제 열기/닫기를 확인했다. main/기존 공개 gh-pages는 그대로다. MOCK·브라우저 저장이며 기존 공개 데이터 자동 이동은 없다. 로그인 이후 전체 흐름 재실행은 하지 않았다.

**36 — 기본 지도와 상세의 정보 우선순위 수정본 독립 검증 중.** [범위](2026-10-23-map-priority-36/INPUT.md) · [PR20](https://github.com/tlsee0813-cmd/agentflow-studio/pull/20). [Claude Code 지도 세션](https://claude.ai/code/session_01HYWug65yLyrGuGvjjLkAa5)의 원후보c0a7에서 Sol/Astra와 총괄이 보고만 있는 부분의 기록 입구 누락을 찾았다. Claude는 정상domain/API 표본으로 원후보실패→fix1통과를 확인했고 보고 존재 조건만 좁게 보완했다. 최종c04c9d는 제품fix9aeeefb0+AUTHOR의 갱신 의미 정정이다. 기본에 이름·소속·짧은 목적과 네 읽을 이유를 두고 정확 수량/원문은 소유 상세에서 읽는다. 갱신은 적용 설명 revision 변경이며 held-only 도착 전체가 아니다.

35와 결합한 PR 합성merge65cd96d9(app66d79f03)를 Cloud가 고정 실행한다. 1280 원반례를 먼저 보존한 후 동일 표본 수정비교·양PC 실제 수량 읽기/정확 소유 기록 왕복·34실패장면을 확인한다. Sol은 정확head c04의 양OS CI를 Code Review로만 확인한다. 수용/제품체험 반영은 아직이다. 작은 기본배율 글씨와 같은접두어 부모소속 구별의 한계는 남으며 표시상자 통과와 가독성을 구분한다. 새 줌/배치 엔진으로 넓히지 않는다.

**34 — 후보 보류로 종료.** [결과·공유 반례](2026-10-23-map-signals-34/RESULT.md). e059ec6d는 기록 입구를 추가했지만 겹친 상태의 부모 카드에서 기존 수 줄이 가려졌다. Cloud1280 실제 반례와 소스 대조로 보류했다. 기준에도 다른 표지가 가렸다는 사실로 새 누락을 받아들이지 않았다.36은 모든 수량을 기본180px 카드에 넣으라는 요구를 명시적으로 바꾼 후속이며34를 몰래 통합하지 않는다.

## 다음 사용자 경험 관문

36의 표시 후보는 독립 검증 뒤 판단한다. 다음 관측은 신호 개수/검사 수가 아니라 **프로젝트 재진입 → 무엇을 이어갈지 판단 → 필요한 한 부분만 읽고 편집·인계 → 돌아온 결과와 미결 확인 → 전체로 복귀**가 한 경험으로 작동하는지에 둔다. 실제 목적이 있는 짧은 사례로 목적만 제시하고, 기록을 찾는 순서를 정답처럼 미리 알려주지 않는다. 현재 작업과 별도 초안, 현재 설명과 원보고, 변경과 미결을 구별해야 한다. Dify와는 목적 차이를 유지하며 다음 행동의 명확성과 행동거리를 비교한다. 세부 관측 범위는36 결과 후 정한다. 별도 [새 Pro 세션](https://chatgpt.com/c/6adab66c-4428-83ee-aac8-dec9d0914941)에 목적 입력부터 재진입까지의 PC 입구/전체 흐름과 최신 공식 Dify·관련 기제를 좁게 비교하도록 배정했다. 지도 세션에 다른 주제를 섞지 않았으며5.6 Pro 실제 응답 중이다. 새 대규모 조사/엔진을 자동 시작하지 않는다.

## 최근 제품 기준

- **35 체험 배포**: 제품의 별도 출력·저장 접두사. 새 원격 UI나 AI 엔진을 만들지 않는다. [결과](2026-10-23-isolated-preview-35/RESULT.md).
- **33 작업 대상·행동 연결**: 읽는 작업에서 명시 이어가기/편집/파일 검토로 연결하고 늦은 파일 안내의 초점 탈취를 막는다. [결과](2026-10-23-task-context-33/RESULT.md). 긴 T2 1280의 별개 초안 첫 화면 노출 한계는 남는다.
- **31 접힌 부분 기록 /30 지도 복귀 /29 설명 참고**: 정확 소유 기록과 호출 복귀, 복귀 높이 계산, 명시 재열기와 새 수신의 읽기 위치를 구분한다. [31](2026-10-23-branch-records-31/RESULT.md) · [30](2026-10-23-viewport-return-30/RESULT.md) · [29](2026-10-23-work-reference-29/RESULT.md).
- 앞선 제품 통합과 공개USE106 구분은 [PROJECT_STATUS](../PROJECT_STATUS.md)에 둔다. [32 재진입 관측](2026-10-23-reentry-judgment-32/RESULT.md), [28 지도 후보 보류](2026-10-23-map-reading-28/RESULT.md), [26 배치 후보 보류](2026-10-23-child-placement-26/RESULT.md), [24 지도 읽기 관측](2026-10-23-map-reading-24/RESULT.md)는 과거 판단이며 현재 작업 목록이 아니다.

## 역할과 경계

Pro는 비교 조사와 기본/상세 정보 선택, Claude Code Opus는 주제별 구현과 작성자 검사,6.1 Sol High/Astra High는 보조 코드·원자료 검토와 독립 판단, Cloud는 실제 화면 검증을 맡는다. 총괄이 원문·화면과 대조하고 수용/보류·제품 통합을 결정한다. Claude의 예전 크레딧 한계는 재확인했고 현재 실제 사용 중이다. [지도 Claude](https://claude.ai/code/session_01HYWug65yLyrGuGvjjLkAa5) · [체험 배포 Claude](https://claude.ai/code/session_01NdSfw1rJtV9gxs8A1MEmPe) · [지도 Pro](https://chatgpt.com/c/6ada853c-ff1c-83ee-8258-965005014026). 서로 다른 주제를 한 세션에 계속 섞지 않는다.

GitHub checkpoint는 결정/제품 통합, delivery/ui02-fix3-evidence 새 접두사는 실행/화면 근거다. 로컬은 작고 필요한 포장/검증 중간물에 한정한다. 로컬 서버 실행은 앞선 자동 승인 검토에서 차단되어 재시도하지 않았고 Cloud에서 실제 실행한다. Sites 공식 정적 포장/게시와 로컬 서버 실행을 구분한다. 예약agentflow는 PAUSED 그대로다.

PC 중심이다. 사람 사용 기록 제출을 새 관문으로 요구하지 않으며 사용자의 Dify 비교 기준을 따른다. 비교·AI 역할 관측을 사람 대상 연구라고 부르지 않는다. 방향 문서 질문은 연구지도이며 일괄 개발 목록이 아니다. [질문별 탐색 고정본](https://github.com/tlsee0813-cmd/agentflow-studio/blob/9df67057595ff85322c238de55ffe2f5d820d950/docs/cycles/ACTIVE.md#질문과-근거-연결).

읽기·저장·원문 보존은 실제 실행/완료/AI 의미 품질 증거가 아니다. 작은 지도 글자·긴 소속 구별·첫 화면의 행동 노출·큰 지도/125%/실제 OS IME·다른 탭 live·기본MOCK 한도와429 회복은 미해결 또는 미검증이다.35의1280 안내 소멸 뒤 pageY 변화와 양PC 순서 차이를 정확 좌표/동일경로 성공으로 확대하지 않는다. GUIDE107 실제 AI HOLD는 유지한다. main896dcf3848fec70357d0f9bd4fd6c09cab70db37·기존 공개gh-pages63f5540d062861439f0932cd7311c6c5510e227c 유지.
