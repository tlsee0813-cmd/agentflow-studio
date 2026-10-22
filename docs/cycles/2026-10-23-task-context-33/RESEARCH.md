# 33 · 대상에 붙은 행동과 기존 구역 연결
2026-10-23 KST 판단 기록. 현재 진행은 [ACTIVE](../ACTIVE.md), 이번 범위는 [INPUT](INPUT.md).

## 조사와 총괄 선택
별도 [Web Pro 세션](https://chatgpt.com/c/6ada8e89-5b6c-83ee-91a5-1e4bfd328c20)에 Dify를 기본으로 n8n·VS Code 두 곳을 비교하게 했다. Pro는32 관측 보고서와040/049 대표 화면을 읽고 공식 문서·고정 소스를 대조했다. 해당 서비스의 실제 조작은 이번 Pro 조사에서 수행하지 않았다. 앞선 Dify 실제 조작이나 별도 ReactFlow 데모 결과와 합치지 않는다.

Pro는 후보A(대상 명시 이어가기+기존 편집/인계/검토 구역 이동)를 먼저, 후보B(수신 구역만 별도 작업면)를 잔여 혼동이 있을 때 시험하자고 제안했다. 총괄은 기존729 코드에 N 전용 이동이 없고 파일 선택 후 focus/scroll도 없음을 대조한 뒤 A를 채택했다. 명시 이어가기 버튼을 reader 제목 곁에 두되 별개 draft 입구는 유지한다. 현재 작업의 실제 입력과 파일용 인계로 이동하고, 선택 직후 기존 수신 검토를 보이게 한다. 전역 sticky 확정 버튼이나 강제순서 wizard는 추가하지 않는다.

공간 지도→한 부분 이해→명시 조정→외부 인계→받은 결과 검토→전체 복귀가 제품 흐름이다. 이번 수정은 상세 구간의 길 찾기를 잇는 작은 실험이며 제품을 검토 보고서 모음으로 확정하는 것이 아니다. 지도 밀도와 작은 글자 문제도 남지만, 관측된 접근 문제를 해결하기 전에 새 설명층을 늘리지 않는다.

## 재사용과 교환조건
기존 reader와 continueTask, 네 수동값 입력과 저장, 파일 결과용 복사/H, 정확 대상·당시 인계·보고 preview, 명시 가져오기를 재사용한다. 일반 복사와 파일 결과용 복사는 구별한다. 바로이동만으로 current 전환·편집·H 생성·복사/수신이 일어나지 않는다.

A는 구역 내부의 읽기 부담까지 없애지 않는다. 실제 N/저장이나 preview 확인이 다시 멀거나 가려지면 도착 위치를 보완한다. 수신 쪽 혼동이 남으면 그때 B를 비교한다. 높이나 클릭 수 하나를 낮추는 것보다 현재/read/draft의 대상 구별과 아직 가져오기 전이라는 이해가 우선이다.

## 독립 원문 대조
아래는6.1 Sol High의 지정 원문·raw 대조를 총괄이 읽고 수용한 범위다. 특히 Dify 확인이 모두 고정이라는 확대, n8n 제목이 항상 표시된다는 확대, 새 수신보고를 사용자 요청 생성으로 부르는 확대를 배제한다.

총괄이 전달한 Pro의 최소 A는 기존 기능을 좁게 연결하는 비교 후보로 타당하다. 다만 아래 코드가 그 후보의 실제 사용성 개선을 입증하는 것은 아니다. Pro 대화 전체를 새로 열거나 UI를 실행하지 않고, 전달받은 세 주장만 지정 commit의 GitHub 원문으로 검증했다. 전역 고정 확인 버튼·wizard·새 엔진의 근거로 확대하지 않는다.

## 세 메커니즘의 정확한 범위

- **Dify:** 지정 workflow-panel은 높이가 한정된 flex column과 overflow-hidden 안에 shrink-0 헤더를 두고, 설정/최근실행 본문은 overflow-y-auto로 나눈다. 헤더는 제목과 행동을 담는다. 이것은 패널 내부 분리이며 전역 sticky 규칙이 아니다. [패널 637–654행](https://github.com/langgenius/dify/blob/9f75925578ecd093ce3d1e30cb4c68f6efb8398c/web/app/components/workflow/nodes/_base/components/workflow-panel/index.tsx#L637), [본문 770–792행](https://github.com/langgenius/dify/blob/9f75925578ecd093ce3d1e30cb4c68f6efb8398c/web/app/components/workflow/nodes/_base/components/workflow-panel/index.tsx#L770).
- Dify의 before-run-form은 **sibling 디렉터리**다. 108행에서 시작한 스크롤 div가154행까지 이어지고 시작/생성 버튼131–150행도 그 안에 있다. 따라서 ‘확인 행동이 모두 고정돼 있다’는 설명은 틀리다. 이 폼은 조건에 따라104행에서 아예 생략될 수도 있다. [폼 104–155행](https://github.com/langgenius/dify/blob/9f75925578ecd093ce3d1e30cb4c68f6efb8398c/web/app/components/workflow/nodes/_base/components/before-run-form/index.tsx#L104).
- **n8n:** NodeSettings의 active node는 props 또는 NDV store에서 오고, node.name을 Header에 전달한다. Header는 그 nodeName으로 실제 노드를 조회하고 실행 버튼에도 같은 이름을 준다. 헤더의 flex-shrink는0, 아래 parameter wrapper는 overflow-y:auto다. 다만 이 Header 파일은 tabs/실행 버튼을 렌더하므로, 이것만으로 ‘대상 제목을 늘 보여준다’고 말할 수는 없다. embedded에서는 다른 헤더도 사용한다. [대상 전달 705–743행](https://github.com/n8n-io/n8n/blob/80fc1ce17371495d04e27db86b85cb75feb6af09/packages/frontend/editor-ui/src/features/ndv/settings/components/NodeSettings.vue#L705), [정확 실행 대상 29·61–70행](https://github.com/n8n-io/n8n/blob/80fc1ce17371495d04e27db86b85cb75feb6af09/packages/frontend/editor-ui/src/features/ndv/settings/components/NodeSettingsHeader.vue#L29), [헤더 78–85행](https://github.com/n8n-io/n8n/blob/80fc1ce17371495d04e27db86b85cb75feb6af09/packages/frontend/editor-ui/src/features/ndv/settings/components/NodeSettingsHeader.vue#L78), [본문 971–988행](https://github.com/n8n-io/n8n/blob/80fc1ce17371495d04e27db86b85cb75feb6af09/packages/frontend/editor-ui/src/features/ndv/settings/components/NodeSettings.vue#L971).
- **VS Code:** breadcrumbs의 해당 함수는 파일이면 editor를 열고, 디렉터리면 다음 picker를 선택하고, outline이면 해당 위치를 reveal한다. 편집·저장·실행을 수행하는 함수가 아니다. 따라서 탐색 맥락의 단서로만 재사용할 수 있다. [730–745행](https://github.com/microsoft/vscode/blob/c024bfb636e6db359ca29775b88c819866c84863/src/vs/workbench/browser/parts/editor/breadcrumbsControl.ts#L730).

## exact729에 연결할 때 지킬 경계

729는 상단 인계 행동 → 긴 outcome-home → 현재 작업·직접 편집 → 별개 draft·파일수신 순서다. continueTask는 명시 current 전환 후 outcome-home으로 이동하며, 직접 N이나 인계로 가는 새 전용 이동은 없다. 파일 선택은 preview를 만들 뿐 focus/scroll을 하지 않는다. 따라서 A는 이 기존 동작 사이의 거리를 비교할 후보이지, 새 작업·수신 엔진을 만들 이유는 아니다. [continue 444–453행](https://github.com/tlsee0813-cmd/agentflow-studio/blob/72940a043d7a7fdc225a9582ce48831fa0418cc0/app/continuity/src/client/app.ts#L444), [현재 인계·편집 1011–1043행](https://github.com/tlsee0813-cmd/agentflow-studio/blob/72940a043d7a7fdc225a9582ce48831fa0418cc0/app/continuity/src/client/app.ts#L1011), [파일 선택 2538–2549행](https://github.com/tlsee0813-cmd/agentflow-studio/blob/72940a043d7a7fdc225a9582ce48831fa0418cc0/app/continuity/src/client/app.ts#L2538).

1. reader의 명시 continue를 옮겨도 별개 draft를 여는 주행동과 실제 대상 안내를 유지해야 한다. continue 후 N 편집의 대상은 **실제 currentTaskId**다. 읽던 요청의 현재 보고를 계속하는 기존 분기에서는 그 보고의 후속 확인 값을 고치며, 읽던 원요청을 강제로 편집하지 않는다. 위치 이동만으로 draft 이동·전송·수동값 변경·재정리·H 생성이 일어나면 안 된다.
2. 파일 선택 뒤 미리보기 이동은 여전히 ‘선택/검토’다. 확인 버튼에서 exact task/H 및 project/epoch/revision을 다시 검사하고, 입력이 바뀌면 재검토를 요구하는 기존 정책을 유지해야 한다. file.arrayBuffer나 저장을 기다리는 사이 사용자가 다른 보기·복구사본으로 갔는데 뒤늦게 화면을 낚아채면 안 된다. 같은 Project.id인 복구사본도 있으므로 기존 activation epoch 보호를 프로젝트 ID만으로 줄이면 안 된다. 확인은 해당 preview에 남겨 두고 자동 수신이나 전역 고정 CTA로 바꾸지 않는다. [현재 검증·수신 794–815행](https://github.com/tlsee0813-cmd/agentflow-studio/blob/72940a043d7a7fdc225a9582ce48831fa0418cc0/app/continuity/src/client/app.ts#L794).
3. 기존 origin은 보기·읽기 위치·호출자를 복구하지만 현재 작업을 rollback하지 않는다. 새 이동 입구도 실제 project/task/current와 출발점을 구분해야 한다. aria-live나 DOM 존재만으로 필요한 대상과 확인 행동이 실제 viewport 안에 보인다고 판단해서는 안 된다. B는 A의 실제 관측이 부족할 때만 별도 검토할 후보로 남는다.

## ‘후속 초안’이라는 표현의 정정

32의 실제 최종 저장본은 양 PC 모두 **작업11인 새 수신 보고 task**가 current다. 그 source kind는 report이고 parent는 명시 인계한 작업02다. 네 manual 값과 advice/mode는 모두 null이며 resultFile은 있다. 즉 새 사용자 요청이나 AI가 새로 정리한 작업문을 생성한 것이 아니다. UI가 이를 ‘후속 확인 작업문 초안’으로 표시하는 현재 정책을 설명할 때 이 사실을 함께 말해야 한다. 또한 다른 작업에 도착한 결과는 기존 current를 유지할 수 있으므로 ‘수신하면 언제나 새 초안으로 전환’도 부정확하다.

[HANDOFF_BINDING](https://github.com/tlsee0813-cmd/agentflow-studio/blob/57896a27266c20b21ac1c3b2a94ba27ca7294eec/docs/transfer/reentry-judgment-32/observer-a/v0/HANDOFF_BINDING.json)의 정확 receivedTask로 최종 envelope를 골라 검사했다. 두 해제 저장본 SHA256은 1280 `ebfe6f12…cb9312`,1440 `882573bb…00183`로 SNAPSHOT_INDEX와 일치한다. 발췌는 REPORT11_KIND.json이다. 최초에는 envelope의 첫 프로젝트를 골라 이전 T0 사본을 읽었으나, 그 원발췌를 별도 보존하고 정확 receivedTask/entry로 바로잡았다. 이는 자료 선택 오류이며 제품 동작으로 보고하지 않았다. [실제 수신 정책 domain63–75·150–163행](https://github.com/tlsee0813-cmd/agentflow-studio/blob/72940a043d7a7fdc225a9582ce48831fa0418cc0/app/continuity/src/shared/domain.ts#L63)과도 일치한다.

제품·검사·원격 변경, UI·서버·AI 실행은 하지 않았다. 지정 GitHub connector 원문 읽기와 저장 자료의 해제·JSON 조회만 수행했다. 별도 Pro 세션의 제안 채택과 효과 판정은 총괄의 범위다.

