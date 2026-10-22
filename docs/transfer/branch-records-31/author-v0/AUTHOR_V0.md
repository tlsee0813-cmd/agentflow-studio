# 31 작성자 v0 — 接힌 부분 기록 입구

정확29 후보 aa0938의 app/CSS/HTML 원문을 Git blob과 대조한 격리 product31-author에서 app/CSS 두 파일만 변경했습니다. 원문은 source-before, 후보는 candidate-v0-source이며 diff는 candidate-v0.patch입니다. 29/30 코드는 수정하지 않았습니다.

기존 span의 문구·집계·존재 조건 그대로 native button으로 바꿨습니다. 접근성 이름에도 보이는 집계와 실제 부모 이름을 포함합니다. 별도 버튼은 카드 진입/정보/접기와 형제이며 기존 하위 기록을 열 뿐입니다. 질문에는 답변 기록이 포함된다는 기존 안내와 소유 기록은 유지했습니다.

신호는 정보 버튼과 같은 다른 소유자 work/records 출발점 종료 조건을 적용한 후 해당 부모 정보 패널을 선택합니다. render/기존 panel memo 복원을 마친 뒤 정확 subtree disclosure를 열고 summary를 focus(preventScroll)한 다음 panel body만 스크롤하고 새 읽기 memo를 기록합니다. 먼저 memo.open만 바꾸지 않습니다. 카메라/좌표/접힘/현재 작업/요청 대상/도메인 자료에는 쓰지 않습니다.

닫기 호출자는 project/epoch/owner/id 한 값이며 Origin/located와 별개입니다. 실제 하위 task/report 읽기와 명시 복귀는 기존 markOrigin을 그대로 사용합니다. 정보 재선택(같은 소유자도 포함), 관계/기록/선택부분 탭, 명시 새 탐색, 프로젝트 reset, 다른 소유자 패널에서 호출자를 지웁니다. 닫기/Escape는 살아 있는 신호→같은 소유자 정보→지도 제목 순으로 focus만 복원합니다. 신호를 다시 만들려고 카메라를 이동하거나 접힘을 풀지 않습니다. 일반 정보 진입의 원래 닫기 동작은 유지합니다.

CSS는 기존 span의 작은 글꼴/줄높이를 유지하면서 button 기본 border/padding/min-height/배경/굵기를 제거합니다. 카드240×180와 기존 제목·접기·정보 위치는 바꾸지 않았습니다. 모든 신호가 동시에 있을 때 실제 가림/저배율 hit와 키보드는 Cloud에서 반증해야 하며 정적 선언만으로 가독성 성공을 주장하지 않습니다.

Node24 보조 type/build/diff 모두0, 원 stdout/stderr/exit 보존(기존 build DEP0190 경고 포함). 단위/서버/브라우저/설치/원격 쓰기는 수행하지 않았습니다. 독립 검토와 제품 수용은 별도입니다. 준비 중 광범위 checkout 지연을 중단하고 정확 로컬 소스 blob만 쓰는 방식으로 바꿨으며 실패/부분준비 파일은 삭제하지 않았습니다(BASELINE의 한계).
