# AgentFlow 현재 상태

2026-10-24 KST. **새 총괄 인수인계 준비 완료 상태. 제품 개발의 다음 실행은 새 총괄에서 이어간다.** 현재 진행은 이 파일, 인계 시점의 정확한 기준·워커 회수·판단은 [새 총괄 시작 문서](../COORDINATOR_HANDOFF_2026-10-24_KO.md), 질문 축적은 [QUESTIONS](../QUESTIONS.md), 제품·배포 기준은 [PROJECT_STATUS](../PROJECT_STATUS.md)에 둔다. 과거 RESULT/AUTHOR는 당시 판단이며 이 파일을 대신하지 않는다.

## 수용된 제품과 반환 후보

- **35 수용·비공개 PC 체험본 게시 완료.** [결과](2026-10-23-isolated-preview-35/RESULT.md) · [체험본](https://agentflow-studio-pc-preview-20261023.eagerllama11.chatgpt.site). checkpoint의 app tree는 `775a33991c4b81104737ac1f0ec5b924c979a975`이며 MOCK·브라우저 저장이다. 36/37은 아직 여기에 없다.
- **36 fix2 반환·양OS CI 통과·미병합.** `product/map-priority-36` head `38beb55922e3e982f0f32fddacd5e18a5e157a15`, [PR20](https://github.com/tlsee0813-cmd/agentflow-studio/pull/20) draft. 이유 줄의 항목별 줄바꿈 금지를 제거해 구상 잘림을 수정했다. 정확 head의 run39886454270 Ubuntu/Windows success를 Code Review로 확인했다. a17의 Ubuntu6실패는 과거 실패다. 기존 Cloud154 검증은 pre-fix2이고143 재현 시도는 다운로드/캐시 제한으로 NOT_RUN 반환이다. 최신 fix2의 최종 화면 판단·수용은 남았다.
- **37 구현 반환·독립 결합 검증 전.** `product/project-entry-37` head `20bffe5fe33f11b29870a9025d2ac0089837abfb`. 첫 홈/비저장 공간 예제/부분·작업 왕복 후보. 36 fix2 미포함. 작성자 보고의 지도 복귀 안내가1280 가용 높이를 줄이는 장면을 먼저 확인·수정한다. author 통과를 최종 수용으로 읽지 않는다.
- **34 후보 보류 종료.** [반례](2026-10-23-map-signals-34/RESULT.md). 26/28과 함께 가독성 판단 근거로 보존한다. GUIDE107 실제 AI 의미 품질 HOLD도 유지한다.

## 다음 작은 완결 흐름

기존 반환을 먼저 회수 → 36 fix2 코드/화면 판정 → 최신 문서 보존해 수용 여부 결정 → 37에36fix2 포함·복귀 반례 수정 → 독립 PC1280/1440에서 **홈→예제 지도→부분/작업→이어가기→지도 복귀→예제 닫기→내 프로젝트 시작** → 최종 결합 SHA 양OS CI → 수용본만 기존 비공개 체험본 반영. 좌표 보존뿐 아니라 실제 표시·가용 높이·초안·예제 비저장을 확인한다. main/기존 공개판 승격은 별개다.

그 뒤 정리 담당v0: 허용된 실제 JSONL 한 표본+project 사본의 세 후보 관측. 기존 handoff/anchor 없음을 가짜 ID로 메우지 않고 거절/영역 미배치/설명 보류/적용 가능성을 분리한다. 자동 수집/UI/범용 엔진 없이 Q02/06 다음 범위를 판단한다. 지도 기본fit 제약 비교·증거 축소·CI 계층화는 [인계의 수용 판단](../COORDINATOR_HANDOFF_2026-10-24_KO.md) 범위 안에서 순서를 정한다.

## 운영

기존 Claude36/37은 반환됐고 제품 Cloud 최근 턴도 completed·idle이다. Pro36/37 답변도 이미 회수했다. 구체 URL/ID·입력 SHA·결과·다음 동작은 [인계 4절](../COORDINATOR_HANDOFF_2026-10-24_KO.md)에 모았다. 새 배정부터 이 파일에 채널/주제/기준/접수/반환/다음 회수를 기록하고 완료된 작업을 다시 전송하지 않는다.

총괄만 `$agentflow-coordinator`와 기존 Ops 하네스를 적용한다. Pro 비교 조사, Claude 구현, 준비된 Cloud/독립 담당 실행, DeepSeek 좁은 텍스트 분류, Sol High 보조·Astra High 어려운 판단으로 나눈다. 주제가 바뀌거나 대화가 길어져 혼선이 생기면 새 주제 세션으로 인계하고 같은 문제의 짧은 후속은 기존 세션에서 한다. 계정 전환은 사용자의 최신 지시대로 이 제품 작업에서 다루지 않는다.

PC 중심·Dify 메커니즘 비교를 유지한다. 사람 사용 기록 제출을 새 관문으로 요구하지 않는다. 질문은 연구 지도이며 일괄 개발 목록이 아니다. 원문 보존·작성자 검사·독립 실제 실행·이미지 검토·AI 관측·미실행을 구분한다. 저배율 가독성·큰 지도·브라우저125%·실제 IME·다른 탭 live·일반 기록 정리는 미해결/미검증이다. 이번 인계는 문서만 바꾸며 제품 소스·main·기존 공개 gh-pages·배포를 바꾸지 않는다.
