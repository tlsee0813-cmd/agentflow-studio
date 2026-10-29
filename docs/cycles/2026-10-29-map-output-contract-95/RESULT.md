# 95 첫 지도 출력 구조 제약 — 오프라인 대응

**관측한 canonical FIRST map.6 응답의 출력 구조는 오프라인에서 적합하다. 실제 CLI/backend의 제약 적용은 미확인이다.** 제품 runtime·저장 판본·기본 공급자는 바꾸지 않았다. 새 모델 호출·시간 확대·경쟁 경로 재실행·실패 응답 수선은0이다. 최초 목적은 전체 첫 지도를 전달하는 데 필요한 형식 책임을 기계적으로 제한할 수 있는지 확인하는 것이며, 의미 품질을 작은 출력으로 대체하는 일이 아니다.

기준은94 문서 b3e2033783f391d9af1d1421fe7621cf4f23aba4 / app501a7a1faa4b50c182e56ad0cd3a21ac65ed6e5d다. 공개73과 UI75 최종693 수리를 보존한다. 76의 불확실성 계약은 이미 구현·범위 수용됐다. 미완료인 것은 실제 복합 자료의 의미·고정 시간 내 완결 전달·현재 UI까지의 일관된 보존과 인수인계5/8 전체 관문이다.

## 회수한 결과와 이번 차이

89는 실제 지시80.743초와micro52.603초의 한정된 의미·PC 수용을 남겼지만 Zephyr는90.055초에 최종 응답0이었다. 91은 빠른 유효 DeepSeek 응답이 철회 조건과 운영 입력의 의미에서 반려됐고,92는 DeepSeek 첫 candidate.text 누락과 Sol89초 cutoff 최종0으로 전달 실패했다. 이들은 서로 다른 실패이며 schema가 모두 해결한다고 주장하지 않는다. 초기89 micro 반려는76의 명시적 비차단 한계를 반영해 정정된 상태를 유지한다.

기존89/91/92 CLI는 이벤트 JSONL과 최종 출력 파일을 사용했고 --output-schema는 사용하지 않았다. 설치 CLI의 도움말과 [공식 비대화형 문서](https://learn.chatgpt.com/docs/non-interactive-mode)를 대조했다. 이벤트 JSONL과 최종 응답의 JSON Schema 요청은 별개다. [Structured Outputs 문서](https://developers.openai.com/api/docs/guides/structured-outputs)의 지원 부분집합도 확인했으나, 현재 계정·모델·설치판에서 이 초안을 실제 강제하는지는 실행하지 않았다.

74의 strict 실패는 지우지 않는다. 당시 DeepSeek beta/forced tool/strict/disabled 경로는 전송 schema에서 제외된 인용을 반환해 기존 validator가 거절했다. 이번 초안은 기존 Sol CLI의 최종 응답 형태와 full map.6을 대상으로 하며 동적 인용 enum을 펼치지 않는다. 이 차이는 기술적 구분일 뿐 다른 공급자에서 강제가 작동한다거나 속도·의미가 개선된다는 증거가 아니다. 77의 작은 typed 읽기,74의 단계 분리,91/92의 경쟁·우선순위 변형도 반복하지 않았다.

## 적용 범위와 대응표

[스키마 초안](evidence/first-map6-output.schema.json)은 ask.schemaVersion=studio.map.6이고 parts·requests·priors가 모두 빈 배열인 FIRST 경로 전용이다. 이 조건 밖이면 초안을 사용하지 않는다. 기존 지도 갱신 전체에 대한 schema가 아니다. 동일한 완성 첫 지도 응답의 summary·parts·relations·candidates·gaps·matches·material을 모두 유지한다. candidate.text를 삭제·생략·자동 보충하지 않는다.

| 경계 | 출력 구조 초안 | 계속 필요한 기존 판정 |
|---|---|---|
| 루트 | 7개 필드 필수, 추가 필드 금지 | summary의 UTF-16 길이·금지문자·비밀 형태·의미 |
| 부분 | 최대12개,8개 필드 필수,새 부분 name은 문자열 | ref의 실재/중복, 이름·역할의 길이, parent 실재·자기참조·순환 |
| 역할·근거 | role/roleAbout/roleReplaces의 nullable 형태, basis1–4개 | 조건부 null 관계, 정확 인용 범위·600 UTF-16·역할의 귀속 |
| 주장 | 부분별 최대4개,kind enum·text·at·about·replaces·key 유지,첫 지도 replaces=null | s-key 형식/전체 고유성, 내용·판본·철회·정확 근거 |
| 관계 | 최대12개,방향·kind enum·note·at 유지 | 끝점 존재·자기 연결·원문이 뒷받침하는 방향과 동작 |
| 미정 | 최대6개,질문 text 필수,target4종,parts 최대2개,statement 전체 또는null | target별 개수·statement 필수/null,귀속·동일성·부모·성립의 실제 의미 |
| 불확실성 충돌 | 필드를 모두 유지 | 같은 진술 known/open·중복target·미정인 parent의 확정 연결·독립 사실 보존 |
| 미정자료·빈 대응 | gaps 최대2개, FIRST matches=[] | 자료가 실제로 부족한지, 이미 답한 질문의 재개방 여부 |
| material | 최대6개,at/what 필수 | 정확 원문 범위와 제품 근거의 중첩 거절·내포 자료의 귀속 |
| 문자열 | 원문 문자열을 그대로 전달; trim/보충0 | JSON Schema 문자 수와 JS UTF-16 길이를 혼동하지 않고 기존 상한을 적용 |
| 최종 수용 | 구조 초안만으로 수용하지 않음 | 기존 validateMapReply·원자 적용/저장·전체 의미·PC 관문 |

이 초안은 canonical FIRST 구조의 표현 가능성과 제한된 구조 검사를 다룬다. 도메인 validator의 전체 수용집합과 등가라고 부르지 않는다. 인용 실재·교차 참조·조건·의미를 동적 schema로 옮기거나 완화하지 않았다. 다른 target에 같은 문장이 쓰였는지와 원문이 이미 답한 질문인지는 구조만으로 보증되지 않는다.

## 새 오프라인 관측

root는 기존89 수용 actual-order와micro 원문 JSON 두 개의 SHA를 확인하고 수정 없이 구조 초안 및 현재 validator에 대조했다. 각 원본 SHA는99c33f98…와35344e1e…이며 재생성·의미 재수용·UI 재실행이 아니다. 필수 candidate.text 누락/null, 없는 target, 추가 루트 key, FIRST에서 비어 있지 않은 matches, 후보 부분 상한 초과를 포함한8합성 구조 관측과, 구조는 맞지만 도메인에서 거절되는3관측을 남겼다. [최초 결과](evidence/offline-result.json).

최초 'holds without statement' 반례에는 없는 부분 참조도 있어 reference 검사에서 먼저 거절됐다. 이 관측은 holds 분기 자체의 증거로 사용하지 않는다. 최초 결과와 스크립트를 보존했고 현재 검사 코드의 label/comment만 정정했다. [정정](evidence/test-label-correction.json).

[초안·제한 평가기](evidence/experience95-output-schema.mjs), [최초 검사 코드](evidence/offline-check-initial.mjs), [관측 이름 정정 후 코드](evidence/offline-check-current.mjs)를 함께 남긴다. 전체 검사 코드는 비공개 Ops 원자료의 존재를 전제로 하며, 공개 파일만으로 과거 응답 원문을 복원하거나 실제 호출을 수행하지 않는다.

평가기는 이번 초안에 쓰인 type/properties/required/additionalProperties/items/minItems/maxItems/enum/anyOf만 읽는 제한된 자체 검사다. 평가한 노드의 모르는 keyword는 실패한다. 방문하지 않은 schema 가지 전체를 검증하는 meta-validator는 아니다. 일반 JSON Schema 구현이나 공급자의 constrained decoder를 재현한 것이 아니다. 테스트에서 schema 통과·도메인 거절을 의도적으로 분리했다.

Sol 독립 검토는 필수 필드 전체·7 claim종류·4 candidate종류·nullable·FIRST 조건 아래 배열/필드 제한을 직접 대조해 구체적 구조 차단 문제를 발견하지 않았다. 유효한 새 부분과 인용을 둔 baseline을 먼저 통과시킨 뒤 같은 부분의 holds+statement:null을 거절하는 독립 반례로 최초 공백을 보완했다. candidate.at=null이면서 유효한 statement가 있는 귀속 미정과, 새 부분의 유효 roleReplaces 문자열이 기존 규칙에 따라 null 효과가 되는 경우도 보존됨을 확인했다. [독립 검토](evidence/independent-review.json), [최소 관측](evidence/independent-probe.json).

FIRST guard는 validateMapAsk 이후의 범위 확인이며 전체 입력 validator가 아니다. 현재 코드의 문자열·참조·불확실성 충돌·material 중첩 거절과 원자 저장 규칙을 계속 사용해야 한다.

## 총괄 판단과 다음 관문

출력 구조 초안은 후속 검토용으로 보존하며 제품에는 연결하지 않는다. CLI 옵션과 공식 설명을 확인한 사실, 기존 두 응답의 오프라인 호환, 실제 backend가 초안을 적용하는지, 전체 의미와90초 전달이 개선되는지는 서로 다른 관문이다. 후자의 세 가지를 앞의 결과로 대신하지 않는다. 이 판정 자체가 새 호출이나 provider 채택을 자동 시작하지 않는다. 실제 경로의 시험을 선택할 경우에도 전체 자료·완성 지도·기존 의미 기준·고정 시간과 원자 거절을 유지하고, 과거 실패 raw의 수선이나 빠진 필드 보충을 하지 않아야 한다.

공개73은 그대로이고74 의미 품질 미수용·UI75 및 후속 PC 범위 수용을 구별한다. 90의 API/예문 경계 제안은 여전히 보류다. 이 결과로 과거 실패를 통과로 바꾸거나 전체 제품 완성을 선언하지 않는다. 원문·기존 stash·키를 보존했고 목표는 활성이다.
