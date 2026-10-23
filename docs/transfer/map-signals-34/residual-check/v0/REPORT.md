# 34 잔여 가림 독립 확인: HOLD 근거 재현

1280×720, Chromium154.0.8037.57 / Playwright1.57.0 / Node22.16.0에서 두 장면만 기준575bb745와 후보e059ec6d를 비교했다. 부모 자기 현재작업·이번 탭 설명 갱신·두 줄 이름·6사실 조건이다. 후보 파일의 공개 domain API fixture를 두 renderer에 동일 방식으로 가져오고 B/P 합성 결과를 실제 보이는 파일선택 버튼/가져오기로 수신했다. 정상 전체맞춤 이후 측정했다. 직접 Project/DOM 변경은 없다. 입력과 실제 행동은 check.py 및 scene JSON에 고정했다. 작성자와 같은 recipe를 참고한 독립 실행이며 맹검이 아니다.

|1280 장면|기준 기존 수줄|기준 표지 가림|후보 기존 수줄 가림|
|---|---|---|---|
|구상 미기재|말줄임, 세로 노출|설명갱신·현재작업 표지 전부|line box12.5px, ink10.5px: 글자 잉크 전부|
|구상 있음|말줄임, 세로 노출|설명갱신 ink9.3px 일부·현재작업 전부|line box4px, ink2px 일부|

수치는 지도 scale0.556452를 나눈 카드 layout px다. 잉크 수치는 작성자 canvas font metrics 계산과 별도로 실제 카드 PNG·텍스트 Range·모든 overflow 조상 client clip을 대조했다. 스크린샷은 해당 실제 카드의 DPR2 원 캡처이며 글자가 없는 수줄/일부 글자 가림이 보인다. canvas 수치를 직접 픽셀 잉크 분할 측정으로 부르지 않는다. 상세 원시값은 raw.json.gz, 독립 전체조상/Range 요약은 SUMMARY.json. baseline은 표지 가림, 후보는 기존 수줄 가림이라는 차이를 유지한다. 새 기록 사실 줄은 이 두 장면에서 보였다. 카드 높이180px.

후보 구상 미기재의 required 기존 수줄 가림을 독립 재현했으므로 HOLD 근거로 충분하다. 1440·다섯 장면 전체 A/B·전체회귀는 진행하지 않았다. 폰트를 새로 설치하지 않았다. computed font와 Linux/Fontconfig/OpenAI Sans fallback 조회는 raw/environment.txt에 보존했다. 작성자141/Noto·Inter와 실행환경이 달라도 동일 잔여 수치를 얻었다.

실행 수집 child0/외부collector0, pageerror 없음. 제품 source remote↔disk 종료후 byte동일, 실제 HTTP200 body↔실행disk↔종료후disk hash동일. UI 서버 -15는 수집 후 의도적 종료다. 별도 가시성 반증 gate는 실제child1/collector1로 보존했다. 이는 수집기 실패가 아니라 의도한 제품 가림 실패다.

준비 오류 원본도 남겼다: 최초 exec는 생성 전 cwd로 프로세스 미착수; root build만 수행해 continuity dist가 없던 첫 child1; 숨은 file input 클릭으로 두번째 child1. continuity 정상build 후 보이는 #select-result-file을 클릭하도록 준비 선택자만 고쳤다. 제품/가림 판정 조건은 불변이다. 임의 sleep/force/DOM scroll 수리는 없다. 공개 helper의 저장완료 polling은 기존대로 사용했다.

MANIFEST는 자신 제외 payload 정확 집합이며 gzip 원bytes/SHA/해제동일성을 RAW_HASH에 기록했다. source/build/node_modules 전체는 게시하지 않는다.
