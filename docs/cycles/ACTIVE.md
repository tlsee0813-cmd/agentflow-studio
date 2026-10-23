# AgentFlow 현재 상태

2026-10-23 KST · 단일 총괄: 현재 Codex 대화. 사용자의 연속 진행 지시에 따라 진행한다. **현재 배정은 이 파일**, 과거 판정은 각 RESULT, 제품/배포 기준은 [PROJECT_STATUS](../PROJECT_STATUS.md)를 따른다.

## 지금 진행하는 일

**35 — 최신 PC 흐름의 독립 체험본 게시 완료.** [결과·공유 근거·한계](2026-10-23-isolated-preview-35/RESULT.md) · [PR19](https://github.com/tlsee0813-cmd/agentflow-studio/pull/19) · [PC 체험본](https://agentflow-studio-pc-preview-20261023.eagerllama11.chatgpt.site). Claude 별도 세션의 최종81f8a32를 양OS CI·독립 Cloud 양PC·Sol 코드/원자료 검토·총괄 대표 화면으로 대조하고 a6ea322에 병합했다. app 전체가 후보와 동일하고 직전 문서를 보존했다. 검증된 정적17개 파일의 길이/SHA256을 대조해 owner-private Sites에 게시했다. 실제 로그인·목록·예제 열기/닫기를 확인했다. main/기존 공개 gh-pages는 그대로다. MOCK·브라우저 저장이며 기존 공개 데이터 자동 이동은 없다. 로그인 이후 전체 흐름 재실행은 하지 않았다.

**36 — 기본 지도와 상세의 정보 우선순위 수정본 독립 검증 중.** [범위](2026-10-23-map-priority-36/INPUT.md) · [PR20](https://github.com/tlsee0813-cmd/agentflow-studio/pull/20). [Claude Code 지도 세션](https://claude.ai/code/session_01HYWug65yLyrGuGvjjLkAa5)의 원후보c0a7에서 Sol/Astra와 총괄이 보고만 있는 부분의 기록 입구 누락을 찾았다. Claude는 정상domain/API 표본으로 원후보실패→fix1통과를 확인했고 보고 존재 조건만 좁게 보완했다. 최종 제품fix9aeeefb0+AUTHOR 정정c04c9d에 수용35를 합친 실제 PR head는 a17cbcf9804154b878ccf20dfa4d5155777ce7ca다. 기본에 이름·소속·짧은 목적과 네 읽을 이유를 두고 정확 수량/원문은 소유 상세에서 읽는다. 갱신은 적용 설명 revision 변경이며 held-only 도착 전체가 아니다.

35와 결합한 PR 합성merge65cd96d9(app66d79f03)를 Cloud가 고정 실행한다. 실제head a17의 app 전체가 이 실행본과 같고 문서만 다르다. [1280 원반례](https://github.com/tlsee0813-cmd/agentflow-studio/tree/5f9da8d47f76084b3e7a3e14a9e7ad82841a6aae/docs/transfer/map-priority-36/reports-only-original/v0)는 정상 API/실제 수신 파일로 재현·공유했고 Astra가 원자료를 대조했다. 수정본은 동일 표본 비교·양PC 실제 수량 읽기/정확 소유 기록 왕복·34실패장면을 확인 중이다. 원c04 CI는 base35의 preview 빌드 단계와 구head 코드가 어긋나 양OS 실패했다. [원실패 보존](https://github.com/tlsee0813-cmd/agentflow-studio/tree/5ae31172aedc6fb8b68748257b6bf9c2da733cb8/docs/transfer/map-priority-36/ci-c04c9d). Ubuntu 브라우저군은 미실행, Windows 실패 로그는 head변경409로 미회수다. 이를 제품 화면 결함으로 세지 않는다. 총괄이35 기준을 실제head에 합쳤으나 a17 새run39884071150의 Ubuntu에서 MAP36 test01/02/03 양PC6개가 P 카드의 구상 미기재/구상 줄 inside=false로 실패했다. 설치 기록은 Playwright1.57/Chromium143이며 실제 실행 버전/rect 숫자는 tail에서 회수하지 못했다. Windows/전체 원문은 Sol이 Code Review로 회수 중이다. **36 병합·체험 반영 보류**, Claude36에 정확 환경 재현·실제 rect/computed 수집·좁은 수정만 재배정했다. 검사 단언 완화/통과 환경으로 대체하지 않는다. 독립Cloud154의 [수정본 근거](https://github.com/tlsee0813-cmd/agentflow-studio/tree/15dbd3103c5d65f57408065d3213419acfd67b88/docs/transfer/map-priority-36/validated-merge65cd/v0)는 동일원반례 gate1→0/양PC 기록 왕복/작성자36·31·18·static 통과다. Astra의 원자료 감사와 총괄1280경계PNG 대조도 했으나 이 다른 환경 성공으로 정확CI실패를 소거하지 않는다. 작은 기본배율 글씨와 같은접두어 부모소속 구별의 한계는 남으며 표시상자 통과와 가독성을 구분한다. 새 줌/배치 엔진으로 넓히지 않는다.

**34 — 후보 보류로 종료.** [결과·공유 반례](2026-10-23-map-signals-34/RESULT.md). e059ec6d는 기록 입구를 추가했지만 겹친 상태의 부모 카드에서 기존 수 줄이 가려졌다. Cloud1280 실제 반례와 소스 대조로 보류했다. 기준에도 다른 표지가 가렸다는 사실로 새 누락을 받아들이지 않았다.36은 모든 수량을 기본180px 카드에 넣으라는 요구를 명시적으로 바꾼 후속이며34를 몰래 통합하지 않는다.

## 다음 사용자 경험 관문

36의 표시 후보는 독립 검증 뒤 판단한다. 다음 관측은 신호 개수/검사 수가 아니라 **프로젝트 재진입 → 무엇을 이어갈지 판단 → 필요한 한 부분만 읽고 편집·인계 → 돌아온 결과와 미결 확인 → 전체로 복귀**가 한 경험으로 작동하는지에 둔다. 실제 목적이 있는 짧은 사례로 목적만 제시하고, 기록을 찾는 순서를 정답처럼 미리 알려주지 않는다. 현재 작업과 별도 초안, 현재 설명과 원보고, 변경과 미결을 구별해야 한다. Dify와는 목적 차이를 유지하며 다음 행동의 명확성과 행동거리를 비교한다. 세부 관측 범위는36 결과 후 정한다. 별도 [새 Pro 세션](https://chatgpt.com/c/6adab66c-4428-83ee-aac8-dec9d0914941)의5.6 Pro 응답을 회수했고 총괄이 Dify/Linear 공식 문서와 대조했다. Pro의 현재작업/초안 선택 근거 분산은 관측 가설로 보존하며, 후속 작업문 없는 보고를 미답 질문과 묶는 표현은 반려했다.

**37 — 첫 방문/공간 예제 연결 후보의 설계 배정.** 총괄의 실제 배포본 첫 방문은 프로젝트 홈 대신 빈 작업 폼이며 예제에는 공간이 없었다. Sol/Astra의 코드 대조와 일치한다. 기존 홈을 첫 입구로 하고 비저장 공간 예제→부분/작업→지도로 이어지는 좁은 범위를 별도 Claude Code 주제에 배정한다. [37 INPUT·원문·총괄 판단](https://github.com/tlsee0813-cmd/agentflow-studio/tree/80d9d11f9aca473d2e45de8b96ab3dbebbe9299b/docs/cycles/2026-10-23-project-entry-37), 전용product/project-entry-37. [새 Claude37 세션](https://claude.ai/code/session_01KJRKarPuyzvnMWCkvYQbW1) Opus5.5 높음이 정확80d9 head를 읽고 설계를 회신했다. 총괄이 기존정상fresh 홈/비저장공간예제/메모리fallback/실제지도기억 보존을 수용해37 전용branch 구현을 배정했다. 유효session·legacy·저장오류와 WebLocks없는 기존메모리 작업입구를 지킨다.36 카드 수정과 다른 파일구간을 맡기고 최종 통합·CI 전36fix를 합친다.37 구현/수용은 아직이며36 수용을 전제하지 않고 main/공개 배포를 바꾸지 않는다. 새 대규모 조사/엔진을 자동 시작하지 않는다.

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
