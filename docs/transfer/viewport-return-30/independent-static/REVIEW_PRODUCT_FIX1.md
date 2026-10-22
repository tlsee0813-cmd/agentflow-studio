# 30 복귀 순서 변경 정적 검토

`work/product30-author`의 app.ts SHA256 `e52eb74e531302905d6e2c86e6be164425ea13d354f8db98007dfc45516748e8` 및 `candidate-fix1.patch` SHA256 `8fbefb6ec527fc0e29f5d19fd7b0d8fa4bb6d6e61ad4998138e3c931bbe63ce5`를 읽었다. 제품 수정이나 실행은 하지 않았다.

변경은 openSpace의 기존 페이지 스크롤 복원을 render의 마지막 배치 계산 직전 callback으로 옮기고, render가 끝난 뒤 markOffscreen을 다시 계산한다. app.ts 337–341행에서 이 callback을 넘기며, 2451–2457행은 실제 DOM 생성·표시와 일반 disclosure 복원을 끝낸 후 callback → sizeWorkspace → finishInitialMapFit → restorePanelReading 순서다. 패널 복원 105–110행은 패널 내부 스크롤만 다루며 페이지 스크롤을 다시 바꾸지 않는다.

일반 render 호출은 callback이 없어 기존 순서를 유지한다. 기존 mapView가 있으면 finishInitialMapFit 1334–1341행은 다시 맞추지 않는다. 마지막 markOffscreen 1314–1321행은 표시·집계만 바꾸며 카메라·좌표·저장 프로젝트를 바꾸지 않는다. 정적 범위에서 추가 차단 결함은 찾지 못했다.

renderMap 내부의 초기 sizeWorkspace 계산은 남아 있지만 최종 표시·스크롤 복원 후 다시 계산하는 경로가 확인된다. 다만 실제 브라우저에서 최종 높이 변화로 페이지 scrollY가 다시 clamp되는지, 0이 아닌 기억 위치와 첫 fit·패널 anchor가 함께 맞는지는 정적으로 확정할 수 없다. 이 경계는 작성자 receipt에도 한계로 기록되어 있으며 Cloud 실제 관측 결과로 판단해야 한다. 이 보고는 실제 viewport 높이나 복귀 성공 판정이 아니다.

