# 화면 크기 점검 — 총괄 별도 프로필

역할별 첫 사용과 분리된 `environment_check` 프로필에서 UI만 조작했다. 1280×900과 390×844를 비교했다. 터치 실기기 검사는 아니며, 관찰하지 않은 모든 화면이 안전하다는 의미는 아니다.

| 화면 | 1280px 증거 | 390px 증거 | 관찰 |
|---|---|---|---|
| 빈 시작 화면 | evidence/environment_check/01.jpg | evidence/environment_check/02.jpg | 심각한 겹침을 관찰하지 못했다. 390px는 입력과 안내가 세로로 길어진다. |
| 첫 요청 정리 후 상단 | evidence/environment_check/07.jpg | evidence/environment_check/05.jpg, 06.jpg | 복사·저장 버튼이 세로 배치되고, 주요 행동을 가리는 겹침은 관찰하지 못했다. |
| 작업문 전체 보기 클릭 후 | evidence/environment_check/08.jpg | evidence/environment_check/09.jpg | 1280px는 전체 문맥 입력란으로 이동. 390px로 크기 변경한 같은 스크롤 위치에서는 앞쪽 내용이 보여 전체 입력란 가독성 판정은 보류한다. |
| 지난 요청과 결과 | evidence/environment_check/11.jpg | evidence/environment_check/10.jpg | 기록 카드와 현재 작업으로 버튼에 심각한 겹침을 관찰하지 못했다. |

390px의 상단 탐색은 가로로 넘치는 항목이 잘린다(06.jpg에서 우측 항목, 10.jpg에서 좌측 항목). 접근성 이름으로 클릭하면 해당 항목이 화면 안으로 이동했다. 이는 영구적인 기능 접근 불가를 증명하지 않는다. 사람이 가로 이동 가능성을 쉽게 발견하는지는 확인하지 않았다. 최상위 3개 개선안과 별개의 좁은 화면 탐색 발견성 후보로 남긴다.

복잡한 다중 영역 캔버스, 긴 기록 목록, 확대 글꼴, 키보드만 사용, 모바일 터치, 백업/휴지통 대화상자의 모든 조합은 이 점검 범위 밖이다.
