# 공개 데모 관찰 — 2026-10-16
총괄이 Codex 브라우저에서 PC 1280×720으로 직접 조작한 좁은 관찰이다. 사람 사용성 실험이나 버전 고정 실행은 아니다. 이 기록은 화면 관찰 요약이며 재생 가능한 실행 증거 묶음은 아니다.

## Grafana
[공개 Sample Website Dashboard](https://play.grafana.org/d/000000003/sample-website-dashboard?orgId=1&from=now-1h&to=now&timezone=browser)에서 server requests 제목→해당 패널 메뉴→Inspect를 열었다. Data 탭이 선택되고 오른쪽 창 제목에 Inspect: server requests가 남았다. 배경의 같은 패널이 일부 보였으며 시간 범위 Last 1 hour도 유지됐다. Close 후 상세창은 사라지고 같은 대시보드 영역이 보였다. 반환 AX의 초점은 페이지였으며 호출 메뉴 버튼으로의 복귀를 확인하지 못했다. 정확 스크롤 좌표 비교·키보드 전체 왕복·다른 탭·편집·CSV 내보내기는 실행하지 않았다.

대상 이름을 상세 읽기에서 유지하고 편집과 분리하는 원리를 채택한다. 모든 탭·데이터 수치·전체 보고서 형식은 복사하지 않는다. 닫기 호출만으로 선택/초점/스크롤 복귀를 보장할 수 없다는 원문 감사와 일치한다. 실제 Play 빌드와 고정 소스/문서 버전의 동일성은 확인하지 않았다.

## Cytoscape expand-collapse
[공개 데모](https://ivis-at-bilkent.github.io/cytoscape.js-expand-collapse/demo/demo-undoable.html)에서 위쪽 포함 영역의 빈 배경을 선택했다. 회색 테두리와 minus 표식이 보인 뒤 Collapse selected recursively로 내부 여러 점이 하나의 작은 사각 대표로 접히고 외부 선이 그 대표에 연결되는 화면을 확인했다. 이어 Expand selected recursively로 내부가 다시 나타났다. 전체 배치와 크기가 크게 달라졌고 위쪽 포함 영역 일부는 화면 위 경계를 벗어났다. 실제 노드 ID는 화면/접근성에 드러나지 않아 이름을 발명하거나 내부 그래프 상태를 읽지 않았다.

포함과 접힌 대표 끝을 구별하는 원리는 참고하지만, 펼치기가 이전 전체 보기의 복원이라는 보장은 채택하지 않는다. 좌표·선택·줌 보존을 우리 화면에서 독립 검증한다. 데모 자체의 결함으로 확정하지 않으며 레이아웃 옵션/사용자가 의도한 정책은 조사하지 않았다.

draw.io는 이번 직접 조작 대상이 아니고 공식 문서 대조만 했다. 모바일 추가 조작은 하지 않았다. 사용자 PC 우선 지시에 따라 추가 데모 탐색을 종료하고 두 입력의 같은 화면 검증으로 이동한다.
