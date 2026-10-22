# 작업문 참고29 — 명시 재열기 fix4

총괄이 확인한 신규 검사03 반례는 같은 긴 설명을 명시 닫기/재열기해도 body가150에 남는 것입니다. 이 수치는 총괄/검사 담당의 원자료 전달 근거이며 작성자가 raw를 직접 회수한 것으로 주장하지 않습니다. source는 새 pin의 reading.y만0으로 만들고 같은 실제 body DOM을 재사용해 scrollTop은 그대로였습니다.

fix3 CSS는 보존하고 명시 summary 닫힘→열림 클릭 한 곳만 고쳤습니다. 이 분기에서 기본 열기를 취소하고 ref.open=true로 열린 상태를 동기 확정한 뒤, 새 pin/본문을 만들고 실제 body.scrollTop=0으로 시작합니다. 닫기는 기존 native 동작과 pin 제거를 유지합니다. 실제 열기 이후이므로 닫힌 영역에 scrollTop을 대입해 무시되는 결과나 늦은 toggle로 초기화하는 별도 경로를 만들지 않습니다. 첫 열기·명시 재열기 모두0이며 이전 원문 details도 새 본문이므로 기본닫힘입니다.

같은 pin의 render/수신에서는 이 click 분기를 실행하지 않고 기존 capture→fill→restore를 유지합니다. 직접 U 입력의 DOM/초점/선택 갱신, 프로젝트/작업/소유자 변경의 reset, 페이지 scroll/카메라/인계 정책은 변경하지 않았습니다. 늦은 body scroll/toggle capture는 현재 새 pin의 실제 열린 DOM을 읽습니다. native ref toggle 자체는 body 자손 이벤트가 아니어서 token을 새로 만들지 않습니다. 실제 브라우저의 이벤트 순서/동일 pin 위치 보존은 Cloud 판정 범위입니다.

Node24 보조 type/build/diff 모두0, 기존 DEP0190 경고는 보존했습니다. CSS는 fix3 SHA와 동일, 원 v0/fix1/fix2/fix3 snapshot/patch는 보존했습니다. 단위/서버/브라우저/원격 쓰기는 미실행입니다. 기존971 검사는 수정하지 않았습니다.
