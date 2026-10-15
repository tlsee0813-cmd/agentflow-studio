# run-01 — 첫 실행 (보존)
child exit 1, FAIL 4. 앱 결함이 아니라 **검사 코드 결함**: 복귀 초점 단언이 활성 요소 id를 'C32'로 기대했으나 STATE_JS는 `ae.id`(=`n-C32`)를 먼저 반환. 같은 기록의 post.active는 두 크기 모두 `n-C32`(선택 카드)였다.
수정: run-02에서 기대값을 'n-C32'로 바꿈. HTML은 바꾸지 않음(snapshot SHA 동일).
또 이 실행에서 준비문 영역은 두 크기 모두 scrollable=false여서 ‘실제 휠로 하단 도달’ 이름이 과장이었다. run-02에서 이름을 사실대로 바꿈.
