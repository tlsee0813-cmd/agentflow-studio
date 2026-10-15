# cycle11 후보 입력 — 키 검색과 녹화의 후속 수정

2026-10-16 UTC 원문 조회 시점의 입력 판단 기록. 화면 구현 계약이 아니며 현재 진행은 [ACTIVE](../ACTIVE.md)를 따른다.

## 채택하려는 질문과 범위

시안 자체의 개발·검사 기록과 다른 실제 공개 작업에서 **서로 다른 두 사용자 동작의 수정과 공통부의 영향을 구별해 이해할 수 있는가**를 확인할 후보다. 대상은 PowerToys 전체가 아닌 Keyboard Manager 편집기의 키 검색·선택과 녹화 종료 판정 일부다. FLOW091의 ‘요청 사본 전달’ 관계를 이 입력에 복사하지 않는다.

Pro B가 PowerToys·VS Code 두 저장소에서 후보를 비교했고, 총괄이 아래 여섯 GitHub API 원문과 고정 커밋 차이를 직접 대조했다. 기존 cycle07의 VS Code progress/elapsed 사례는 제외했다. API의 User 계정·Bot 계정과 발화/메타데이터를 구분하며, 인물 이름은 역할로만 쓴다.

## 확인한 기록

| 사건 | 시각 UTC | 관측 사실과 출처 | 판정 경계 |
|---|---|---|---|
| AI 코드 리뷰 | 2026-10-09 14:13:51 | [Copilot 리뷰5471238285](https://github.com/microsoft/PowerToys/pull/51150#pullrequestreview-5471238285)는 Tab에서 입력 보존, Shift+Tab 이동, 테스트 보완을 지적 | Bot의 COMMENTED 리뷰이며 사람의 요청/완료 판정이 아님 |
| 검색 수정 요청 | 2026-10-13 06:41:13 | [댓글4255501266](https://github.com/microsoft/PowerToys/pull/51150#discussion_r4255501266): f1 결과를 본 뒤0을 붙이고 즉시Enter하면 F1이 선택된다는 관측과 제출 검색어를 동기 필터링하라는 요청 | 사람계정 리뷰어의 재현 보고이며 우리 재실행이 아님 |
| 녹화 수정 요청 | 같은 시각 | [댓글4255501287](https://github.com/microsoft/PowerToys/pull/51150#discussion_r4255501287): Tab을 누른 채 Space로 녹화를 시작한 뒤 Tab을 놓으면 종료되는 관측; 종료 판정을 key-down으로 한정하도록 요청 | 모든 키 입력/전체 녹화 결함으로 영향 확대하지 않음 |
| 후속 수정 | 2026-10-13 10:50:41 | [a964f08 고정 커밋](https://github.com/microsoft/PowerToys/commit/a964f08cc6fbecb3b9f9d4fe6c1d7481330c7938): 제출 검색어의 공통 FilterKeyList 호출, isKeyDown 조건, 공통 훅의 이벤트 종류 전달을 수정 | 코드 차이와 공동작성 메타데이터가 근거. 우리 실행·AI 단독 구현·다른 세션의 수락은 아님 |
| 작성자 회신 | 2026-10-13 10:51:30 | [답글4257710120](https://github.com/microsoft/PowerToys/pull/51150#discussion_r4257710120)이 검색 댓글을 직접 참조하고 같은 수정 커밋을 지목 | 작성자의 수정 주장이지 독립 검증·새 담당 인계가 아님 |
| PR 상태 | 2026-10-14 05:18:57 병합 | [PR51150](https://github.com/microsoft/PowerToys/pull/51150): closed, merged=true; merge SHA9501b98a097166d9cd665638b34f84be55aaceee | 병합은 출시·실사용 문제 해결·전체 요구 완료와 다름 |

두 사람계정 댓글의 review ID는5499716330이고 **original_commit_id는 모두4671e537039fdeb185190d93e0157ffed954ddca**다. 수정 a964f08의 부모도 이 커밋이다. 현재 댓글의 commit_id는 검색4671e537…/녹화2b31b0c2dcf8bfbabf2c5c2f738055a24969d5f8로 다르므로, 최신 필드와 당시 검토 기준을 혼동하지 않는다.

## 코드로 확인되는 부분과 소속

- 키 검색·선택: `src/modules/keyboardmanager/KeyboardManagerEditorUI/Controls/KeyDropDownButton.xaml.cs`. QuerySubmitted가 이전 ItemsSource 대신 제출된 args.QueryText를 FilterKeyList에 전달한다. 동일 커밋에는 Escape 처리도 있으나 이 두 요청 표본의 핵심과 별개로 둔다.
- 녹화 종료 판정: `src/modules/keyboardmanager/KeyboardManagerEditorUI/Helpers/KeyboardHookHelper.cs`. 종료 조건 앞에 isKeyDown을 추가한다.
- 공통 입력 훅: `src/common/ManagedCommon/HotkeySettingsControlHook.cs`. 이벤트 종류를 전달하는 overload/delegate와 호환 연결을 추가한다. 편집기 내부 자식으로 편입하지 않는다.
- 같은 커밋의 UnifiedMappingControl 포커스 수정과 UI 테스트 변경도 실제로 있지만, 파일이 함께 바뀌었다는 이유만으로 두 요청의 직접 인과를 모두 선언하지 않는다. 테스트 코드 추가를 실행 통과라고 쓰지 않는다.

위 소속은 고정 코드의 경로·네임스페이스와 PR의 편집기 설명에 근거한다. 코드 폴더와 사용자에게 보여 줄 개념적 묶음은 같다고 단정하지 않는다. 실제 두 동작과 이를 돕는 공통부를 구별할 근거는 있으나, 전체 제품의 완성된 포함 트리는 아니다.

## AI·인계·최신 상태의 경계

a964f08에는 Copilot 공동작성과 세션 메타데이터가 있다. 이는 AI 협업의 공개 흔적이며 에이전트 대화 전문, 각 줄의 생성 주체, 신규 세션 인계·수락·실행 성공을 증명하지 않는다. 앞선 Copilot 리뷰를 이 후속 커밋의 지시문으로 단정하지 않는다. 실제 인계 장면을 만들려면 별도 근거가 필요하다.

조회한 PR의 head는2b31b0c2dcf8bfbabf2c5c2f738055a24969d5f8, updated_at은2026-10-14T05:19:00Z다. 최신 PR 본문에는 더 넓은 기능 설명과 작성자 검사 주장이 포함된다. 이를10월9일의 최초 원문 요청으로 되돌려 쓰지 않는다. 이 입력은 과거 사건의 고정 커밋과 조회 시점의 PR 상태를 구분한다.

## 총괄의 입력 채택 판단

[별도 범위 감사](INPUT_SCOPE_AUDIT.md)를 수용한다. 이 사례는 **하나의 요구가 두 기능에 전파된 기록이 아니라, 같은 리뷰의 서로 다른 두 동작 문제를 한 후속 커밋에서 수정한 기록**이다. 두 기능 사이에 인과선을 그릴 근거는 없다. 공통 훅은 녹화 판정에 이벤트 종류를 전달하는 지원 관계로만 확인한다. 검색 수정 회신을 녹화 수정의 독립 성공으로 넓히지 않는다. 추가 UI 테스트의300/500ms 대기는 즉시Enter·Tab을누른채Space라는 두 재현을 직접 보장하지 않는다.

따라서 부분 지도 입력 후보로 채택하되, 실제 인계 성공 표본이라는 이름은 붙이지 않는다. 다음 단계는 실제 동작·공통부·두 별도 변경의 구별을 제품의 기본 공간 화면과 짧은 현재 설명으로 드러내는 연구다. 구현 범위는 별도 선택 뒤 정한다.
