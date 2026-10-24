# 시각42 caf 독립 최종 검증

**caf에서 pan 중단이 해소됐고 관련 원본 suite34개가 모두 통과했다.** 정확 source `caf6126a4a2e592dc4f17626f0440d13a1d4c188`, app tree `9ba47af6a58cf97d717e743a862553ea2cf1053d`에서 빌드·실행했다. checkout은 이동하지 않았고 제품 코드도 수정하지 않았다. root의 문서 dirty/staged PNG 삭제를 그대로 보존했다. 최종 app working/staged diff0을 확인했다.

## 이번 caf 실행

| 검사 | 실제 결과 |
|---|---|
|BRANCH31 원본|10/10,124.607초,exit0|
|AREA17 원본|12/12,110.078초,exit0|
|MAP36 원본|12/12,122.772초,exit0|
|동일 상태 native pan|5회 모두6 pointermove·약(-260,-10) 이동,dragstart0·pointercancel0|
|static1280 대표 왕복|기록한 scroll0·헤더·지도·카메라·선택 정확 복귀,직접 입력/selection7..11/초점·예제 저장0|
|static MAP36 다중 신호|화면 안6카드의 이름6개·‘독립 영역’2개 실제 글자와 모든 소속 줄의 세로 clip 통과|

원본 suite는 caf에 포함된 파일을 수정 없이 정상 HTTP MOCK으로 실행했다. BRANCH31의 page wheel은 caf 원본이 선택한 실제 toolbar 표면에서 비영점 준비를 검사한다. suite와 공통 native helper의 정확 SHA256은 RESULT.json에 기록했다. AREA17 첫 시도는 test 실행 전 Windows cp949가 Node의 UTF-8 fixture를 해독하지 못했으며, PYTHONUTF8=1을 설정해 동일 원본12개를 완료했다. 이를 제품 실패로 세지 않는다.

## pan 수정 전후

정상 예제→시간 선택→이름·구상 편집 열기→미전송 구상 입력→native zoom-in3회 후,매번 elementFromPoint로 실제 빈 #space-map을 확인했다. 각 drag는6단계로(-260,-10) 이동했다. source/fixture/camera 값을 주입하거나 이벤트를 취소하지 않았다.

6cf에서는 x 이동이 첫-260.0003px,후속4회 약-43.333px였다. 첫 drag 뒤 텍스트 Range가 생기고 두 번째부터 native dragstart→pointercancel→lostpointercapture로 끊겼다. caf의 같은 관측은 x=-260.0003/-260/-260/-260.003/-260px,y는 모두 약-10px였다. 매회6 move가 끝까지 전달됐고 native dragstart/cancel은 모두0이다. 미전송 구상 값·예제 localStorage0·pageerror0을 유지했다. 이전 발생 기원이나 baseline 회귀 판정은 별도 연구이며 이 전후 대조로 확대하지 않는다.

## 실제 화면

caf static 홈·시간 선택 지도·작업3PNG를 새로 촬영하고 직접 열어 보았다. 같은 기본 예제와 선택을 사용했다.1280 지도는 y153/h630이고 작업 첫 입력은 y372..580/208px다. 복귀 직후·100ms·400ms가 기록한 출발과 같다.

MAP36의 부모 현재 작업·구상 있음·다중 읽기 신호 fixture를 정상 backup/result 파일 경로로 별도 열고 실제 static PNG도 직접 확인했다. 이름과 짧은 ‘독립 영역’이 세로로 잘리지 않는다. 긴 ‘소속 · 상위 이름’은 기존 한 줄 ellipsis가 적용된다. Range가 그려지지 않는 원문 끝까지 반환하는 가로 overflow와 실제 글자 세로 잘림을 구분했고 원시 관측은 JSON에 남겼다. 카드·소속 신호·열기/접기 행동의 전체 범위는 기존 MAP36 원본12개가 별도로 검사했다.

## 이전 근거와 재사용 범위

6cf의 실제 static58개는 그 SHA의 header/popover·1280/1440 초안/caret/zero/nonzero 복귀 범위에서 통과했다. 미전송 구상 편집을 연 반복 pan은 나중에 별도로 실패를 확인한 상태다. caf에서는 그 실패 상태를 다시 실행해 수정 후 대조했다. header/popover CSS는 바뀌지 않아58개 전체를 반복하지 않았다.

500의38개,43의90개,7a의49개 및 WORK29/WORK41,2ae의 UI0012개·menu8개는 원래 SHA에 묶인 과거 근거다. 이번 caf의 실행 수에 합산하지 않았다. 최종 JSON에 과거 핵심 실패 수치와 각 실행 경계를 함께 보존했다.

## 번들·최소 공유·운영

기존 TypeScript5.8.3으로 normal/static을 재빌드했다. caf의 src/server/index.html Git 객체는6cf와 같고,최종 static runtime20개 중 styles.css만 다르며19개가 동일하다. Cloud ZIP은 Ops `.ops/visual42-finalcaf-preview.zip`,205687bytes,SHA256 `f4d5d4e9c702e94e0372334d59e68bc1e6b14e910c5f93d4769f7c206bd61939`다. 공개 runtime20개+정확source/app tree BUILD·MANIFEST2개만 포함하며 파일별 해시를 재검증했다. 키·실제 프로젝트·JSONL은 포함하지 않았다.

최소 교체 파일은 **static-home-1280.png,static-map-1280.png,static-work-1280.png,RESULT.json,이 보고서,BUNDLE.json**이다. MAP36 PNG는 실제 읽기 근거가 더 필요할 때 한 장만 선택할 수 있다. 수정 전후 pan 수치·원본 suite 해시가 최종 JSON에 있으므로 중간 PNG/fixture/원시 suite 폴더 전체를 복사할 필요는 없다. 이미 공유된6cf 원본은 필요하면 history6cf.json 한 개로 유지할 수 있다.

Windows Chrome155와 기존 Python/Playwright/Node/TypeScript를 재사용했다. 새 설치·dependency 복제·외부 AI 실행은 없다. header/popover 전체 재검사·실제 browser UI zoom·사람 대상 사용성·전체 제품 CI/배포 판정과는 구분한다.

같은 static URL `http://127.0.0.1:60414`는 **이제 caf**이며 PID24656/session89373로 재기동했다. 서버는 총괄 확인용으로 유지한다. 보고 완료 시 build/server 소유권을 총괄에게 반환하고 추가 빌드·checkout을 하지 않는다. 제가 만든 임시 자료는 GitHub 근거 확인 후 정리할 수 있다.
