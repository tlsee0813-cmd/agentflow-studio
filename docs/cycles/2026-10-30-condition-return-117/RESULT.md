# 117 실제 후속 조건 참조 — 전체 계약 반려

정상 제품 경로에서 Sol High 한 번은 138.677초 만에 종료0·완전한 JSON 10639byte를 반환했다. 그러나 `matches[5].aboutAt = N02.33`이 조건 길이 계약을 어겨 전체를 반려했다. 전달/시간 초과/JSON 구문 실패가 아니며, 응답 일부를 수선·재검증·적용하거나 다시 호출하지 않았다.

## 실제로 확인한 범위

선택은 [c3a1fc8](SELECTED.md), 제품23aef51/app2ebab212, 116한정수용16e066e와 exact47445f3 양OSCI 뒤에 실행했다. 원115project14와 전체RQ를 정상UI로 가져왔고 hash가 그대로다. 선택RQ0797의 ask는115와 schema만다르며 실제 ask·prompt·wrapper stdin hash가 사전고정과 일치한다. versionprobe1/실제생성1, tool·error event0, stdout절단0이다. [실행 영수증](evidence/receipt.json), [실제 결속](evidence/actual-binding.json), [원 최종응답](evidence/final-message.txt).

실행 직후 원방문을 떠나 다른 프로젝트에109자 초안을 적었다. 반려 안내를 확인하고 새로고침한 뒤 원프로젝트 전체 SHA `dd5b31e0792d71ae5fa1aa625a23a0728e1e6742fee89324140f12f6c60b5e54`, 전체요청 묶음 SHA `cdf2dc70965e8eaf9c6d701dcef39a022d1baab8e0e0fcf047e4941590f8ba05`, 다른초안이 모두 그대로다. 원자료6/기존reading1 유지, 추가reading·자동반영0. 유효 ready가 아니므로 후속명시적용/새지도인용/적용후백업 경로는 도달하지 않았다. [보존 증거](evidence/preservation.json).

![반려 안내와 유지된 원지도](evidence/root-rejected.png)

## 반려 원인과 의미 관찰을 구별

N02.33은 작성자 검사표 한 행이다. 첫 셀에는 commit·Chromium·Playwright·1280×720·HTTP 환경, 다음 셀에는 행동, 마지막 셀에는 결과가 있다. 전체행은 바깥공백 제거후204 UTF-16으로 match조건한도200을4초과한다. 모델이 조건을 고를 수 있는 현anchor단위는 셀보다 넓다. [정확진단과 원문](evidence/diagnosis.json).

응답은 typedcode에 aboutAt:null을 쓰고 Zephyr문서commit은 별도설명으로 남겨115의파일판본/원문조건 혼동을 피했다. 두fullHINK↔GDEH/SSD/ssd16xx/target 대응, trim만/정확일치/미상시비움, LowPower제한, 보고된검사와 실제하드웨어·전체배포미확인의한계도 원응답에서 관찰된다. 이것은 전체의미PASS나 제품사용경험수용이 아니다. 전체계약반려인 상태로 유지한다.

[Sol 독립 검토](evidence/independent-review.json)도 원응답과 입력을 읽어204/200 경계와 위 제한적 의미 관찰을 확인했다. 검토자의 모델 호출·validator 재실행·제품 변경은0이다. 다른 후속검사까지 통과했다고 추정하거나 전체 의미PASS로 세지 않는다. 118 호환 설계는 별도 미완료다.

## 다음 선택의 범위

단순히4자한도를늘리거나실패wire를잘라/null로구제하지않는다. 118의 우선 설계는 기존 원문 anchor가80/200 조건 슬롯에 들어갈 수 있는지를 앱이 계산해 알려 주는 방식이다. 이 사례는 이미 text와 정확한 근거가 검사 환경을 담으므로, 긴 행의 조건을 명시적으로null로 선택하는 기존 계약을 쓸 수 있다. 긴표의조건셀을별도참조가능하게하는안은기존anchor·저장·미처리job호환경계를먼저따져야하며아직구현수용/새실제생성선택이아니다. 근거없는조건을만들거나중요한환경·판본을삭제하는방향은채택하지않는다.

서버51909종료·lease없음·관찰탭닫음. 공개73·미수용74·UI75/693·기존stash·키보존, 병합배포0. 116은기계적계약/합성UI범위수용이며117반려로소급변경하지않는다. 원자료→지도→이해→요청→반환전체경험은아직완료되지않았다.
