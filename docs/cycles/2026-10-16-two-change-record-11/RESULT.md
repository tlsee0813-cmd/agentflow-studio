# cycle11 — 같은 화면에 두 입력, PC 흐름 검증

2026-10-16 판단 기록. 최신 진행은 [ACTIVE](../ACTIVE.md).

## 총괄 판정

**이 두 표본의 공통 화면·PC 흐름 검증을 마치고 연구 범위를 정리한다.** 중요한 추가 기능 결함은 확인하지 못했다. 좋은 부분은 첫 제품 연결 후보로 채택하되 제품 적용 완료로 승격하지 않는다. 사례마다 다시 만들던 화면을 동일 index/engine/style과 두 JSON 입력으로 바꾸었다. PC를 주 환경으로 전체 부분 지도→한 부분의 짧은 설명/기록된 변화→필요한 근거→명시적 다음 요청→지도 복귀를 비교했다. 임의 AI 기록 자동 해석이나 전체 제품 완성의 검증은 아니다.

두 표본은 작은 공통 입력 구조로 표현할 수 있었다. FLOW091은 5보기 역할·11부분·6조건 관계와 C32 정책 변화, PowerToys는 편집기 내부 두 동작 수정과 외부 공통 훅의 지원 변경이다. 한 요구의 연쇄 영향이나 두 동작 사이 인과를 만들지 않았다. [입력과 근거](INPUT.md) · [선택 이유/완료선](DECISION.md).

## 실제로 바뀐 것과 발견한 결함

이전 cycle10에 묶여 있던 사례명·부분/관계 ID·변경 설명·근거를 fixture로 옮겼다. 엔진/CSS에 사례별 업무 분기가 없음을 감사했다. 포함(parent)과 관계는 별도이며 두 층까지만 지원한다. 중복 ID/없는 부모·끝점/순환/3층 오류는 명시 거절한다. 재명명·변경 없는 임시 입력은 좁은 구조 검사이며 세 번째 실제 사례가 아니다. 모든 필드 타입을 검증하는 범용 JSON 엔진도 아니다.

작성자 첫 실행에서 변경이 없는 입력에도 ‘달라진 점’ 안내가 남는 결함을 고쳤다. textarea를 DOM Text Range로 읽던 검사기 오류와 구분했다. 그 뒤 작성자 검사가 통과했지만 독립 코드 감사에서 열린 미리보기의 재편집 누락을 찾았다. 총괄 실제 PC에서도 미리보기 E1·입력/복사 E2를 재현했다. fix1은 열린 미리보기를 현재 입력과 함께 갱신하는 한 줄 수정이며 원본 실패·같은 검사 수정 전/후·최종 실제 확인을 남겼다. [v0 감사](AUTHOR_AUDIT.md) · [fix1 감사](FIX1_AUDIT.md).

## 경험에 대한 판단

- 채택: 같은 화면의 입력 교체, 부분 역할/기록된 변화의 짧은 기본 설명, 필요할 때 여는 근거, 외부 지원부와 내부 세부 구별, 명시적 다음 요청과 보기 복귀.
- 조건부 유지: 연구용 층위와 접힌 관계 집계. 구조/입력 의미는 유효하나 임의 깊이·큰 지도·사람 이해를 입증한 것은 아니다.
- 제품 기본에 이식하지 않을 것: 긴 자료 경계 헤더, 연구 식별자와 검사 수, 기본 화면의 원문 나열, 과거 수정의 자동 재지시. 상세 340px 열의 긴 조건 읽기는 여전히 부담이 될 수 있다.
- 모바일은 최소 접근 확인이다. PC1280/1440을 기준으로 판단하며390 결과를 동등한 사용성 검증으로 부르지 않는다.

Astra의 두 입력 의미 감사·6장 PNG·역할4가지 사전평가와 총괄 실제 IAB 확인을 구분했다. 전체에 돌아온 사람의 이해·판단 시간을 직접 측정하지 않았다. Grafana/Cytoscape 실제 PC 관찰은 [별도 기록](DEMO_OBSERVATION.md), Pro의 메커니즘 제안과 고정 원문 대조는 [MECHANISM_AUDIT](MECHANISM_AUDIT.md)다. 라이브러리의 펼침/닫힘을 우리 지도 전체 상태 복원 보장으로 가져오지 않았다.

## 실행·증거

[독립 원본 60파일](https://github.com/tlsee0813-cmd/agentflow-studio/tree/519a57c00062c142548b0a1d9a270949aacf3bd4/docs/transfer/shared-map-11/independent-v0)과 [독립 감사](INDEPENDENT_AUDIT.md)를 함께 읽는다. 고정 계획20/20은 PC 본경로4+사례 왕복2+별도 P2회귀4+정적 파생 시험 입력8+390 최소 확인2다. 세 번째 실제 사례나20명의 사용성 성공이 아니다. main-run02의16장면·223 PASS(정적 묶음 포함)와 별도 P2의4경로·56 PASS를 단일 실행 수치로 합산하지 않는다. 실제 main child/collector0, P2 child0과 외부 도구 관측 collector0을 구분했다.

같은 독립 P2 검사로 원v0 네 경로의 불일치/child1과 fix1 네 경로의 일치/child0을 확인했다. 본검사에서는 사례·대상별 서로 다른 초안, 열린 근거의 실제 href, 닫힌 근거 DOM 제거/호출 초점, 130%에서 초안 닫기 직후 보조 이동 전 지도 선택·깊이·좌표/선·스크롤을 확인했다. raw 좌표/선 delta는0이다. FLOW 휠은1280 (0,0)→(120,100),1440 (0,0)→(75,0); PowerToys는 이동 여지0이어서 비초기 지도 스크롤 복귀를 검증한 것으로 세지 않는다.

**이번 복귀는 초안 창을 닫아 그 아래 지도로 돌아오는 동작이다.** 별도 집중 화면/전체복귀 버튼이나 실제 제품 work 화면을 거친 복귀와 같지 않다. 초기 전체 글자 전수 가시성·최초 선택 전후 기하 변화는 이번 독립 main의 자동 단언 범위가 아니다. 초안 중 사례 전환은 모달에서 차단되어 우회하지 않았다. 열린 근거에서 사례 전환과 닫은 뒤 초안 왕복은 별도 확인했다.

최초 독립 P2 선택자 오류와 main-run01의 휠 원점 선행조건2실패는 검사 이력으로 보존했다. 실제 음의 휠로 장면을 보완한 run02를 최종 기준으로 삼았고 시안 원본은 변경하지 않았다. 48 HTTP 관측은 시험 페이지/입력 포함이며 각 runtime 응답/전후 해시와 귀속을 확인했다. 주요 console/pageerror/fatal/cleanup 오류0, 실제 로그의 favicon404 한 건은 별도다. 검사기의404 제외 규칙이 favicon URL보다 넓다는 한계를 남기며 임의404 차단을 보장하지 않는다. 종료 도구 요약은 전사본이며 서명된 외부 원문이라고 부르지 않는다.

대표 화면: [PC1280 FLOW](https://github.com/tlsee0813-cmd/agentflow-studio/blob/519a57c00062c142548b0a1d9a270949aacf3bd4/docs/transfer/shared-map-11/independent-v0/PC1280-flow091-whole.png) · [PC1280 PowerToys](https://github.com/tlsee0813-cmd/agentflow-studio/blob/519a57c00062c142548b0a1d9a270949aacf3bd4/docs/transfer/shared-map-11/independent-v0/PC1280-powertoys-whole.png) · [PC1440 선택 근거](https://github.com/tlsee0813-cmd/agentflow-studio/blob/519a57c00062c142548b0a1d9a270949aacf3bd4/docs/transfer/shared-map-11/independent-v0/PC1440-selected-evidence.png) · [PC1280 작성 초안](https://github.com/tlsee0813-cmd/agentflow-studio/blob/519a57c00062c142548b0a1d9a270949aacf3bd4/docs/transfer/shared-map-11/independent-v0/PC1280-PT-draft-E.png).

작성자 최종 v0 r05는 PC1280 162(클릭전제53),PC1440 163(54),임시27(14),390 24(10),정적1의 별도 실행이다. fix1 f01은 같은 회귀 검사로 v0 양폭 각각52 중6실패/child1,fix1 각각52/0실패/child0이며 수집기0이다. 52 중30은 클릭 전제다. 독립 결과나 사람 과제 수와 합산하지 않는다.

공유 소스는 [v0 116파일](https://github.com/tlsee0813-cmd/agentflow-studio/tree/6643323316daefbe10625484bb1727a2c6a54716/docs/transfer/shared-map-11/author-v0) + [fix1 overlay22파일](https://github.com/tlsee0813-cmd/agentflow-studio/tree/c4354dccc6f693bf33d5157e7e8da566d152d9a1/docs/transfer/shared-map-11/author-fix1)이다. app/engine.js만 바꾸며 나머지4파일은 v0 바이트 그대로다. 원본/실패/raw/PNG/manifest는 GitHub에서 직접 회수할 수 있고 로컬 ZIP 경로에 의존하지 않는다.

| runtime | bytes | SHA256 |
|---|---:|---|
| index.html |2769|a6c9d0a0ee764ea1435f989b02b414d61129fb75e6ea56663d83a275b153cb07|
| engine.js fix1 |34004|d3699ac75671b000cb4561ae137073aa73a18c74fefe6fbaa0bd3489c438ff8f|
| style.css |11662|704369c9524bd2b66be07f150c18f14881d205c8f92c65a98e68356080dac929|
| fixtures/flow091.json |19224|5b4269c6b4956ef00856a08a2eadf3149a6ed1d9c582eee204b7bc0691d43c4b|
| fixtures/powertoys.json |13494|c583dad774d756b959f84a9e62081b81eb87924750730162026c205240346aff|

## 종료와 제품 연결

[첫 제품 연결 범위](PRODUCT_INTEGRATION.md)에 공통 흐름·보류 표현/위험·실제 제품 재사용·한 번에 체험할 최소 범위와 완료선을 정리했다. 기존 영역을 읽고, 사용자가 고른 Task의 맥락/원문을 보고, 명시적으로 기존 manual 편집을 이어간 뒤 출발 지도 보기로 돌아오는 연결이다. 보는 대상·이어갈 작업·작성 대상과 Task별 수동값은 분리한다. 지도 복귀가 새 작업 선택/수정을 되돌리면 실패다.

현재 제품의 평면 데이터 경계를 그대로 쓰는 첫 연결이며 평면 지도를 최종 모델로 확정하지 않는다. 혼합 깊이 목표를 포기하지 않고, 연구 엔진·자유문 저장 형식을 한꺼번에 제품에 이식하지 않는다. 더 많은 유사 시안을 자동 다음 단계로 삼지 않는다.

제품 기준 USE106 618d9bd…,GUIDE107 HOLD를 유지했다. 2026-10-16 11:18 KST main `896dcf3848fec70357d0f9bd4fd6c09cab70db37`와 gh-pages `63f5540d062861439f0932cd7311c6c5510e227c` 불변을 확인했다. 실제 제품 반영·공개 배포·AI 송신/수락·사람 사용성은 이번 완료 범위가 아니다.
