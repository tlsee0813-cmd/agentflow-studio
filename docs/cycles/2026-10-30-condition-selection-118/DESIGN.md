# 118 조건 길이 선택 정보 — 총괄 설계

기준: 117 결과 `19a89e097056e1ccb8cc1b2626455933a5f17cee`; 116 구현은 한정 수용, 117 실제 반환은 전체 계약 반려다. N02.33의 검사 조건·행동·결과가 묶인204자 표 행을200자 조건 슬롯으로 선택했다. 그 응답을 고쳐 통과시키지 않는다.

## 선택과 제품 목적

기존 MAP7 원문 anchor를 유지하고, 각 시작 anchor에서80/200 UTF-16 이내로 끝날 수 있는 마지막 anchor를 앱이 결정해 실제 지침에 함께 보낸다. 모델이 원문 글자 수를 직접 세지 않고 합법적인 범위 또는 명시적null을 고르게 한다. null일 때에도 중요한 판본·환경·한계는 진술과 정확한 근거에 남겨야 한다. 이 정보는 길이 가능성만 알려 주며 의미상 올바른 조건이나 사실의 인증이 아니다.

117의 해당 진술은 검사 환경을 이미 text와 at에 담았다. 따라서 현재 계약의null 경로로 정직하게 표현할 수 있다. 별도 표 셀 참조/cell catalog는 선택하지 않는다. source provenance와 짧은 원문 조건의 차이는 유지한다. 저장한도80/200을 늘리거나 잘라내기·자동null·부분적용·자동재시도로 실패를 구제하지 않는다.

## 결정적인 입력 안내

- 유효한 후속 studio.map.7 ask의 보낸 records/spans만 계산한다. 원문·span.2·alias·순서·lead·metadata·ask 키/내용·증거hash를 바꾸지 않는다.
- 기존 decodeSpans/resolveEvidenceRange와 정확히 같은 원문 범위를 기준으로 한다. 바깥공백만 제거한UTF-16 길이를 사용하며 내부CRLF/공백/emoji를 보존한다. 각 시작별로 end80/end200 또는없음을 계산한다. 종료점 사이의 모든 기존 연속범위는 같은 의미를 갖고, 다른기록·없는끝·역순·중간내용생략은 허용하지 않는다. 전체범위 나열은 피하고 행수는 span수에 선형으로 제한한다.
- 안내에는 record/start/end 식별자와 길이 가능성만 넣는다. 원문을 지침 영역에 복제하거나 표의내용을 새 지시로 승격하지 않는다. 자료의 의미·kind·material 판정은 대신하지 않는다. material 겹침/소유기록/역할basis 등 기존validator는 그대로 적용한다.
- 역할/claim/candidate statement는80, match는200이다. 한 시작점이없음이면그슬롯의조건으로선택하지말고 다른적합조건또는null을선택한다. 짧은범위여도 실제판본·환경조건이아니면조건으로쓰지않는다.
-117의N02.33은80/200모두불가, N01.03은두슬롯가능, N02.03과N02.31은80불가/200가능임을 고정예로 검사한다. 그 원응답을 수정하거나validator재실행해새PASS로만들지않는다.

## 프롬프트·실행 결속과 호환

MAP7 기본 문자열은 보존하고 map7Prompt(ask)에서 결정적 안내를 결합한다. MAP7 recipe는 명시적으로 새 revision으로 바꾸고 renderer/안내형식의 의미를 식별한다. map.laterPrompt는 새로운m7 recipe를 알린다. 동일schema는 동일wire/validator의미를 유지한다. 새로운schema/저장/input필드는 추가하지 않는다.

표준provider와 CLI 모두 같은 실제 map7Prompt(ask)를 쓴다. CLI의promptKind는동적문자열동일성에의존하지않고실제선택된schema/later경로를식별한다. actualpromptSHA와wrapperstdin은실제동적문자열을해시하고 prepare→spawn직전재계산으로입력/지침변경을거절한다. recipeID와입력별actualpromptSHA는서로다른식별자다. 실행직전이나결과회수중새prompt로몰래바꾸지않는다.

FIRST6 및 map1–6 프롬프트/recipe는byte불변, old7원기본지침은보존한다. old7 pending/ready의저장input/schema/prompt를현재recipe로재작성하지않는다. 실제pre118 producer에서생성한ready7fixture가새reader에서재생성없이회수/명시적용되고oldbinding을유지함을확인한다. 구형클라이언트의stale새submission은기존fingerprint거절로안내하고결과를새binding으로바꾸지않는다. project14/map-reading.5/map-input.1/map-job.1과기존about문자열/null정규화는유지한다.

## 작성 범위와 검증

제품변경은 map-prompt.mjs, studio.mjs, 기존102 preview/cli-executor.mjs 및 직접연결된필요한좁은helper에한정한다. 집중test와118결과문서를추가한다. UI재설계/새store/owner/lifecycle/시간·토큰·권한·모델확대/설치·계정전환은범위밖이다. 기존완료검사를일괄재연구하지않는다.

검증은실제117ask와합성경계사례에서안내와기존해석기를대조한다:79/80/81·199/200/201/204,emoji/CRLF/내부공백/표행/코드/문단경계/짧은다중span/최대span수,역순·다른record·잘못된wire실패,입력비변경·결정성. 안내가범위를누락/과대허용하지않는지독립oracle로확인한다. 최대valid입력과117실제입력에서부가문자/byte수를보고하며자료·시간한도를높이지않는다. 실제handler/provider·CLIprepare/spawn동적지침hash·oldready7/noextra call·oldFIRST6회귀를검사한다. Root는잠금build/check·독립검토·정상UI·정확CI로한정판정한다.

새실제모델호출은118중0이다. 수용뒤별도관문에서보존117원project/전체RQ/원자료를새지침으로한번관찰하고, 전달/전체계약/의미/정상회수·적용·원문복귀·백업을판정한다. 이한건을통과해도다중실제자료/복잡PC경험/호환공개전달의전체목표는남는다. 공개73·미수용74·UI75/693·키·stash보존,병합배포0.

구체적 직렬화는 [IMPLEMENTATION_SPEC.json](IMPLEMENTATION_SPEC.json)에 고정했다. 각 행은 [시작alias,80최대끝alias|null,200최대끝alias|null]이며 입력순서의compact JSON이다. 원문은 복제하지 않는다. 안내부 최대65536 UTF-8 byte/1600행 경계를 입증하고 예상밖 초과시 전송전 실패한다. 기존입력·출력·시간한도는높이지않는다. [독립 옵션 비교](OPTIONS_REVIEW.json)를 검토해B를 채택했으며 A는 보류했다.
