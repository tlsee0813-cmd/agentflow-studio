# 118 조건 길이 선택 정보 — 작성자 결과

**결론:** 설계 B를 구현했다. 후속 studio.map.7 ask마다 앱이 보낸 구간 기준으로 `[시작, 80 이내 마지막 끝|null, 200 이내 마지막 끝|null]` 행을 계산하고, 바뀌지 않은 MAP7 지침 뒤에 붙여 실제 지침으로 보낸다. ask·wire·validator·저장 형식·map1–6/FIRST6·MAP7 기본 문자열은 바이트 그대로다. 모델 호출은 0이다. 이 안내가 실제 모델의 조건 선택을 바꾸는지, 의미상 맞는 조건을 고르는지는 확인하지 않았다(다음 실제 관문).

## 커밋

- 기준 `f91e9ee99eb67a5c75864207e13feeae9565659f`, branch `work/experience118-condition-selection`
- 제품+집중검사 `8875b77`: `src/shared/condition-guidance.ts`(새 좁은 helper), `server/map-prompt.mjs`, `server/studio.mjs`, `preview/cli-executor.mjs`, `tests/condition118.test.mjs`, `tests/fixtures/ready7-118/`, `make-ready7.mjs`, `guidance-of-ask.mjs`, 그리고 `condition116.test.mjs`의 4개 단언(보낸 지침을 `map7Prompt(ask)`로 기대)
- 이 결과 문서는 별도 docs 커밋이다. 그 뒤 제품 변경은 없다.

## 구현 내용

- `conditionGuidance(ask)`: validator와 같은 `askRecords` 구간·같은 JS trim으로, 각 시작에서 끝을 늘리며 바깥 공백을 지운 UTF-16 길이가 1~한도인 마지막 끝을 찾는다. 길이는 끝이 늘어도 줄지 않으므로 나열한 끝까지의 모든 끝이 허용되고 그 다음은 넘친다. 행에는 alias와 null만 있고 원문·metadata는 없다. map.7만 받는다.
- `map7Prompt(ask) = MAP7_PROMPT + map7Guidance(ask)`. 블록은 `<CONDITION_LENGTH_GUIDANCE version="condition-length-guidance.1">` 안내 3줄 + 한 줄에 한 행인 JSON 배열이다. 1600행 또는 65536 UTF-8 byte를 넘으면 전송 전에 `INPUT_TOO_LARGE`를 낸다(일부 표는 보내지 않는다).
- `MAP7_RECIPE`는 `map7-recipe.2`(안내 형식·한도·알고리즘 포함), `map7PromptId`는 recipe·기본 문자열·안내 frame을 해시한다. 새 m7은 pre118의 `m7-1a2625a62324`와 다르다. recipe id와 ask별 실제 지침 SHA는 별개다.
- 표준 provider: 호출 전에 같은 renderer로 system 지침을 만들고, 만들 수 없으면 413으로 호출 0.
- CLI: `promptKind`는 schema 경로(first/later/later7)로 정한다. `promptSha256`은 렌더링된 지침의 해시다. spawn 직전에 다시 렌더링해 binding과 비교하고, stdin을 바로 그 문자열로 만든다. 렌더링할 수 없는 ask는 prepare에서 413으로, lease·자식 0.
- 이전 client가 이전 m7로 새 작업을 보내면 기존 fingerprint 거절(`PROMPT_CHANGED`)이 난다. 새 binding으로 바꾸지 않는다.

## 실행한 검사 (모두 모의·모델 없음)

- `condition118.test.mjs` 7/7:
  - 행이 독립 oracle과 같다. oracle은 모든 시작·끝 쌍을 기존 `resolveRange`와 trim으로 조기 중단 없이 확인하고, 허용 끝이 시작부터 연속인지도 확인한다.
  - validator와 맞는다. 나열한 끝은 실제 claim(80)·match(200) 조건으로 통과하고, 그 다음 끝과 null 시작은 `condition-length`로 거절된다.
  - 79/80/81·199/200/201·emoji 80/81 단위·바깥 공백/내부 CRLF·117 diagnosis의 실제 204단위 표 행(80/200 모두 null)·짧은 표 행·코드·문단 경계를 확인했다.
  - ask 불변·결정성·원문 미포함, 기존 해시 고정: map1–6/FIRST/recipe 12개, MAP7 기본 `73286f8b…`(=117 systemSha), m6 `m6-6859b864664f`.
  - 최대 유효 ask(4기록×400구간)는 1600행이고 그 밖 입력은 provider·CLI 모두 호출 전에 거절된다.
  - 두 경로가 같은 렌더링을 쓴다(provider 직접·job은 같은 SHA, CLI prepare→spawn 불일치 4종은 자식 0, 정상 1회).
  - pre118 producer가 쓴 ready7은 이전 binding `m7-1a2625a62324`로 회수·명시 적용되고 호출 0, 원 파일은 그대로다.
- 관련 suite 131/131: condition116·118, owned-cli102/112(+process), map70, durable100(+process), source-entry114, candidate98, request71. `node --check`와 client 경계 검사도 통과했다.
- 컴파일러: 이 환경의 PATH tsc는 6.0.2이고 기존 `app.ts` 1건(기준선) 외 오류는 0이다. 잠금 TS5.8.3 build/check 통과는 주장하지 않는다. 재설치는 하지 않았다.

## 안내부 크기 (`AF118 guidance size`)

| 입력 | 행 | 안내 블록 UTF-8 | 지침 전체 UTF-8 |
|---|---|---|---|
| 최대 유효 ask(1600구간) | 1600 | 53,536 | 77,489 |
| 116 합성 후속 ask | 26 | 2,132 | 26,085 |
| 기본 MAP7(안내 없음) | — | — | 23,953 |

기존 입력·출력·시간·토큰 한도는 올리지 않았다.

## 미확인 / Root 몫

- 실제 117 ask는 저장소에 없다. N02.33(80/200 불가)·N01.03(둘 다 가능)·N02.03·N02.31(80 불가/200 가능)은 Root의 동결 입력으로 `guidance-of-ask.mjs <ask.json> N02.33 N01.03 N02.03 N02.31`을 돌려 대조해야 한다. 여기서는 diagnosis의 원문 행(204)만 검사했다.
- original116 ready7 원본의 회수, 잠금 Windows build/check, 독립 oracle, 정상 1280 UI(source/back·backup), 정확 CI는 Root가 한다. 이번에는 UI를 직접 돌리지 않았다.
- 실제 모델이 안내를 따르는지와 조건 의미의 정확성은 다음 실제 관문의 몫이다. 이 구현은 길이 가능성만 알린다.
- 116 작업 경로(`work/experience116-condition-reference`, HEAD `2697bb5`, 미커밋 `check-ui-116.mjs`)는 그대로 두었다.
