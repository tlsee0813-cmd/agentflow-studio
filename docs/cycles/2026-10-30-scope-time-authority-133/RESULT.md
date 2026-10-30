# 133 — 과거 결함을 현재 부재로 옮기지 않는 전제 검토 (구현)

[설계](DESIGN.md)대로 `app/continuity/server/plan-prompt.mjs`의 `SCOPE_PROMPT` 근거 해석 문단에 한 덩어리를 더했다. 위치는 record/reading 설명 뒤, 번호 규칙 앞이다. 기준은 bceb9b7(app 4a22ee1)이다. [132](../2026-10-30-scope-continuation-132/RESULT.md) 원 요청문과 실패는 고치지 않았다.

## 바뀐 규칙

- 보고·결함·요청·수리 계획은 기록한 시점과 basis의 판본에 묶어 읽는다.
- 선택 결과의 대상에 지금도 적용된다는 근거가 없으면, 과거 결함이나 앞으로의 수리를 summary나 prerequisites에서 현재의 결여나 완성으로 단정하지 않는다.
- 수리 지시·계획은 실행·해결의 증거가 아니다. 완료 증거가 없다는 것도 미구현의 증거가 아니다.
- 현재 상태와 잇는 근거가 없으면, 선택 결과에 관련될 때만 unknowns에 남긴다. 제공되지 않은 최신 코드를 안다고 가정하지 않는다.
- 반대로 선택 결과의 대상을 현재 판본으로 보여 주는 코드나 검사가 결여를 명시하면, 그 대상·조건의 범위 안에서 최소 전제 후보의 근거가 된다. 결함 기록을 모두 과거 일로 치우지 않는다.
- 판본이 다른 보고가 서로 어긋나면 하나의 현재 상태로 합치거나 완료·부재로 확정하지 않는다.
- summary와 prerequisites는 같은 확실성으로 쓴다.

이 규칙들은 일반 규칙이다. AF73/132 문구, 프로젝트 이름, 키워드 필터, 응답 후처리는 넣지 않았다.

SCOPE_PROMPT sha256은 00cf7462…에서 b56c507bda06cc1bdb052bc70546f77d427e066af84f5a6b7480428bf844a9db로 바뀌었다. 길이는 3,088자다. PLAN/PLAN2/PLAN3는 바이트 그대로다. 108의 intent/selected 서두, 반환 형식, schema scope.1, ask, client/UI/store, 모델, thinking, 131의 8192/60초, stop-only/strict/취소는 바꾸지 않았다.

## 검사

- 새 `tests/scope133.test.mjs` 2건을 추가했다.
  - PLAN1/2/3 sha 불변을 확인한다.
  - 세 합성 경계의 지침 문구가 근거 해석 문단 안(번호 규칙 앞)에 있는지 확인한다. 세 경계는 (1) 과거 결함+수리 지시만 있으면 현재 단정 금지, (2) 현재 판본 코드·검사가 명시한 결여는 범위 안 후보 허용, (3) 판본 충돌을 현재로 합치지 않음이다.
  - summary·prerequisites 동일 확실성, 108 서두 위치, 반환 계약 1회도 확인한다.
- `tests/scope131.test.mjs`의 SCOPE sha 고정값을 새 값으로 바꾸고 133 표시를 달았다. scope 요청 본문이 SCOPE_PROMPT와 같고 8192/low인지 보는 controlled 검사는 그대로다.

작성자 실행 결과는 아래와 같다.
- `node --check server/plan-prompt.mjs`: 통과.
- `node --test`를 scope133·scope108·scope131·plan-api·zero85·uncertainty106에 돌렸다. 26/26 통과했다.
  - 이 중 dist를 쓰는 검사는 이전에 PATH tsc 6.0.2로 emit한 참고용 dist로 돌렸다. 83da0f7 이후 src 변경이 없어 그 dist를 다시 썼다.
- 잠금 TS 5.8.3 check/build, 전체 suite, 정확 CI는 실행하지 않았다. root가 맡는다. 설치나 TS6 오류 재조사도 하지 않았다.

이 검사는 지침 문구와 요청 구성만 확인한다. 미리 쓴 모범 답안은 없으며, 실제 AI 의미 개선의 증거가 아니다.

## 미확인

- 새 지침이 132 유형의 단정을 실제로 줄이는지는 수용 뒤 root가 별도 실제 관측으로 판단한다.
- 반대로 현재 결여를 미확인으로만 남기는 과소 판단이 생기는지도 아직 모른다.
- 132 응답을 수선하거나 같은 조건으로 다시 실행하지 않는다.

실제 모델/API/CLI 생성, 배포, merge, PR은 모두 0회다.
