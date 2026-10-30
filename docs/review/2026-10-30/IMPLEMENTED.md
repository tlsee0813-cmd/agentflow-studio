# 만들어진 기능과 남은 문제

2026-10-30 KST, 개발계열 기준 `1e85b729d5e02c235ca47d457b47af2d07d36a07` / app tree `93be1c55734f95e0040cd333e0d8bba3d3adb12b`. 이번 정리는 기존 코드와 수용/반려 기록을 대조했으며 새로운 생성·실험·코드 수리를 하지 않았다. [상세 사실 감사](evidence/product-facts.json).

## 사용자 흐름별 현황

| 단계 | 구현돼 있는 것 | 실제 확인 범위·한계 | 근거 |
| --- | --- | --- | --- |
| 자료 넣기 | 원문 붙여넣기와 코드·검사 파일 입력, 자료 종류·출처·정확 원문 보존 | 114 입력/보존 수용. 자동 연결기는 없음 | [결과](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/docs/cycles/2026-10-30-source-entry-114/ROOT_ACCEPTANCE.md) |
| 첫 지도 만들기 | 원문 범위·출처를 묶어 첫 지도 후보를 만들고 명시적으로 반영 | 129 실제 작업 지시·139 micro 사례 한정 수용. 일반 정확도 보장 아님 | [결과](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/docs/cycles/2026-10-30-normal-micro-139/RESULT.md) |
| 부분과 근거 읽기 | 지도 부분·관계·현재/이력·원문 왕복, 전체 읽기, 철회 대상 표시 | 140 읽기 한정 수용·142 제한 공개 전달 | [결과](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/docs/cycles/2026-10-30-part-reading-140/ROOT_ACCEPTANCE.md) |
| 변경안 분석 | 요구와 실제 자료로 변경 항목·유지 조건·확인 사항 제시, 낡은 응답 보호 | 141 plan은 실제1회 한정PASS. 이후 scope는 반려 | [결과](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/docs/cycles/2026-10-30-question-draft-request-141/RESULT.md) |
| 선택 범위와 고정 요청문 | 선택한 항목의 전제 검토, 원요구·조건·제외·근거를 고정 RQ로 저장/읽기/내보내기 | 134/109 특정 사례 수용.141은 형태가 유효해도 의미 반려 | [결과](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/docs/cycles/2026-10-30-scope-time-observation-134/RESULT.md) |
| 돌아온 결과 읽기 | 고정 요청과 보고·코드·검사 근거를 연결, 보고/구현 근거/확인 구별·철회/수동 대응 보존 | 121 실제 한정 수용에는 다른 프로젝트 대기 관문 미실행.136은 계약 반려 | [결과](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/docs/cycles/2026-10-30-reference-return-121/RESULT.md) |
| 저장과 복구 | 브라우저 workspace/계획·RQ, 프로젝트 백업, 로컬 Node 작업 보관·명시 반영 | 100 저장/복구·128 PC 실행 수용. 응답 재생 검사와 새 생성 품질을 구분 | [결과](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/docs/cycles/2026-10-29-durable-map-100/ROOT_ACCEPTANCE.md) |

## 판본에 따라 가능한 것

| 범위 | 공개73 | 제한 공개142 | 로컬 전체 개발계열140 |
| --- | --- | --- | --- |
| 예제·기존 지도와 부분 읽기 | 기존 UI | 넓은 전체 읽기·새 근거/반환 읽기 포함 | 포함 |
| 수동 자료/파일 입력 | 당시 지원 범위 | project14 자료 입구 포함 | 포함 |
| 원자료 FIRST·새 기록 RETURN 생성 | 당시 서버 경로·한계. 최신 품질과 동일시 금지 | map/jobs 명시 보류 | 선택형 CLI/기존 생성 경로 구현. 사례별 성공·실패 병존 |
| plan/scope/질문 정리 | 접속 코드가 필요한 기존 경로 | 보호된 서버 경로, 사용 설정/코드 필요 | DeepSeek 설정이 필요. CLI 연결만으로 plan이 작동하지 않음 |
| 자동 기록 수집·계정 간 동기화 | 없음 | 없음 | 없음 |

공개142는135 기반에140 client/CSS와 부분 읽기 제한 제거만 조합했다.137 거절 진단은 로컬 개발계열에 있지만 공개142에는 포함하지 않았다. 상세 배포/주소는 [웹사이트 안내](WEBSITES.md)를 본다.

## 검토할 코드의 진입점

### 자료 입력 / source input

[return-view.ts 197](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/src/client/return-view.ts#L197) · [return-view.ts 239-274](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/src/client/return-view.ts#L239) · [domain.ts 573-584](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/src/shared/domain.ts#L573) · [types.ts 183-187](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/src/shared/types.ts#L183) · [record-source.ts](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/src/shared/record-source.ts)

### FIRST / 기록으로 지도 정리

[map-reading.ts 657-773](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/src/shared/map-reading.ts#L657) · [map-reading.ts 231](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/src/shared/map-reading.ts#L231) · [map-reading.ts 782-906](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/src/shared/map-reading.ts#L782) · [map-run.ts 110-200](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/src/client/map-run.ts#L110) · [map-run.ts 224-301](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/src/client/map-run.ts#L224)

### 부분 읽기 / structure, claims, history, source and navigation

[app.ts 1396](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/src/client/app.ts#L1396) · [app.ts 1519](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/src/client/app.ts#L1519) · [map-reading.ts 547](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/src/shared/map-reading.ts#L547) · [request-results.ts 19](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/src/client/request-results.ts#L19) · [request-results.ts 75](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/src/client/request-results.ts#L75) · [request-results.ts 238-260](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/src/client/request-results.ts#L238) · [request-results.ts 472](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/src/client/request-results.ts#L472)

### 변경 구상 / PLAN

[plan-source.ts 88](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/src/client/plan-source.ts#L88) · [plan-view.ts 464-495](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/src/client/plan-view.ts#L464) · [plan-request.ts 24](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/src/client/plan-request.ts#L24) · [change-plan.ts 149](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/src/shared/change-plan.ts#L149) · [plan-store.ts 145-160](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/src/client/plan-store.ts#L145)

### 선택 scope -> 고정 RQ / request document

[plan-source.ts 164](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/src/client/plan-source.ts#L164) · [plan-view.ts 514-558](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/src/client/plan-view.ts#L514) · [plan-request.ts 26](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/src/client/plan-request.ts#L26) · [change-plan.ts 170-187](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/src/shared/change-plan.ts#L170) · [plan-store.ts 180-184](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/src/client/plan-store.ts#L180)

### 결과 반환 / supplied reports+code+tests compared with exact frozen request

[map-reading.ts 669-773](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/src/shared/map-reading.ts#L669) · [map-reading.ts 231](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/src/shared/map-reading.ts#L231) · [map-reading.ts 782](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/src/shared/map-reading.ts#L782) · [request-return.ts](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/src/shared/request-return.ts) · [request-results.ts 69-75](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/src/client/request-results.ts#L69) · [return-view.ts 670-691](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/src/client/return-view.ts#L670) · [studio.mjs 200-208](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/server/studio.mjs#L200)

### 저장 / export, import, reload, job recovery

[storage.ts 9-13](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/src/shared/storage.ts#L9) · [storage.ts 132-155](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/src/shared/storage.ts#L132) · [storage.ts 252](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/src/shared/storage.ts#L252) · [plan-store.ts 8-17](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/src/client/plan-store.ts#L8) · [plan-store.ts 179-184](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/src/client/plan-store.ts#L179) · [map-jobs.ts 15-37](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/src/client/map-jobs.ts#L15) · [map-jobs.mjs 1-10](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/server/map-jobs.mjs#L1) · [map-run.ts 284-325](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/src/client/map-run.ts#L284)

서버의 plan/scope와 지도 CLI는 별도 경로다. [studio.mjs](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/server/studio.mjs) · [map-jobs.mjs](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/server/map-jobs.mjs) · [제한 공개 Worker](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/app/continuity/server/worker-existing-map.mjs). 코드가 있다는 사실과 해당 경로가 공개판에서 열려 있다는 사실은 다르다.

## 미해결과 반려를 그대로 남긴 항목

- **136 RETURN:** 실제 응답이 일반 CONTRACT 거절을 받았다. 정확한 위반 필드와 의미 판정은 미확인이다. 원 최종 텍스트가 남지 않아 원인을 복원할 수 없으며137 진단 개선이136을 통과시킨 것은 아니다. [136 결과](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/docs/cycles/2026-10-30-actual-return-136/RESULT.md).
- **141 scope/RQ:** 현재 초안과 원 질문 정보가 있는데 특정 새 호출 정보를 필수로 단정했다. plan은 한정 통과지만 scope/RQ는 반려이며 생성된 원 요청문을 수정해 성공으로 바꾸지 않았다. 구현 전달0. [141 결과](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/docs/cycles/2026-10-30-question-draft-request-141/RESULT.md).
- **Q1 재시도 뒤 Q2 초안 손실:** 작성자의 모의 응답 UI 관찰과 현재 send 코드로 확인한 별도 결함이다. 실제 외부 AI 장애를 재현한 증거와는 다르다.140의 DOM 복원 수리와 별개로 미수리다. 기존 요청문 반려 때문에 결함 자체가 없는 것은 아니다.
- **전체 사용 경험:** 실제 자료→이해→사전에 수용한 요청→구현→수용된 결과 반영을 한 흐름으로 모두 입증하지 못했다.121의 부분 성공,139 FIRST,142 읽기 공개를 합쳐 전체 완성이라고 보지 않는다.
- **다른 관찰:**136 실패 알림은 reload에서 사라질 수 있다.139의 첫 복구 목록에서 ready 표시가 안 보였으나 프로젝트를 열어 결과는 회수했다. 그 표시 원인은 미확인이다. 큰 실제 자료 전반의 의미 정확성, 사람의 시간 절감/사용성은 별도 미입증이다.

## 완료된 결과를 회수하는 방법

판정이 필요한 기능의 위 결과 문서부터 읽고, 그 문서가 인용한 작성자 검사·독립 검토·CI·Root 실제 화면을 구별한다. 실패한 후보를 다시 실행해서 설계를 이해하려 하지 않는다. 예를 들어89의 실제 자료 초기 관찰,91 의미 반려,111/113/117/119 전달·계약 실패,121 한정 성공,130/132 scope 실패,134 한정 성공은 각 당시 조건의 기록이다. 최신 결과가 앞선 실패를 지우지 않는다.

[142 실제 공개 수용](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1e85b729d5e02c235ca47d457b47af2d07d36a07/docs/cycles/2026-10-30-reading-delivery-142/RESULT.md)의 화면은 실제 저장 Zephyr, 이번 [웹사이트 예제 화면](WEBSITES.md)은 누구나 열 수 있는 합성 예제다. 둘의 성격을 섞지 않는다.
