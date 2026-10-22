# 포함 구조와 PC 작업공간18 — 조사·총괄 판단
2026-10-22의 구현 전 판단 기록. 이후 진행/실행 판정은 [ACTIVE](../ACTIVE.md)와 결과 문서를 따른다.

## 무엇을 채택했나
17의 같은 부분 설명 갱신은 평면 Area를 대상으로 통합됐다. 이번에는 그 흐름에 실제 프로그램 포함과 가지별 접기를 연결한다. 동시에 패널이 길어질수록 지도·행동이 밀리는 PC 구조를 고친다. 기능을 모두 담는 범용 계층 엔진이나 새 보고서형 HTML은 만들지 않는다.

[웹 Pro A](https://chatgpt.com/c/6ad9e4e7-e8b4-83e8-b1f4-aebabc8d27b4)는 포함·실제 관계·하위 신호를, [웹 Pro B](https://chatgpt.com/c/6ad9e588-d3e0-83e8-bdd6-660ab76650a7)는 지도 공간·상세 읽기·행동을 새 세션으로 조사했다. 화면 모델은 두 세션 모두5.6 Pro. 외부 서비스 로그인 조작 연구는 하지 않은 문서/공개 소스 조사다. Sol High는 실제 제품과 표본을 감사했고 Astra High는 작업단계 계층·복제된 공유부분·숨은 질문·부모 권위·읽기 부담의 반례를 제시했다. 총괄이 다음과 같이 좁혔다.

- 별도 containment를 두고 Area 정체성/Relation/Task 이어짐을 분리한다. 한 활성부모는 이번 잠정 제약이다.
- 원관계와 보이는 대표점을 구분하며 묶음에서 실제 끝점/종류/방향을 회수한다.
- 조상 참고가 달라지면 자식 설명의 기준을 재검증하되 부모 구상을 자식 실행명령으로 자동 상속하지 않는다.
- Pro A의 신규 OpenMatter 장부·PlacementProposal 수락체계는 보류한다. 기존 질문·보고·설명 이력으로 현재 증거를 드러낸다. 모든 일반 미결을 수집했다는 의미는 아니다. 기존 정확returnId 입력에 별도 위치 선택 승인 단계를 추가하지 않는다.
- Pro B의 viewport 작업공간+고정 패널 머리/행동+본문 스크롤을 채택한다. 페이지흐름+sticky행동은 상세가 길면 지도가 사라져 이번 지도왕복 목적에 불리하다. 패널 리사이저·도킹·새 휠 제스처는 제외한다.
- 과거 좌표를 지키는 경계 프레임은 우선 작은 구현안이다. 겹침이 소속을 오해시키거나 조작을 가리면 ‘좌표보존’만으로 합격시키지 않는다.

## 공식 메커니즘 대조
총괄이 공식 페이지를 다시 열어 범위를 확인했다. 외부 코드는 가져오지 않는다.
- [yFiles folding](https://docs.yfiles.com/yfiles-html/dguide/folding/): 전체 모델과 접힌 보기를 구분하는 원리를 사용한다. 제품의 원관계를 대표점 관계로 덮어쓰지 않는 근거다.
- [WAI treeview](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/): 초점·선택·펼침을 별개 상태로 다룬다. 지도 전체를 그대로 tree widget으로 바꾼다는 뜻은 아니다.
- [ActivityStreams vocabulary](https://www.w3.org/TR/activitystreams-vocabulary/): 이동이나 수락 같은 행위 의미와 단순 관계를 구별하는 참고다. 프로토콜/수락엔진은 채택하지 않는다.
- [Dify quick start](https://docs.dify.ai/en/quick-start): 노드 선택 뒤 구성 패널로 들어가는 구조를 확인했다. 실행 노드/변수/테스트 기능은 목적이 달라 가져오지 않는다.
- [Figma right sidebar](https://help.figma.com/hc/en-us/articles/360039832014-Design-prototype-and-explore-layer-properties-in-the-right-sidebar): 캔버스와 선택 속성의 공간을 구별한다. 패널의 읽기 상태가 지도 카메라와 다른 상태라는 설계에 반영한다.
- [VS Code custom layout](https://code.visualstudio.com/docs/configure/custom-layout): 중심 작업면과 보조 영역의 역할을 참고한다. 전체 사용자 도킹 시스템은 제외한다.

## Dify 실제 관측
총괄은 사용자가 열어 둔 workflow에서 Agent 노드를 선택해 1280×720 화면의 패널을 읽었다. 우측 약400px 패널 본문에 휠을 내리자 제목/닫기/탭은 남고 본문이 스크롤됐으며, 캔버스 노드 위치와64%배율은 관측상 유지됐다. 닫기 후 패널이 사라졌다. 설정값 편집·실행·게시를 하지 않았다. 선택 중 자동저장 표시 시각이 바뀌었으므로 모델 전체가 무변경이라는 강한 증거로 쓰지 않는다.
이 관측은 패널과 캔버스의 스크롤/공간 계약 비교다. Dify와 AgentFlow의 기능·사용성 전체 동등이나 사람 사용자 실험을 뜻하지 않는다. 이 관측 이미지의 공유 저장본은 아직 없으며 제품 실행 증거와 구별한다.

## 표본과 원자료 경계
PowerToys:
- [PR51150](https://github.com/microsoft/PowerToys/pull/51150), [review1](https://github.com/microsoft/PowerToys/pull/51150#discussion_r4255501266), [review2](https://github.com/microsoft/PowerToys/pull/51150#discussion_r4255501287).
- [mapping control](https://github.com/microsoft/PowerToys/blob/a964f08cc6fbecb3b9f9d4fe6c1d7481330c7938/src/modules/keyboardmanager/KeyboardManagerEditorUI/Controls/UnifiedMappingControl.xaml#L74)와 [KeyDropDownButton](https://github.com/microsoft/PowerToys/blob/a964f08cc6fbecb3b9f9d4fe6c1d7481330c7938/src/modules/keyboardmanager/KeyboardManagerEditorUI/Controls/KeyDropDownButton.xaml#L22)을 구성 재서술의 근거로 사용한다. 사용자 원래3층 계획이 아니며 type와 instance의 중복을 주의한다. a964는 두 요구를 함께 고쳤다.

내부 제품13:
- [실제 renderMap](https://github.com/tlsee0813-cmd/agentflow-studio/blob/9aeb4599aa0060e2d43143c4f1150884d7bcc7b3/app/continuity/src/client/app.ts#L1053).
- [v0 독립 관측](https://github.com/tlsee0813-cmd/agentflow-studio/blob/709dab4d730c87b44e1a08a1cddd0cb9832b807a/docs/transfer/pc-map-space-13/independent-v0/REPORT.md#L19), [fix1 작성자 제한](https://github.com/tlsee0813-cmd/agentflow-studio/blob/827f029e0dab79b48ebe8818fb15d32db7ed8d06/docs/transfer/pc-map-space-13/author-fix1/REPORT.md).
- SPACE의1+4와 MAP의하위3구성은 분석자 재구성이다. zoom 수정과 선택카드 clipping은 같은 해결주장이 아니다. 보고/요청 개수도 일반 제품 미결 개수가 아니다.

두 입력 모두 현재 renderer에 데이터만 바꿔 적용한다. 원자료가 없는 경계 조건은 합성이라고 표시한다. 구조화 입력을 사람이/AI가 대응하는 비용은 남으며 자동추출 일반화를 주장하지 않는다.

## 구현·검증 분담의 이유
Claude Code는 사용자가 지정한 구현 경로지만 이번 확인 시 사용 크레딧 소진 화면이었다. 구매하거나 우회하지 않았다. 사용자가 지정한 내부6.1 Sol High를 도메인/검증과 UI/브라우저검사로 분리하며 Astra High는 독립 비판을 맡는다. 실제 브라우저는 기존 독립 Cloud에서 실행한다. 총괄은 계약·통합·수용을 담당한다. [구현 계약](INPUT.md).
