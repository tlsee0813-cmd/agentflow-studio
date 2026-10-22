# 30 · 작업에서 지도 복귀 — checkpoint 한정 통합
2026-10-23 KST. 현재 상태는 [ACTIVE](../ACTIVE.md).

## 달라지는 동작
작업 화면을 깊게 읽고 전체 공간으로 돌아오면, 복원된 페이지 위치에서 남은 높이를 계산한다. 사용자가 맞춘 카메라·부분 접힘을 유지하며 기존 화면 밖 안내만 최종 가용 범위에 맞게 갱신한다. 매번 지도 맞춤을 실행하지 않는다.

최종후보e5a5bf40(제품28fd10b4와 동일)의 app e52eb74e는 render의 마지막 크기 계산 전에 페이지 복귀를 반영하도록 순서를 바꾸고, openSpace가 끝난 뒤 기존 markOffscreen을 다시 계산한다. 다른 render 호출의 순서와 명시 origin 복귀는 유지했다. 저장 형식·의존성 변경은 없다.

## 실제 실패와 개선
[독립 원자료·대표 화면](https://github.com/tlsee0813-cmd/agentflow-studio/tree/b3b66d8a20714f60ee23b1e384b30de42c0351ba/docs/transfer/viewport-return-30/independent-a/fix1).

| 장면 |1280×720 지도 top / height / bottom|1440×900 지도 top / height / bottom|
|---|---|---|
|기준29 aa0938, 작업wheel1200 후 복귀|268.89 /704 /972.89|268.89 /884 /1152.89|
|후보30, 작업scroll0 후 복귀|268.89 /435.11 /704|268.89 /615.11 /884|
|후보30, 작업wheel1200 후 복귀|268.89 /435.11 /704|268.89 /615.11 /884|

기준29 양PC는 원 높이 단언에서 실패해 child/collector1, 후보0/1200 네 장면은0이었다. 진입 직후와 두 native frame을 나눴으며 중간 fit/resize/추가 저장대기로 고치지 않았다. [이전27 PhaseA](https://github.com/tlsee0813-cmd/agentflow-studio/tree/38921a1e06cdb346d535265097aa2cef2d3d8239/docs/transfer/viewport-return-30/independent-a/phase-a)는 별도 관측이다. 그 단계에서 실제resize가 복구하고 맞춤만으로 높이는 고쳐지지 않았던 결과를 새 실행 수에 더하지 않는다.

기준·후보 모두 기존 작은 카메라에서 정보 버튼6/6의 clip/hit은 참이었다. 후보에서는 **각 장면 대표 한 개**만 정상 클릭해 패널을 열었다. Cloud 원보고의 ‘6/6 clip/hit/정상click’은 여섯 개 모두 클릭으로 확대하면 안 된다. 이번 개선은 지도 컨테이너의 화면 초과를 고친 것이며 기존 여섯 카드가 접근 불능이었다는 결론이 아니다.

총괄은1280 기준·후보의 복귀 직후 PNG 두 장을 직접 대조했다. 지도 하단은 복구됐지만 작은 글자·제목 잘림이 해결됐다고 하지 않는다. 첫 진입 대표 PNG 누락을 채운 양PC deep 재실행은 별도 재확인이며 새 네 장면으로 합산하지 않는다.

## 추가 관측과 범위
실제 확대·빈 배경 pan·가지 접힘·P 선택을 준비한 양PC에서 복귀 후 camera/선택/접힘/패널 읽기를 유지하고, 화면 밖 실제 rect 분류와 표시가 일치했다(1280 1개,1440 4개). 받은 JSON 원문 값과 입력 return.2가 일치하고 닫힌 textarea가 실제 숨겨졌다. 내부 textarea 꼬리 스크롤 보존 전체는 확인하지 않았다.

비영점 공간 pageY120을 실제 wheel로 만들고 영역을 읽은 뒤 복귀하자 보정 전120으로 돌아오고 지도 bottom704/884가 유지됐다. 최종 maxScroll이120보다 커서 실제 clamp는 발생하지 않았다. 모든 clamp/레이아웃 순열을 통과했다고 하지 않는다. 명시 fit은 최초 관측 뒤 별도로 실행하여 자동 카메라 보존과 구분했다.

정상 새 목적·첫 요청의 loopback MOCK을 통해 영역0개 상태에서 깊은 작업→첫 지도 진입도 확인했다. 진입 전 camera 없음, 최종 높이에서 초기 camera 생성, 목적·작업·초안 보존이었다. 비어 있지 않은 복구 입력은 이미 import-fit이 있어 이 최초 분기와 다르다. 저장된 camera를 삭제해 반례를 만들지 않았다.

## 오류·검증 근거
extras 첫 loader 문자열 분리 오류는 브라우저 시작 전 SyntaxError/exit1이었다. 정정 후1280 두 장면 완료,1440의 고정 pan 지점이 카드여서 mousedown 전에 guard 중단/exit1했다. 빈 배경의 실제 hit를 찾는 준비만 보완해 남은1440 두 장면을 완료했다. 단일 무오류 실행으로 합치지 않는다.

Cloud typecheck/root build/continuity build0, Node22.16/TS5.8.3/PW1.57/실제Chrome154.0.8037.57. 정적HTTP응답195개의 body/disk 중·후 바이트와 실제 MOCK API2개를 기록했다. 원 프로젝트의 읽기·지도 이동 전후 불변과 별도 새 요청 생성 전후 범위를 나눴다. pageerror/consoleerror/cleanup0이며 서버−15는 명시 종료다. 패키지 새 설치·유료AI는 없었다. 원자료111+manifest1,112파일/1,239,747바이트의 집합·크기를 총괄이 원격 tree와 대조했다.

작성자 회귀는2PC×zero/deep 네 개다. 독립 정적 리뷰에서 처음 숨겨진 홈의 파일 선택을 누르는 준비 누락을 찾아 정상 홈 이동을 넣었다. 최초 측정과 후속 frame을 별도로 검사하며 원 높이 단언을 완화하지 않는다. 그 보완은 실제 제품 실패와 구분한다.

[정확 새 회귀 대조](https://github.com/tlsee0813-cmd/agentflow-studio/tree/a883b3f1a9de79dd3c920ebb733b4468f1e07b0a/docs/transfer/viewport-return-30/independent-a/regression-final): 동일 검사43798ea3·입력c50eb43a를 원본29에 검사만 overlay하여 실행했다. 원본0 출발2개는 통과, 깊은 출발2개는 실패(child/collector1); 후보 네 개는 모두 통과(0)했다. 새 검사 표본의 지도 top224.89, 원본 deep bottom928.89/1108.89는 후속 두 frame에도 남았고 후보 bottom704/884였다. 앞 독립 표본의 top268.89와 다른 준비 장면이며 수치를 섞지 않는다. 원본 실패 장면은 최종 저장 동등 단언 전 중단했고, 후보는 끝까지 완료했다. 197추출파일 전후 불변, 양쪽HTTP12개씩 body와 실행 파일 일치,50파일/1,017,778바이트를 원격 확인했다. 별도 Astra가 원문·계측·최초/후속 실패를 대조했고 단언 완화나 사후 화면 보정은 없었다. 원 PNG8장은 teardown 최종 장면이며 최초 동기 화면으로 부르지 않는다.

[최종 CI39856945223](https://github.com/tlsee0813-cmd/agentflow-studio/tree/cea66d493487bc639526910875a26c60dd2a2506/docs/transfer/viewport-return-30/ci-e5a5bf): 정확e5a5bf40 Ubuntu/Windows 모두 success. 각각 단위275개,25브라우저 묶음242개와 신규30 네 개가 완료됐다. 잘린 원 tail/환경 차이와 경고를 공개 기록했다. CI 공유5파일의 원격 blob·bytes가 기대값과 일치한다.

## 판단 경계와 다음 흐름
[PR17](https://github.com/tlsee0813-cmd/agentflow-studio/pull/17)을 checkpoint에 한정 통합했다. 최종e5a5bf40→병합425c3df4, 후보/병합 app subtree6db097a3b83632264cf25e1793595d7910c1b644가 동일하다. main·gh-pages는 바꾸지 않았다.30은 지도 복귀 가용 크기,31은 기록 입구를 다룬다.32에서는 선택한 통합본으로 현재 내용·받은 보고·남은 판단을 구분하고 한 작업을 이어가는 전체 흐름을 관측한다. 새로움 baseline이나 자동 완료 판정은 도입하지 않는다.
