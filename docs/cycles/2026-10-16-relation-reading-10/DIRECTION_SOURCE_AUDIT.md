# cycle10 방향 단서 — ProB 출처·의미 감사

공식 문서·고정 코드와 로컬 cycle09 fix1을 읽었다. 로컬 SHA는 `90141c4c5cfc509cafef3c038a9c1c14f0062f7e009e4359f5f97bd5541e3173`으로 직접 확인했다. 브라우저 조작·시안 실행·새 구현은 하지 않았다. Pro의 Output A/B 정적 그림 열람과 JointJS Sandbox 400 응답은 전달된 관측이며, 본 감사의 직접 이미지/실행 결과로 바꾸지 않는다.

## 1. 먼저 바로잡을 원인: 가려짐만 아니라 생략

`work/mixedreading09-author-fix1/mixed-reading-study.html` **448행**은 원래 수신 끝과 대표 끝이 다른지를 `aggTo`로 판정한다. **454행**은 `!aggTo`일 때만 `marker-end`를 넣고, **460행**은 접힌 대표 끝에 원을 그린다. 따라서 기본 깊이에서 R1의 C21, R5의 C42, R6의 C41처럼 **접힌 수신 끝에서는 화살촉 자체가 생략**된다. 원에 가려졌다는 이전 정적 관찰만으로 원인을 설명하면 불완전하다. 선 방향이나 실제 끝점 데이터가 뒤집혔다는 뜻은 아니다.

**63행**에 투명 `stroke-width:14` 클릭 선이 이미 있고, **456–459행**은 양끝을 `min(12, 길이×0.2)`만큼 제외한 경로를 만든다. ‘항상 양끝 12px’이라는 주석보다 실제 조건이 좁다. 따라서 투명 클릭 선 분리를 새로 도입하는 것은 이번 차별점이 아니다. 짧은 선의 남은 누름 영역이나 이웃 카드 간섭이 충분한지는 별도의 실제 관측 문제다.

## 2. JointJS: 대표점과 방향촉의 분리 후보

[4.1 공식 예제](https://docs.jointjs.com/4.1/learn/features/customizing-shapes/relative-position-on-links/) 코드는 양끝을 원으로 표시하고, 별도 방향촉을 선의 상대 위치 0.75에 둔다. `atConnectionRatio`는 선의 해당 위치와 접선에 맞춰 하위 요소를 배치·회전시키는 속성이다. 이는 대표 끝점 표식과 방향 단서를 서로 다른 요소로 표현할 수 있다는 근거다.

고정 `21611cb8a6f65128614025b6dac0900682b75463`의 [package.json](https://github.com/clientIO/joint/blob/21611cb8a6f65128614025b6dac0900682b75463/packages/joint-core/package.json)은 **@joint/core 4.1.0**이다. [connection.mjs](https://github.com/clientIO/joint/blob/21611cb8a6f65128614025b6dac0900682b75463/packages/joint-core/src/dia/attributes/connection.mjs)의 래퍼는 길이/비율 위치의 접선을 구하고, 회전 옵션에 따라 접선 각도와 위치를 transform으로 반환한다. 기본 ratio/length 별칭은 접선 회전을 유지하는 쪽이다. 이 코드는 충돌 회피·짧은 선의 적정 크기·집계 원과의 여유를 자동 보장하지 않는다.

**적용 추론:** 접힌 끝의 원은 유지하면서, 같은 기존 선 몸통에 방향 단서를 별도로 두는 후보는 타당하다. 그러나 75%는 예제 값이며 우리 짧은 단건 선·중앙 관계 수 원·곡선에 그대로 써도 된다는 근거가 아니다. 라이브러리 도입이나 사람의 방향 이해 개선도 아직 확정하지 않는다.

## 3. React Flow: 표시와 클릭 영역의 분리 확인

고정 `ed20810767ad57ee6b0f36ce29953ade5ca20c23`의 [package.json](https://github.com/xyflow/xyflow/blob/ed20810767ad57ee6b0f36ce29953ade5ca20c23/packages/react/package.json)은 **@xyflow/react 12.8.5**다. [BaseEdge.tsx](https://github.com/xyflow/xyflow/blob/ed20810767ad57ee6b0f36ce29953ade5ca20c23/packages/react/src/components/Edges/BaseEdge.tsx#L34-L59)는 표시 path와 같은 경로의 투명 interaction path를 분리하고, 기본 interactionWidth는 20이다. 0이면 보조 path를 만들지 않는다. 이것은 눈에 보이는 선을 두껍게 하지 않고 클릭 범위를 달리하는 코드 근거이지, 터치 성공·방향 가독성 보장은 아니다. 이 파일에는 우리 시안처럼 카드 근처 양끝을 제외하는 처리도 없다.

[현재 Custom Nodes 문서](https://reactflow.dev/examples/nodes/custom-node)는 사용자 정의 노드를 설명하며 예제를 iframe으로 제공한다. 이번 텍스트 접근에서는 Output A/B 그림의 상세나 그 실행 버전을 독립 확인하지 못했다. 따라서 Pro가 본 정적 그림과 고정 12.8.5 소스의 동작을 같은 실행 증거로 합치지 않는다. 우리 HTML은 이미 분리된 클릭 선을 사용하므로 필요한 것은 원리 재발명이 아니라 기존 짧은 선과의 적합성 판단이다.

## 4. 의미 보존 조건과 좁은 후보 판정

현재 `bundles()`(423–425행)는 **방향 있는 대표 끝 쌍**별로 원래 관계를 모으고, 실제 ID·양끝은 각 관계에 남긴다(450·453행). 방향촉을 보완하더라도 ‘대표 묶음으로 향함’은 그 묶음 전체의 모든 자식에 전달한다는 뜻이 아니다. 단건은 실제 관계 하나, 집계는 기존 관계 목록이라는 구별과 원래 끝점 확인 경로를 유지해야 한다. 선의 방향은 원문 전달 방향이며 실행 순서·수정 영향 전파가 아니다.

포트나 갈래를 추가하는 안은 기존 R1–R6의 실제 끝과 대응하는 표시 보조일 때만 검토할 수 있다. Output A/B 같은 새 업무 갈래·입출력 종류를 붙이거나, 한 집계선을 여러 새 관계로 세면 입력에 없는 구조를 발명한다. 반대로 모든 관계 조건을 기본 지도에 펼쳐 정보량을 되돌릴 필요도 없다. **대표점 원과 기존 선 방향촉을 분리하는 작은 후보**를 우선 비교하되, 관계 수·선택 유형·실제 끝·준비 범위는 그대로 둔다는 조건부 추천이다. 정확 위치·모양·클릭 폭은 이 출처 감사에서 확정하지 않는다.

