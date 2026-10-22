# 33 결합 후보 reader 배치 독립 확인

정확 runtime은 `843ca3993615824452bfc80a6c0c4c65d35df376` / tree `513f3fc42c5a6c189eda3a0e485ae0c7dfebd969`다. app `a104d3dc3210f841ac4275e8095b5a597a4d41e0d29809da338f672637bf6a09`/280577B, CSS `8e4c3847129348deffadbdd7e317a8af76f603b8b2b7020241508a25f8ff1084`/74857B, PC12 `9ca1026516a3b5e897b88e49d5505b677b107a026f5a2c930df433de239bd580`/60650B를 직접 대조했다. **REPORT16 고정 회귀·PC12 지정 검사·guard·짧은 UI 변경 구간은 통과했다. T2 1280의 별도 초안 최초 노출 한계는 남는다. 모든 reader 첫 화면 성공이나 제품 수용을 주장하지 않는다.**

최종 PR18 head `bfa6591fab4b04727f25de721a41f755a88b3205`도 직접 fetch해 app subtree가 runtime과 정확히 `adf88ae1d90bace46485175c531a46ab846a74d0`로 같음을 확인했다. runtime 재시작/재시험은 하지 않았다. 문서 head와 실제 실행 source를 구분한다. source overlay/제품 수정/검사 단언 변경은 없다.

|별도 실행|실제 child / 외부 수집 종료|결과|
|---|---|---|
|Node22 typecheck / root build / continuity build|각0 / 외부0|정확 source 빌드|
|exact REPORT16 test01 ×1280/1440|0 / 0|2개 통과|
|exact PC12 test02/11/12 ×1280/1440|0 / 0|6개 통과|
|기존 동결 controlled-delay 수집 / 의미 judge|각0 / 외부 각각0|같은 work 양성 및 history→work 이탈 guard 유지|
|T2 정상 UI 짧은 변경 구간 controller|0 / 0|양PC 완료, 수신 전 선택에서 정지|
|추가 A/B buffer 중첩 별도 수집 / 의미 judge|각0 / 외부 각각0|1280 한 장면, 정확 B 명시 수신까지 통과|

**REPORT16 첫 화면:** 원메서드·원단언을 그대로 실행했다. F10 action 원단언 직전에 읽기 전용 PNG/rect/모든 overflow 조상 clip/중앙 hit/글자 Range를 수집했다. 그 시점 두 PC 모두 windowY0, notice hidden이며 스크롤·fit으로 구제하지 않았다. 현재 구상·선택 보고의 실제 문장, 기존 ‘작성 중인 요청 열기’와 별도 초안의 대상, 새 ‘이 작업 이어서 하기’와 현재/읽는 작업번호·정확 소유부분이 함께 보였다. 고정 장면에서 행동/대상/새 이어가기 겹침은 보이지 않았다.

|viewport|기존 초안 행동 y|기존 초안 대상 y|새 이어가기 y|새 이어갈 대상 y|
|---|---|---|---|---|
|1280×720|595.78125–640.78125|646.78125–691.15625|290.71875–333.71875|301.125–323.3125|
|1440×900|573.59375–618.59375|624.59375–668.96875|290.71875–333.71875|301.125–323.3125|

위 대상/행동은 clip 안·중앙 hit=true였다. 673의 action718.15625–763.15625 실패 및 원729574.171875–619.171875 통과는 `8ac357a4b77bab9eb70a7f9852c568aff84f898a`를 출처로 재사용하며 재실행하지 않았다. 글자 표본 중 요청 제목의 font Range는 자기 overflow line box 위로1px·아래로약0.36px 벗어났다. 실제 글자 잉크 잘림/사람 가독성 실패로 확정하지 않으며, 모든 글자 FULL이라고 확대하지 않는다. 실제 행동/대상 문구 표본과 원시 음성도 함께 남겼다. exact REPORT16 원본의 후반 원문 읽기 helper는 기존 프로그램 스크롤을 포함하며, 그 부분을 독립 native 읽기 검증으로 부르지 않는다. 첫 화면 측정에는 추가 스크롤이 없다.

**T2 정상 UI 변경 구간:** 같은 공개 T2를 정상 파일 선택으로 가져와 부모 기록→오류행 작업02를 읽었다. current04/별도 초안 및 저장자료는 읽기와 details 조작 동안 동일했다. 양PC에서 처음 접힌 ‘이어갈 대상 확인’을 정상 클릭해 초점을 얻은 뒤 Enter닫기→Space열기→Enter닫기를 수행했다. summary open값은 true/false/true/false, 전체 가로 extent0, 열린 안내와 버튼은 clip 안이며 저장자료가 바뀌지 않았다. 명시 이어가기→N 이동 행동→N만 직접 수정→실제 파일용 복사→실제 H template의 합성 보고 파일 선택까지 확인했다. U/S/C·다른 작업·기존 H·source·구상·관계·기준·별도 초안 종류/본문/대상을 보존했다. 구역 이동만으로 H를 만들지 않았고 실제 복사에서만 H가 하나 추가됐다. 선택 후 ‘아직 가져오지 않았습니다’/정확 오류행 요청/당시 시점/앱 미검증을 확인하고 저장자료가 선택 전과 같았다. 이번 짧은 흐름에서는 명시 가져오기/전체 복귀를 반복하지 않았다. 기존 정상 전체 인계·수신·복귀는 8ac의 원자료이며, 최종 source 실행인 것처럼 합산하지 않는다. 현재 source의 수신/원점 보호는 별도 지정 exact 검사 도달 범위와 구분한다.

**남은 T2 조건:** 가져오기 안내가 남은1280 첫 reader는 y0에서 새 이어가기379.90625–422.90625와 실제 대상390.3125–412.5는 보이지만 별도 초안 행동760.515625–805.515625·대상811.515625–855.890625는 화면 밖/hit=false다. 같은 y의1440에서는 두 항목도 화면 안이다. 기본 첫 화면을 스크롤로 수리하지 않았다. 8ac의 동일 ‘안내 유지’ 원729 raw는 viewport-positive control만 담아 초안 행동 bbox가 없으므로 직접 정량 delta는 미확정이다. 같은 원729의32 관측 중 안내가 없는 다른 준비 화면은 초안 행동649.71875–694.71875, 대상 글자 Range702.71875–719.71875였다. 이를 동일 조건 비교로 섞지 않는다. `OLD_T2_COMPARISON.json`에 출처/원해시/표본을 남겼다. REPORT16 고정 장면 회귀 복구와 긴 안내/내용 조건 한계는 별개다.

**guard 재확인:** 앞선 동결 controller/judge 및 명령 바이트를 그대로 두고 source·출력 binding만 바꿨다. 같은 화면 완료는 정상 reveal됐고, history→work 왕복 후 완료는 y0/nav-work를 유지하며 review 선택을 보존했다. 0e11/673 민감도는 `4de6d430c48179d669fb96d7ef9a91c7583499cd`의 원실패와 분리해 재사용한다.

**추가 실제 A/B 중첩(1280 별도 context):** 새 정상 UI 복사에서 실제 H `H_7048e911-fb90-426d-9289-fc0606fe7b5c`, parent `T_1ae272d0-ce1b-4680-a5dd-e1e526f4e7bf`를 만들었다. 같은 H의 다른 합성 보고 A/B를 정상 file chooser로 A대기→B대기 선택했다. 두 File.arrayBuffer의 실제 buffer 반환 완료만 검사 gate로 보류하고 A부터 해제했다. A 해제 전후 y3983/select-result-file 초점/읽는 중 문구/preview none가 동일했으며 B는 계속 대기했다. B 해제 후에만 y4230/review heading 초점으로 자동 reveal됐고 정확 B 원문·H·parent preview가 나왔다. 선택 단계에는 저장 변화가 없었다. 정상 휠 후 명시 B 가져오기에서 B 원문 UTF-8 문자열과 resultFile.rawText가 완전히 같았고, 보고1개만 추가·current는 새 보고·A는 저장되지 않음·기존 모든 task/source prefix/space/bases/draft 보존을 확인했다. 이 코드는 기존 checker 수정이 아닌 `overlap/` 별도 관측이다. 자연 파일 지연·OS 파일 I/O 성능 시험으로 부르지 않는다. 다른 중첩 순열로 확대하지 않았다.

기존 Node22.16.0 / TS5.8.3 / PW1.57.0 / 실제 system Chromium154.0.8037.57 / loopback MOCK를 사용했다. 실행 HTTP body↔disk와 source 전후 hash가 일치하며 pageerror/paid AI0이다. server -15는 의도적 수집 종료이고 child/collector exit와 별도다. CI143/실제 OS IME/모바일/사람 의미 이해/실제 AI·개발·수락/전체 회귀는 미실행이다. 가시성은 bbox·축별 조상 clip·표본 hit·font Range와 실제 PNG를 구분하며 전체 문장 잉크나 의미 이해를 기계 판정하지 않는다.

코드/UTC 판단 원문/실제 H 작업문/합성 파일/원시 로그·source binding을 제공한다. 큰 raw는 무손실 gzip·원해시·압축해시·해제 검산으로 묶고 중복 DOM dump는 actions 원본과 index로 참조한다. `MANIFEST.tsv`는 자기 자신 제외 정확 payload 집합이다. outer receipt는 실제 tool 반환값 전사이며 전체 tool 원문이 아니다. 원673 실패와 guard 비교 증거는 덮거나 삭제하지 않았다.
