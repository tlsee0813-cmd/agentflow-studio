# 120 새 부분 ID 어휘 계약 — 작성자 결과

**결론:** 후속 studio.map.7 실제 지침에 새 부분 ID 문법 `^new:[a-z0-9_-]{1,24}$`와 같은 철자 참조 규칙을 정확히 넣었다. map.7에서 parts 첫 검사 거절은 이제 `parts[i].ref`·`reference`·고정 분류로 드러난다. 수용 집합·검사 순서·전체 거절은 그대로이고, 모델 호출은 0이다. 실제 모델이 이 안내를 따르는지, 지도가 의미 있게 만들어지는지는 확인하지 않았다(다음 실제 관문).

## 커밋

- 기준 `b7e7292066d44cd8969169956c5eefe055e0794a`(제품 코드는 수용된 118과 같음), branch `work/experience120-reference-vocabulary`
- 제품+좁은 검사 `be06128`: `server/map-prompt.mjs`, `server/studio.mjs`, `src/shared/map-reading.ts`, `tests/condition120.test.mjs`(신규), `tests/condition118.test.mjs`의 단언 2개(recipe.3, 렌더링에 어휘 포함)
- 이 결과 문서는 별도 docs 커밋이다.

## 변경

- `map7Prompt(ask) = MAP7_PROMPT(불변) + MAP7_VOCABULARY + map7Guidance(ask)(118과 같은 표)`. 어휘 지침(`part-id-vocabulary.1`, 832 UTF-8 byte, SHA `e259dd1b…`)의 내용:
  - ASCII 소문자·숫자·`_`·`-`로 1–24자, 전체 정규식 명시
  - 유효 예 `new:label_guide`/`new:label-lookup`/`new:a0`, 거절 예 `new:labelGuide`
  - name은 사용자 언어로 쓸 수 있다
  - parent·relations from/to·candidates parts는 parts[].ref 철자 그대로, 같은 ref 두 번 금지
- `MAP7_RECIPE`는 `map7-recipe.3`(118 안내 유지 + 어휘)이다. m7 id는 어휘까지 해시해 `m7-94f4e6678496`가 됐다. 118은 `m7-82631aa43efc`, 116은 `m7-1a2625a62324`였다. 표준 provider와 CLI는 같은 `map7Prompt` 하나를 쓰므로 CLI의 promptSha256·spawn 직전 재계산 비교는 새 문자열에 그대로 걸린다(코드 변경 없음).
- map.7 parts 첫 검사: form() → obj() → ref 순서와 같은 조건이다. 같은 경우만 `MapReplyError(parts[i].ref, 'reference', target)`로 바뀐다. target은 `invalid-new-key`(new: 접두 + 문법 불일치), `unknown-part`(그 밖 문자열), `duplicate-part`, `invalid-ref`(문자열 아님) 중 하나이고 ref 원문은 넣지 않는다. map1–6은 기존 일반 `INVALID_RESPONSE`다. trim·소문자화·재할당·별칭 수선은 없다.

## 실행한 검사 (모두 모의·모델 없음)

- `condition120.test.mjs` 5/5:
  - 유효: `new:a`·`new:label_guide`·`new:label-guide`·`new:a0`·24자 키가 부모 사슬·relation·identity 후보 참조와 함께 수용·적용·재읽기된다.
  - 거절: 대문자·빈 키·25자·한글·공백·`NEW:`·앞 공백·`P99`·비문자열·중복이 path와 고정 target으로 거절되고, wire는 바뀌지 않는다.
  - 철자가 다른 parent/relation/candidate 참조는 기존대로 거절된다.
  - 순서: roleAbout 혼용이면 condition-form이 먼저, 여분 키면 일반 계약 거절이 먼저다.
  - map.6: 같은 수용 집합과 일반 거절.
  - 고정값: 기본 MAP7 SHA `73286f8b…`, map1–6/FIRST 9개 해시, m6 id, 118 안내 frame(pre120 코드 기준 `9d497d4c…`), 표 행 동일.
  - pre120 m7(`m7-82631aa43efc`) 새 작업 접수는 `PROMPT_CHANGED`, 호출 0.
- 이전 ready 회수: `condition118` 118-7(pre118 producer ready7을 이전 binding으로 회수, 호출 0)이 이 코드에서도 통과한다. pre120(recipe.2) ready7 fixture는 새로 만들지 않았다.
- 관련 묶음 89/89: condition116/118/120, owned-cli112, map70, candidate98, source-entry114, durable100. `node --check`와 client 경계 검사도 통과했다.
- 컴파일러: PATH tsc 6.0.2이고 기존 `app.ts` 1건 외 오류는 0이다. 잠금 TS5.8.3/Node24.19 통과는 주장하지 않으며 재설치는 하지 않았다.
- 119 실패 응답은 fixture로 쓰지 않았고 validator에 다시 넣지도 않았다. UI 코드 변경이 없어 전체 모의 PC 흐름은 돌리지 않았다.

## 미확인 / Root 몫

- 실제 117/119 ask에 대한 새 prompt·recipe·stdin 정적 계산(비공개 원본)
- 잠금 Windows build/check, 독립 delta 검토, 정확 HEAD CI
- 실제 모델이 소문자 ID를 쓰는지, 그 뒤 118 조건·의미·적용 흐름이 통과하는지는 120 수용 뒤 별도 실제 관문에서 확인한다.

## 보존

- 116 작업 경로 HEAD `2697bb5`와 미커밋 `check-ui-116.mjs`, 118 worktree(`8aa7c3d`, clean)는 손대지 않았다.
- 병합·배포는 0이다.
