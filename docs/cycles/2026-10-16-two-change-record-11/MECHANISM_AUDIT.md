# cycle11 Pro B — Grafana 원문 감사

공식 문서·정적 글·고정 코드를 읽었다. 데모 조작·실행·제품 변경은 없다.

- [패널 메뉴](https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/panel-overview/#panel-menu)는 Edit를 패널/시각화 설정 편집, Inspect를 해당 패널의 데이터·통계·메타데이터·JSON·쿼리 열람으로 구분한다. 대상별 상세를 명시적으로 여는 원칙은 지지하지만, 모든 상세를 하나의 ‘근거창’으로 합치라는 권고는 원문 사실이 아닌 우리 적용 가설이다.
- [Inspector 문서](https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/panel-inspector/)의 Data는 쿼리 결과에 변환을 적용한 데이터이며 field override/value mapping은 기본 미적용이라고 설명한다. ‘raw’라는 명칭을 손대지 않은 최초 원자료라는 뜻으로 옮기면 안 된다. 패널 종류에 따라 일부 탭도 없다.
- 고정 [PanelInspectDrawer.tsx 92–103행](https://github.com/grafana/grafana/blob/982d4c678e6b396026dc7c2b94677e7d7f4fa3a0/public/app/features/dashboard-scene/inspect/PanelInspectDrawer.tsx#L92-L103)은 panelRef를 해석해 패널명을 제목에 보간하고, 없으면 일반 제목을 쓴다. 같은 파일 54–89행은 해당 panelRef를 검사 탭들에 전달한다. onClose는 closeModal 호출이다. 대상 연결과 닫기 호출은 확인되지만, 이전 선택·스크롤·초점 복귀는 이 파일로 보장되지 않는다. 공통 Drawer 내부 동작은 감사하지 않았다.
- 버전은 [같은 커밋 package.json 6행](https://github.com/grafana/grafana/blob/982d4c678e6b396026dc7c2b94677e7d7f4fa3a0/package.json#L6)의 **13.3.0-pre**다. 조회한 latest 문서는 **v13.2** 표시이므로 고정 코드와 문서·Play 배포의 동일성을 확인했다고 하지 않는다.
- [공식 글](https://grafana.com/blog/how-to-export-any-grafana-visualization-to-a-csv-file-microsoft-excel-or-google-sheets/)의 게시일 **2024-05-31**은 맞다. 패널에서 Inspect→Data로 오른쪽 창을 열고, 쿼리 결과 data frame을 선택·결합해 CSV로 내보내는 설명이다. 기저 데이터소스 직접 원본 내보내기가 아니며 글의 포괄적 제목보다 패널별 탭 예외를 함께 읽어야 한다. 당시 화면과 현재 Play의 일치·직접 조작 성공은 미확인이다.

Pro의 역할/변경 한 문장→재현조건→명시 근거 열기는 연구 제안이며 사람 이해 효과가 입증된 것은 아니다. ‘부분을 선택한 뒤 빈 내 초안’도 Grafana가 보장하는 계약이 아니고, 현재 제품 Task.id별 manual 4필드 보존과 같지 않다. 과거 원문을 편집 초안과 구분하는 적용 원칙까지만 참고하며 채택은 미정이다.

# cycle11 공간 메커니즘 출처 감사

공식 문서와 고정 코드의 정적 대조다. 직접 UI 조작·현재 데모 실행·사람 이해도 검증은 하지 않았다.

**draw.io 문서에서 확인.** [그룹 선택 문서](https://www.drawio.com/docs/manual/editor/group-shapes-connectors/)의 Selecting cells inside groups는 일반 그룹을 첫 클릭하면 그룹, 다음 클릭에서 자식을 선택한다고 구분한다. swimlane은 내부 도형 직접 클릭으로 개체를, 제목/배경으로 묶음을 선택한다. selectParentFirst 설정은 이 동작을 바꿀 수 있다. 따라서 모든 묶음의 보편적 동작으로 확대하면 안 된다. [컨테이너 문서](https://www.drawio.com/docs/manual/shapes/container-shapes/)는 부모 경계를 넘는 연결과 드래그 편입/제거를 명시한다. 편입은 부모-자식 소속 편집이지 단순 좌표 이동이 아니다. 두 페이지는 현재 문서이며 특정 앱 빌드에 고정되지 않았다.

**Cytoscape 고정 소스에서 확인.** [e01588b 유틸리티 L550–660](https://github.com/iVis-at-Bilkent/cytoscape.js-expand-collapse/blob/e01588bec1f31c76046faa6fb681eee37b78334e/src/expandCollapseUtilities.js#L550)은 제거되는 자식의 부모를 보관한다. 경계를 넘는 선은 최초 originalEnds를 저장하고 접힌 쪽 끝을 대표 노드로 옮긴다. 확장 때 findNewEnd는 원래 끝이 아직 숨겨졌으면 보이는 조상을 찾는다. 양끝이 모두 원래 끝으로 돌아왔을 때만 메타 표시와 originalEnds를 제거한다. 한쪽을 펼쳐도 상대가 접혔다면 상대 끝은 대표에 남을 수 있다. 이는 선 끝의 재배치이며 소속 재판정·모든 좌표/선택/화면 복원 보장은 아니다. 원래 양끝 보관과 여러 선을 한 선으로 집계하는 처리는 같은 의미가 아니다.

**버전·관측 제한.** [고정 데모 L8–18](https://github.com/iVis-at-Bilkent/cytoscape.js-expand-collapse/blob/e01588bec1f31c76046faa6fb681eee37b78334e/demo/demo-undoable.html#L8)은 Cytoscape·레이아웃·undo 확장을 버전 없는 unpkg URL로 불러온다. 데모 파일의 커밋 고정만으로 전체 실행 환경이 고정되지 않는다. Pro의 정적 프레임 확인과 UI/DNS 실패는 직접 조작 성공 증거가 아니며, 현재 공개 데모와 이 커밋의 실행 동일성도 확인하지 않았다.

**우리 적용 판단.** ‘경계를 남긴 내부 동작 선택’은 부분의 소속 맥락을 유지하며 실제 대상을 고르는 후보로 타당하다. 다만 부모 경계는 입력 근거/명시한 보기 제안에서 정하고, 연결이 경계를 넘는다는 이유로 외부 공통 부품을 그 부모에 편입하면 안 된다. 대표 끝과 실제 끝을 구별하는 설명 원리는 참고할 수 있으나, 이 라이브러리의 선택·복귀 보존을 우리 제품의 보장으로 옮길 수 없다. 총괄이 정한 PRODUCT_BOUNDARY에 따라 SOURCE 모델의 기존 지원, 부모 소유 변경 또는 라이브러리 도입을 채택한 것으로 취급하지 않는다.


