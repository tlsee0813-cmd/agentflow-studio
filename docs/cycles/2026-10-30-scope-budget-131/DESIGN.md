# 131 — 전제 검토의 추론 예산을 기존 변경안 분석과 정렬

130은 실제 정상PC에서plan 의미PASS 뒤 scope가28.329초에length로끝나 요청문을받지못했다.4096토큰·30초를쓴전달실패이고 의미실패/timeout아니다. 원usage미노출이므로 토큰전량소모·추론분배·8192성공을 추정하지않는다. [130 원결과](../2026-10-30-pc-continuation-130/RESULT.md)는불변이다.

## 선택

같은전체evidence를읽는thinking enabled-low scope만 기존plan/digest의8192토큰과planTimeoutMs(기본60초,기존fallback유지)를선택하게한다. 서버의budget/timer분기에만scope를포함하고planning분류자체는바꾸지않는다. scope의prompt/validator/shape/model·singleattempt·완료stop만수용·입력/출력크기·secret/cancel경계는그대로다. ask/map/plan/digest경로의budget/timer는바꾸지않는다. 새설정·큐·저장·직접확정UI·일반출시변경은없다.

완료조건은실제fetch요청의scope8192/thinkinglow/sameprompt 확인, scope가일반timeout이아닌planTimeout선택을하는행동, length/unfinished/invalid/cancel거절과자료보존유지다. 기존검사는회수하고관련회귀만보강하며실제AI호출은작성자0. 독립delta검토와관련검사·정확CI후총괄수용한다. UI변경없으므로130정상화면/보존증거는당시근거로재사용하며매번전면재검사하지않는다.

수리수용뒤에만130보존plan+동일scopeask(25995bc1)/동일scopeprompt00cf7462에서scope1회를별도선택한다. 지도/plan재생성·자동재시도·잘린응답수선은금지다. 성공보장은없고실패면원응답그대로분류한다. 이수리는제품전체완성아니며다음성과는실제요청문과구현/반환으로판정한다.

## 작성과 보존

base130결과fe1ea972d902cc3a176268bf592c7e49123b5aa9/app581571f. 단일제품작성자는기존scope구현Claude원본session_011uVYY3xzRRhPfB1V3DJ4jC, 새branch work/experience131-scope-budget. 총괄은선택·통합·수용을담당한다. UI75/693·키·stash·이전원문과결과·공개73/127을보존한다. 새연구·실패실험재실행·환경설치/계정전환은없다.
