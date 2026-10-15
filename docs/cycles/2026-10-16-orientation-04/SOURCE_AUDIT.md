# cycle04 원문 대조 모음

2026-10-16 · 내부 6.1 Sol High 두 담당의 독립 정적 대조를 총괄이 모았다. UI 관측·시안 실행·사람 사용성 결과가 아니다. 고정 코드와 갱신 가능한 문서를 각 절에서 구분한다.

## cycle04 — OsmAnd 원문 좁은 대조

2026-10-16 · Sol. 지정된 공식 코드 1개와 [Map Context Menu 공식 문서](https://osmand.net/docs/user/map/map-context-menu/)만 읽었다. 직접 UI·사람 효과 검증, 추가 구현·라이선스 조사·원격 수정은 없다. 문서는 조회 시점의 갱신 가능 자료이며 코드와 같은 버전으로 고정된 자료가 아니다.

**판정:** 메뉴 단계·방향별 분기와 관계 종류 구분은 지지된다. 출발 전체 보기의 선택·지도 위치·배율·초점 복원은 지정 소스로 확인되지 않는다.

| 주장 | 고정 코드가 말하는 범위 |
| --- | --- |
| 세 단계 메뉴 상태 | [MenuController.java 79–98행](https://github.com/osmandapp/OsmAnd/blob/0801f55492156928cb6bb5d53203cdff3ea2cd8d/OsmAnd/src/net/osmand/plus/mapcontextmenu/MenuController.java#L79-L98)은 `HEADER_ONLY=1`, `HALF_SCREEN=2`, `FULL_SCREEN=4` 및 컨트롤러의 `currentMenuState`를 정의한다. 이름만으로 실제 화면 점유 픽셀이나 지도 가시성까지 확정할 수 없다. |
| 세로/가로 분기 | [380–402행](https://github.com/osmandapp/OsmAnd/blob/0801f55492156928cb6bb5d53203cdff3ea2cd8d/OsmAnd/src/net/osmand/plus/mapcontextmenu/MenuController.java#L380-L402)의 **기본 구현**은 가로 레이아웃에서 초기/지원 상태 모두 FULL_SCREEN, 그 외에는 HEADER_ONLY로 시작해 세 단계를 지원한다. 추상 기반 클래스의 재정의 가능한 메서드이므로 모든 객체/하위 컨트롤러가 반드시 세 단계를 거친다고 일반화하지 않는다. |
| slideUp/Down | [404–438행](https://github.com/osmandapp/OsmAnd/blob/0801f55492156928cb6bb5d53203cdff3ea2cd8d/OsmAnd/src/net/osmand/plus/mapcontextmenu/MenuController.java#L404-L438)은 비트 이동으로 다음 지원 상태를 찾아 같은 `currentMenuState`를 바꾸고 성공 여부를 반환한다. 지원되지 않는 중간 단계를 건너뛸 수 있다. 최하단에서 false를 반환하는 것만으로 메뉴 닫기 동작까지 확인한 것은 아니다. |

생성자는 설명/빌더를 보관하고 초기 메뉴 상태를 설정한다([123–130행](https://github.com/osmandapp/OsmAnd/blob/0801f55492156928cb6bb5d53203cdff3ea2cd8d/OsmAnd/src/net/osmand/plus/mapcontextmenu/MenuController.java#L123-L130)). 위 상태 전환은 그 컨트롤러의 펼침 상태 변경이다. 호출부의 실제 선택 유지·객체 교체·이전 전체 보기 저장/복원을 감사한 결과는 아니다.

## 문서의 관계 구분

공식 문서는 선택 객체의 메뉴에서 Details 또는 위로 스와이프해 정보를 확장한다고 설명한다. 다음은 서로 다른 항목이다.

- **Related:** OpenStreetMap relation으로 연결된 객체. 지원되는 relation 기반 POI(예: 캠퍼스·multipolygon)에 제공되며 항목을 누르면 그 객체의 context menu를 연다. 임의의 의미적 관련성을 자동 추론한다는 뜻은 아니다.
- **Within area:** 객체가 들어 있는 지리/행정/토지 이용 등의 영역이다. 주변 polygon을 작은 면적부터 나열한다. Related와 같거나 우리 프로그램의 모듈 포함 관계라는 근거가 아니다.
- **Nearby POIs:** 근처 관심 지점 목록/지도 표시/같은 범주 추가 검색이다. 항목 선택은 지도를 그 지점으로 옮기고 메뉴를 연다. 근접성은 relation 소속이나 인과적 영향의 증명이 아니다. Nearby Popular Places는 별도 항목이며 관련 Wikipedia 지도 다운로드 조건도 붙는다.

문서의 Android/iOS 설명 전체를 이번 **Android Java 기반 클래스**의 동일 구현으로 확인했다고 쓰지 않는다. 메뉴 닫기 안내도 출발 지도 상태의 정확한 복원 보장은 아니다.

## 이번 적용 범위

같은 대상의 요약/상세 단계와 **관계·포함·근처를 섞지 않는 라벨링**만 참고할 수 있다. 가변 시트 새 구현은 이번 배정에서 보류하며, A 관련 범위 먼저/B 짧은 설명의 참조 직행 비교를 이 소스의 채택으로 포장하지 않는다. 우리 동작별 `related`의 미지정을 실제 무관함으로 확정하거나 자동 소유·영향 분석으로 확장하지 않는다. 출발 보기 복귀와 탐색 부담 개선은 우리 앱에서 별도 관측할 계약이다.

---

## cycle04 ArcGIS 공간 메커니즘 원문 감사

지정 공식 문서 두 개만 읽었다. 추가 제품 검색·실제 UI 조작·실행·원격 수정은 하지 않았다. 첫 문서는 latest 게시본이며 고정 코드 SHA 증거가 아니다.

## Experience Builder

아래는 모두 [공식 Map widget 문서](https://doc.arcgis.com/en/experience-builder/latest/configure-widgets/map-widget.htm)의 Settings/Interaction options에 대한 대조다.

| 주장 | 판정과 조건 |
|---|---|
| 다른 위젯의 선택을 지도 popup으로 읽기 | **명시됨.** popup 활성화와 선택 시 표시 옵션으로 Table/List의 feature 선택에 지도 popup을 띄울 수 있다. |
| popup과 위젯들이 같은 선택을 공유 | **제한적 해석.** 위 방향의 연결은 확인되지만 모든 popup/위젯의 자동 양방향 선택 공유는 이 문서에 없다. 데이터 소스·트리거·대상/행동을 구성하는 조건을 생략하면 과장이다. |
| 넓으면 오른쪽 위, 작으면 아래 도킹 | **기본값으로 명시됨.** large/medium은 지도 우상단, small은 지도 하단이다. Map widget 기준이며 사용자 지정 anchor와 실행 중 도킹/해제도 가능하다. |
| 관계를 설정해야 관련 기록을 읽음 | **명시됨.** 데이터에 관련 기록이 있고 Map Viewer popup에 관련 기록 표시를 구성해야 한다. 이를 임의 항목의 관계 자동 발견으로 확대하면 틀리다. |
| small에서 overview map 없음 | **해당 도구에 명시됨.** 작은 화면 레이아웃에는 이 inset 도구가 나타나지 않는다. |
| extent 이동·선택 해제 복귀가 있음 | **조건부로 명시됨.** Extent navigate는 방문한 지도 범위의 앞뒤 이동이다. 다른 위젯의 선택 변경→Zoom/Pan 행동에 별도 옵션을 켜면 선택 해제 시 initial extent로 돌아간다. 진입 직전 상태의 저장·복원과 같은 계약은 아니다. |

위 설정은 가능 동작의 문서화이지 해당 앱에서 클릭 성공을 관측한 증거가 아니다.

## 별도 제품의 모바일 사례

[Esri 지원 문서 000037933](https://support.esri.com/en-us/knowledge-base/problem-pop-up-window-docked-on-mobile-devices-in-arcgi-000037933)는 **ArcGIS Instant Apps Basic (Media Map)**을 다룬다(게시/갱신 2025-10-01). 모바일에서 popup이 전체 화면으로 도킹돼 지도 가시성과 다른 feature 탐색을 방해하는 사례다. 가독성을 위한 모바일 기본 설계와 hover 옵션 뒤 도킹이 유지되고 해제 아이콘이 사라지는 조건을 설명하며, 고정 위치 설정을 안내한다. 이를 **Experience Builder의 관측된 결함**으로 합치면 제품·조건을 혼동한 잘못된 주장이다.

## 우리 시안에 대한 해석

가져올 후보는 ‘같은 대상의 선택과 상세 연결’, ‘크기에 따라 상세 배치를 달리하되 맥락 가림 확인’이다. 선택/초점·깊이·배율·이동·본문 읽기 위치를 진입 직전 값으로 되돌린다는 우리 계약은 별도 검증해야 한다. 지도 범위 이력이나 초기 범위 이동이 그 계약을 대신하지 않는다. 데이터 관계 설정을 프로그램의 실제 포함·의존 관계로 간주하거나 GIS 도구를 그대로 도입할 근거도 아니다.

---

## cycle04 — Power BI 공식 문서 대조

2026-10-16 · Sol. 지정 문서 두 개만 읽었다. 직접 UI·사람 검증, 추가 조사·구현·원격 수정은 없다.

## 모바일 문서가 보장하는 범위

근거: [View Power BI reports optimized for your phone](https://learn.microsoft.com/en-us/power-bi/explore-reports/mobile/mobile-apps-view-phone-report). 조회 시 갱신일은 **2026-08-04**, 적용 대상은 **Power BI mobile apps**다. 고정 코드 버전 자료가 아니며 최소 앱 버전은 명시하지 않는다.

| Pro 주장 | 판정과 제한 |
| --- | --- |
| focus에서 바꾼 선택이 개요에도 반영 | **지지.** ‘Open visuals in focus mode’는 focus와 report canvas 사이의 조작 전파를 양방향으로 설명한다. ‘Drill to next level’의 복귀 예시도 낮춘 계층이 계속 펼쳐져 있다. 현재 탐색 상태 공유의 근거이며 진입 직전 선택·좌표·배율·초점의 snapshot 복원을 보장하지 않는다. |
| 내부 스크롤 동안 canvas 제스처 억제 | **표현 수정.** ‘Select visuals’는 visual이 **선택된 동안** canvas 제스처를 억제하고 내부 스크롤을 허용하며, 바깥 터치로 선택 해제한다고 설명한다. 스크롤하는 순간에만 적용되거나 focus mode에서만 적용된다는 설명은 아니다. |
| Revert는 작성자 상태로 복귀 | **지지.** 탐색 단계를 지우고 보고서 작성 시 정의로 되돌린다. visual 또는 report 단위이며 진입 전 상태 복구와 다르다. |
| 모바일 최적화는 앱용, 웹은 일반 view | **앞부분만 명시적 지지.** 앱 적용과 전화에서 최적화 view 자동 열기는 명시된다. 최적화 view가 없으면 작은 일반 보고서/회전·확대를 설명한다. 그러나 지정 두 문서만으로 **웹에서는 항상 일반 view**라고 확정할 수 없다. |

## 강조와 필터

근거: [Filters and highlighting in Power BI reports](https://learn.microsoft.com/en-us/power-bi/create-reports/power-bi-reports-filters-and-highlighting). 갱신일 **2025-08-29**. Power BI service를 설명하고 Desktop 경험이 거의 같다고 한 문서이며 모바일 앱의 모든 동작 보장은 아니다.

‘Cross-filter and cross-highlight visuals’는 **강조는 관련 데이터를 강조하고 나머지를 흐리게 남김**, **필터는 관련 데이터만 보이고 나머지는 표시하지 않음**으로 구분한다. 모든 visual의 동작이 같지 않고 작성자가 상호작용을 변경할 수 있으므로, 어떤 선택도 항상 강조 방식이라는 일반화는 금지한다. Reading view의 개인 필터 저장과 작성자 기본값으로의 Reset 설명도 진입 전 복귀와 구별한다.

## cycle04에 가져올 한계

현재 대상과 관련 범위를 강조하면서 나머지 맥락을 남기는 선택지는 참고할 수 있다. 하지만 우리 배열의 미지정 연결을 실제 무관함으로 확정하거나 데이터 필터링으로 숨길 근거는 아니다. 선택 상태 공유·작성자 기본값 복원·출발 보기 복귀는 서로 다른 계약이다. 우리 앱의 관련 의미·다른 깊이·지도/읽기 위치·초점 보존과 탐색 부담 개선은 별도로 관측해야 한다.

---

## cycle04 — Grafana 원문 좁은 대조

2026-10-16 · Sol. 지정된 공식 코드 2개와 공식 panel inspector 문서만 읽었다. 코드 기준은 `grafana/grafana@2f7962500e52281d8345e087bc6a3fea4299a025`다. 문서는 조회 당시 `latest`(v13.2 표시)이며 같은 커밋에 고정된 문서가 아니다. 실제 Grafana UI 실행·구현·원격 쓰기는 하지 않았다.

**판정:** Pro의 ‘같은 패널 참조와 제목으로 상세 대상 연결’ 주장은 지지된다. 변환 기본값은 고정 코드와 최신 문서의 설명 차이로 남겨야 하며 실제 제품 버그나 실행 결과로 확정할 수 없다.

| 주장 | 원문 대조 |
| --- | --- |
| `buildTabs`가 같은 `panelRef` 전달 | [PanelInspectDrawer 54–86행](https://github.com/grafana/grafana/blob/2f7962500e52281d8345e087bc6a3fea4299a025/public/app/features/dashboard-scene/inspect/PanelInspectDrawer.tsx#L54-L86)은 drawer 상태에서 가져온 같은 참조를 Data/Stats/Query 및 조건부 Metadata/Errors, JSON 탭에 전달한다. 모든 패널에 모든 탭을 무조건 만든다는 주장은 아니다. |
| 제목이 원래 패널 이름을 연결 | [같은 파일 92–101행](https://github.com/grafana/grafana/blob/2f7962500e52281d8345e087bc6a3fea4299a025/public/app/features/dashboard-scene/inspect/PanelInspectDrawer.tsx#L92-L101)은 같은 참조를 resolve해 `Inspect: ${panel.state.title}`를 보간하고, 패널이 없으면 일반 제목으로 대체한다. 따라서 고정된 별칭을 복사하기보다 현재 참조의 제목으로 대상 맥락을 붙이는 구조다. 제목만으로 객체의 고유성을 보장한다는 뜻은 아니다. |
| 상세 데이터도 동일 대상 사용 | [InspectDataTab 50–58·73–77행](https://github.com/grafana/grafana/blob/2f7962500e52281d8345e087bc6a3fea4299a025/public/app/features/dashboard-scene/inspect/InspectDataTab.tsx#L50-L77)은 그 `panelRef`를 resolve해 데이터·시간 범위를 얻고 패널 이름/플러그인/fieldConfig를 상세 렌더러에 전달한다. 이름만 같은 별개 데이터에 연결한 코드라는 해석은 지지되지 않는다. 다만 실시간 화면 전체의 일관성·버전 스냅샷 보장은 별도다. |
| 변환 적용 기본 설명과 코드 초기값 차이 | [InspectDataTab 24–32행](https://github.com/grafana/grafana/blob/2f7962500e52281d8345e087bc6a3fea4299a025/public/app/features/dashboard-scene/inspect/InspectDataTab.tsx#L24-L32)은 `withTransforms:false`로 시작하고 [55–57행](https://github.com/grafana/grafana/blob/2f7962500e52281d8345e087bc6a3fea4299a025/public/app/features/dashboard-scene/inspect/InspectDataTab.tsx#L55-L57)은 false일 때 `sourceData`를 택한다. 반면 [공식 panel inspector 문서](https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/panel-inspector/)의 Data tab 설명은 변환이 적용된 쿼리 데이터를 보여 준다고 기술한다. 정확히는 문장의 ‘by default’는 뒤의 field options 미적용 설명에 붙어 있으므로 ‘변환 기본값=true라고 명시했다’는 직접 인용으로 바꾸면 안 된다. **고정 코드 초기값과 문서의 일반 표시 설명이 다르다**가 안전한 결론이다. |

`getQuerySourceOf`는 이 패널의 `SceneDataTransformer` 앞 데이터를 얻는 보조 함수다. 이를 모든 상위 처리까지 없는 순수 원본이라고 확대하지 않는다. 코드 옵션 변경 경로와 위임된 상세 렌더러는 있으나 이번 범위에서 실행 추적하지 않았다. 코드/최신 문서의 버전·구현 경로 차이가 해소되지 않았으므로 실제 기본 화면 동작을 확정하지 않는다.

## 우리가 가져올 범위

요약에서 선택한 **동일 기록/부분의 참조**를 근거 상세에 전달하고, 상세 제목에도 그 대상 이름과 문서 기준을 남긴다는 설계 원리만 참고할 수 있다. 표시 이름만으로 동일성을 판정하거나 상세가 요약과 항상 같은 가공 결과라고 가정하지 않는다. 발췌·해석·원문/변환 수준도 구별해야 한다.

drawer의 `onClose`는 `closeModal()` 호출까지만 보인다. 이 두 파일만으로 자동 초점·읽기/지도 위치 복원·선택 보존·닫힘 후 재탐색 감소를 보장하지 않는다. 승인·배정·준비/송신 구별을 구현하거나 검증한 사례도 아니다. 우리 앱의 이 경계와 사람의 이해 개선은 별도 설계·실제 관측 대상이다.

---

## cycle04 Terraform 정보 위계 원문 감사

정적 문서 조사만 수행했다. 실제 HCP Terraform UI·브라우저 조작·소스 실행은 하지 않았으며 원격 변경도 없다. 지정 고정 settings는 GitHub connector로 원문과 줄 번호를 확인했고, manage는 현재 공식 게시 문서로 읽었다. **manage는 동일 SHA로 고정된 문서가 아니다.**

| Pro 주장 | 원문 대조 판정 |
|---|---|
| Structured Run Output에서 자원·출력 항목을 펼쳐 상세 읽기 | **명시됨.** settings의 User Interface L154–162는 plan/apply 결과를 읽기 쉬운 형식으로 표시하고 각 resource와 configured output의 상세를 펼칠 수 있다고 설명한다. 기본 활성화 및 Terraform 버전별 기능 차이도 있다. 임의의 프로젝트 자원 트리·공간 지도라는 주장은 없다. [고정 settings 해당 절](https://github.com/hashicorp/web-unified-docs/blob/6f51c2e0c10179eb500abe5b9eb6b38f733bf901/content/terraform-docs-common/docs/cloud-docs/workspaces/settings/index.mdx#L154-L162) |
| 실행 상태·commit 정보를 유지한다 | **‘같은 run 상세 페이지에 제공’까지 명시.** manage의 Navigating Runs는 현재 상태·연결 commit·시작 맥락·timeline·출력을 열거한다. 펼침 중 고정 표시, 전체→상세 왕복의 선택/초점/스크롤 보존은 설명하지 않는다. ‘유지’가 그런 동작 보장을 뜻하면 **과장/미확인**이다. [manage](https://developer.hashicorp.com/terraform/cloud-docs/workspaces/run/manage#navigating-runs) |
| plan/apply 구별 | **명시됨.** manage는 두 명령의 출력을 구분하며 해당 명령 실행 중에는 기본 표시, 끝나면 기본 숨김이라고 설명한다. 모든 출력이 늘 펼쳐 있다는 해석은 틀리다. 두 작업의 상세 시각 배치까지 이 문장만으로 확정할 수 없다. [manage](https://developer.hashicorp.com/terraform/cloud-docs/workspaces/run/manage#navigating-runs) |
| Confirm & Apply는 읽기와 별도의 행동 | **조건부로 명시됨.** run 상세 하단의 상호작용으로 열거되며 적용 권한·run 상태에 따라 제공된다. plan에 확인이 필요할 때 사용하는 버튼이고 manual apply인 확인 대기 등에서는 계속/폐기를 기다린다. 상세를 펼치는 것과 적용을 같은 행동으로 취급할 근거가 없다. [manage](https://developer.hashicorp.com/terraform/cloud-docs/workspaces/run/manage#interacting-with-runs) |
| speculative plan은 적용 불가 | **지정 두 출처에는 직접 명시되지 않음.** plan-only/locking 언급만으로 이 문장을 해당 출처의 직접 진술로 인용하면 부정확하다. manage가 연결하는 별도 공식 Remote operations의 Speculative Plans 절에는 plan-only이며 변경을 적용할 수 없다고 명시한다. 따라서 사실 자체는 보충 출처로 확인되지만 출처를 분리해야 한다. [별도 보충 문서](https://developer.hashicorp.com/terraform/cloud-docs/workspaces/run/remote-operations#speculative-plans) |
| 항상 사람의 승인 단계를 거친다 | **아님.** 고정 settings Auto-apply L81–91는 성공 plan의 자동 적용과 manual 선택을 구분한다. UI/API/VCS 실행 설정, 별도 run-trigger 설정, CLI의 auto-approve, 적용 권한 없는 사용자의 plan 예외를 명시한다. ‘항상 승인’ 또는 반대로 ‘항상 자동 적용’은 둘 다 과장이다. [고정 settings 조건](https://github.com/hashicorp/web-unified-docs/blob/6f51c2e0c10179eb500abe5b9eb6b38f733bf901/content/terraform-docs-common/docs/cloud-docs/workspaces/settings/index.mdx#L81-L91) |

우리 UI에 가져올 후보는 **변경 요약에서 그 변경에 해당하는 상세를 필요할 때 읽기**, 그리고 **읽기와 실제 적용을 구분하기**다. 이는 문서에서 추출한 설계 해석이지 우리 제품의 효과가 입증됐다는 뜻이 아니다. 자원 트리·성공 배지·승인 절차를 도입할 근거로 확대하지 않는다. 복귀 맥락·초점·스크롤 보존이나 사용자의 이해 향상은 우리 시안에서 별도로 검증해야 한다.
