# Cloud 비교용 기존 정상 입력 경로 — 코드 확인만

직접 UI를 실행한 결과가 아니다. 프로젝트 JSON/localStorage/DOM 상태 주입 없이,기존 화면과 실제 파일 입력을 사용하기 위한 경로다. 합성 외부 보고는 앱의 실제 인계에서 얻은 식별자·설명 기준을 사용하고 실제 외부 AI 성과라고 부르지 않는다.

1. 홈 `#new-project` → `#brief-input` 목적 → `#brief-start`. 전체 공간의 `#area-add-panel`에서 `#area-name`/`#area-note`와 `#area-add`를 반복하여4/6/8개를 만든다. 추가는 `addArea`를 사용한다. 하위 부분은 해당 `#node-info-<area>` → `#panel-more` → `#child-name`/`#child-note` → `#child-add`로 만든다. 총 개수에는 부모·자식 모두를 센다. 직접부모가 같은 이름이어도 같은 객체로 합치지 않는다.
2. 작업은 `#panel-new-request` 또는 영역의 `#area-new-request` → `#draft` → `#send`로 만든다. MOCK 미리보기가 이미 제공되는 환경에서는 ‘오류 원인은 아직 모르겠어요’ 같은 입력이 `mockAdvice`의 사실 질문 분기에 들어간다(`shared/mock.ts:74–78`). 다른 부분으로 이동해도 실제 질문 기록은 원 소유 부분에 남는다. 유료 모델 호출을 새로 설정하지 않는다.
3. 현재 설명: 정확한 부분의 작업에서 `#file-return-options` → `#copy-file-work` 또는 `#download-file-work`로 실제 H/anchor를 만든다. 그 인계의 return.2 형태에 짧은 합성 report와 understanding을 작성한다. `basedOn`은 실제 anchor의 설명 revision이다. 입력부 `#result-file-panel` → `#select-result-file`/`#result-file-input` → 미리보기 → `#accept-result-file`로 수신한다. valid 적용은 현재 설명이 되고 같은 탭 `receivedAreas`의 설명 갱신 신호를 만든다. 단순 펼침이나 일반 copy는 파일 H를 만들지 않는다.
4. 이전 기준: 설명이 이미 적용된 **한 자식**의 정보 패널에서 `#panel-edit` → `#panel-note` → `#panel-save`로 구상을 실제 변경한다. 기존 설명은 보존되면서 stale이다. 부모 구상을 바꾸면 자손까지 영향을 줄 수 있으므로 현재 설명을 별도로 유지할 반례에서는 자식만 바꾼다.
5. 보류: 다른 자식에서 실제 파일 H를 먼저 만들고,그 자식의 구상을 정상 UI로 바꾼 뒤 **원래 H의 anchor/basedOn을 유지한** 결과 파일을 수신한다. `understandingVerdict`의 plan-changed 경로로 설명이 보류된다. 프로젝트 JSON을 꾸미거나 잘못된 식별자 검사를 완화할 필요가 없다.
6. 네 카드에서도 모든 종류를 실제로 함께 준비할 수 있다: 부모P에는 valid 설명,자식Q에는 질문,자식S에는 stale 설명,자식H에는 held 설명을 둔다. P의 질문·현재설명·갱신·보류·이전기준 문구는 **P의 subtree 집계**이고,Q/S/H 각 잎에 모든 신호가 있는 것으로 표시하지 않는다. 마지막에 P의 기존 요청을 읽고 `#task-view-continue`로 이어가면 P의 기존 ‘앱에서 이어갈 작업’ 표시도 대조할 수 있다. 이는 외부 실행 상태가 아니다.

6/8카드는 위 구조에 일반 영역을 같은 추가 폼으로 더해 비교한다. 맞춤은 기존 `#map-fit`,같은 배율 읽기는 `#map-zoom-in/out`,개별 위치 이동은 기존 `#node-move-<area>`의 실제 끌기/방향키만 사용한다. 위 경로는 준비 제안이며 성공·실패·실제 신호 조합은 Cloud 원시 자료로 확인해야 한다.
