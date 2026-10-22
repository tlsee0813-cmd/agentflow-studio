# 작업문 옆 부분 설명 읽기29 — 읽기 스크롤 fix2

총괄이 전달한1440 실제 관측은 현재 작업A1·선택 설명을 유지한 채 다른A2의 정확한H 보고를 수신했을 때 설명 자체의 scrollTop275→0,바깥 body0→0이었다. 작성자가 원시 Cloud 파일을 직접 회수한 상태는 아니며 이 숫자는 총괄의 관측 전달값으로 구분한다. 1280의 휠 준비 문제는 별도 검사 경계이며 이 제품 수정의 확정 근거로 섞지 않는다.

정적 코드에는 두 스크롤이 있었다. 일반 `.source-raw`는 max-height360px/overflow:auto이고,새 `.work-reference-body`도 max-height62vh/520px/overflow:auto였다. 기존 기억은 body.y만 저장했다. 따라서 실제로 summary 안에서 읽던 위치를 body0으로 저장해 재렌더 후 잃을 수 있다는 설명과 관측이 맞는다.

두 안을 비교했다. 내부마다 내용·소유 기록·스크롤 수명을 추가로 기억하면 기존 중첩 배치를 유지할 수 있지만 대상 식별·기록 교체·접힘 복원 처리가 늘어난다. 총괄과 독립 검토가 선택한 안은 이 새 참고 컴포넌트 안의 모든 source-raw만 max-height:none/overflow:visible로 바꾸어 기존 body 하나에서 읽는 것이다. 단일 CSS 선언만 바꾸고 페이지나 바깥 body 제한·details·다른 reader는 유지한다. app.ts·핀 선택/초기화·수동 입력 갱신·인계 validity는 변경하지 않는다.

원 v0/fix1은 그대로 보존했다. CSS 고정 원문은 `candidate-fix2-source/styles.css`,v0/fix1과의 실제 한 줄 차이는 `candidate-fix2-only.patch`,전체 기준 차이는 로컬 `candidate-fix2.patch`에 있다. 최종 원문·바이트·SHA256·Git blob은 `RECEIPT_FIX2.json`이다. Node24.19.0 보조 타입·빌드·차이 검사의 원 stdout/stderr/exit는 `type-fix2.*`, `build-fix2.*`, `diff-fix2.*`이며 모두 exit0이다. CSS만 바뀌어 별도 단위 검사는 반복하지 않았다.

재검증은 SUMMARY 위 실제 휠의 스크롤 소유자가 body인지,body의 비영점 읽기 위치와 펼침이 같은pin의 수신 전후 보존되는지 확인해야 한다. 첫U 입력의 입력/본문 DOM·초점·선택도 유지돼야 한다. 명시 닫기·재열기나 프로젝트/작업/소유자/선택 설명 전환에는 이전 위치를 넘기지 않는다. 이 CSS 성공을 실제 UI 수용으로 간주하지 않는다.

남은 범위: `rawFileDetails`의 수신 JSON 원문은 source-raw가 아닌 readonly textarea.export-preview라 이번 CSS 대상 밖이다. 그 textarea 자체 스크롤까지 복원했다고 주장하지 않는다. 서버·브라우저·Cloud·CI·설치·유료 호출·원격 쓰기는 수행하지 않았다. 신규 브라우저 검사 파일도 복사하지 않았다.
