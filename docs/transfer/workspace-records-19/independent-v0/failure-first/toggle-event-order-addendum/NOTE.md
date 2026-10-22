# brief-edit native toggle 관측

정확제품9fb83ef5(제품8c46/81d와동일), 정상 summary click만 사용. 앱 handler/상태/style는 변경하지 않았다. 읽기 전용 listener를 기존 앱 document capture 등록 이후 추가하고 같은 details의 on-target toggle에서도 측정했다. 둘 다 native isTrusted=true이다. 시간값은 각 페이지 performance.now/event.timeStamp이며 UTC와 혼동하지 않는다.

- 1280 닫기: click반환 후 open=false, height240. document capture 후411.515625 → target411.515625.
- 1440 닫기: click반환 후 open=false, height343.328125. document capture 후591.515625 → target591.515625.
- 두 폭 모두 false open 속성만 관측한 시점과 실제 toggle handler가 sizeWorkspace 처리한 시점은 다르다. document→target 후 높이는 일치했다. 임의 sleep/CSS 복제 기대값으로 통과시키지 않았고 기존 test03 40% FAIL도 그대로 보존한다. 이 진단은 이벤트 순서 수집 완료(exit0)이지 원본 W19 성공 선언이 아니다.

원본 JSON에 클릭 전후와 두 이벤트의 실제 timestamp, raw DOM geometry/notice/windowY/inlineheight가 있다. 이름입력 안내제거 뒤 stale layout이 다음 행동 없이 남는 현상과는 별개이다.
