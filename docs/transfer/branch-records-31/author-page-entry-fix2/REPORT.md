# 31 신호 진입 페이지 위치 보완 · 작성자 후보

기준은 통합 `7c7bdfa8d244d83c2c776b91b6a3a669127ba2e9`이다. 독립 Cloud `463fa743`의 integration-30-31/v0 REPORT는 실제 page wheel로 Y120에 도달하고 신호의 clip/hit가 유효한 상태에서 눌렀지만, 직후 1280은 Y116, 1440은 Y0이 됐다고 기록한다. 이후 보고 왕복 보존과 신호 진입 전후 보존은 다른 판정이다. 이 작성자는 브라우저를 실행하지 않았다.

제품은 `openBranchRecords` 한 곳만 바꾼다. 실제 진입 시 page X/Y를 지역값으로 잡고, 기존 30 render 콜백에서 최종 DOM/disclosure 복원 뒤·지도 크기 측정 전에 복원한다. 이어지는 정확 소유 패널의 subtree 열기·초점·패널 내부 스크롤·읽기 메모 순서는 유지한다. 전역 render, 카메라/fit/pan, Origin, layerMemo, CSS, 입력, 스키마는 바꾸지 않는다. DOM 교체 중 clamp나 scroll anchoring의 정확 원인은 이 자료만으로 확정하지 않는다. 콜백 시점의 문서 최대 스크롤이 작은 경우 복원도 clamp될 수 있으므로 실제 효과는 Cloud 대조가 필요하다.

기존 `branch-records31_browser.py`에 method 하나를 추가했다. 기존 네 method는 AST가 동일하며 양 PC 기존8개를 유지한다. 신규 method도 1280/1440에 상속되어 총10개가 된다. 정상 복구 fixture·기존 정상 준비를 재사용한 뒤 실제 문서 wheel120과 native scrollend 완료, 비영점 pageY, 신호의 전체 viewport/map/ancestor clip 및 실제 hit를 확인한다. 실제 click의 제품 handler 직전 capture, handler 뒤 같은 task bubble, 후속 두 frame을 분리해 기록한다. page X/Y·지도 가용 높이/하단·카메라·접힘·정확 소유 패널·열린 기록·첫 소유 글줄 가시성 및 current/draft 포함 프로젝트 전체 보존을 단언한다. 첫 실패는 후속 frame으로 대체하지 않는다. 검사 중 scroll 주입·fit/resize·저장 대기·임의 sleep으로 수리하지 않는다. 사전 준비 자체의 page extent/신호 geometry가 성립하는지도 실제 실행에서 확인해야 한다.

Node24.19.0 작성자 보조에서 TS5.8.3 타입·continuity 빌드 exit0, Python AST와 조합된 JS 상수 구문 exit0, 정확 before 파일에 대한 `git apply --check` exit0이다. 빌드 stderr의 기존 Windows child-process shell 사용 폐기 경고는 보존했다. Node22/브라우저/서버/CI/Cloud 제품 효과는 미실행이다. 다른 폴더·원격은 수정하지 않았다.

소스 원문 before/after는 로컬에 보존한다. 업로드용 소스 payload와 작성자 근거 payload는 분리하며, 증거에 source/dist/dependencies를 중복 포함하지 않는다. 공유 명령 경로는 `<workspace>`로 표시한다.
