# fix3 대표 화면 직접 대조

총괄이 GitHub 공유 PNG를 브라우저로 열어 1280 기본 지도의 정보 버튼이 도구 뒤에 가려진 9330 장면과 9fb311 개선 장면을 대조했다. 9fb311에서는 카드와 정보 버튼이 도구 아래에 배치되어 보인다. 실제 클릭/표본 hit 판정은 독립 Cloud 원본이다.

1440 RB-A-edit 복귀 실패 PNG에서는 호출 작업행이 고정 하단 행동 아래로 가려져 있다. 같은 장면의 정확 before/after는 body 크기 불변, scroll128→70, caller58px하향이며 다른 R-edit 단계의 body 크기와 비교하지 않는다. 중간 레이아웃에서의 clamp는 코드 순서에서 추론했고 fix4의 같은 반례 재실행이 필요하다.

이 화면은 읽을 공간의 다음 문제도 보여 준다. 펼친 기록 목록이 지도 위에서 큰 높이를 차지하며, 작은 PC의 상단 프로젝트명·목적·관리 메뉴 중복도 남는다. 버튼 가림 해소를 Dify 수준 UI 완성으로 간주하지 않는다. 현재 회귀 해결 후 같은 홈→지도→한 부분→요청/인계→복귀 흐름 안에서 상단 맥락과 기록 펼침의 공간 점유를 줄이는 후속 범위를 검토한다.

검토 PNG: [1280 개선](https://github.com/tlsee0813-cmd/agentflow-studio/blob/ebcd3947032000bdce086469f695ec884a71db06/docs/transfer/mixed-depth-18/independent-fix3/pc13-hit-diagnostic/1280-test_01_default_and_selected_first_screen-0.png), [1440 복귀 실패](https://github.com/tlsee0813-cmd/agentflow-studio/blob/ebcd3947032000bdce086469f695ec884a71db06/docs/transfer/mixed-depth-18/independent-fix3/pc13-return-diagnostic/pc13-RB-A-edit.png). 정지 이미지 관측이며 총괄의 직접 제품 브라우저 실행은 아니다.
