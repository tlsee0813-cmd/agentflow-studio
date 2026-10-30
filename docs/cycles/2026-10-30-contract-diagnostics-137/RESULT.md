# 137 거절 위치 진단 — 작성자 결과

**결론:** studio.map.7 `validateMapReply`의 일반 guard가 거절하면, 이제 정적 path와 고정 분류가 기존 `MapReplyError`(rule `contract`) → executor detail → job 실패 영수증으로 전달된다. 같은 조건·같은 위치·같은 성공값을 유지했다. 합성 corpus 49건에서 base와 후보의 수용/거절 집합과 성공값이 같다. map1–6과 기존 구조화 오류는 그대로다. 이 수정은 136 원응답이 왜 거절됐는지 밝히지 않는다(원응답은 남아 있지 않다). 모델 호출은 0이다.

## 정확한 기준과 결과

- base `bf11f298382da28dcd8587b27f95ab5c33eefdf9`, app tree `3960c16dbaf229f6100291f0252b34c50301cf33`
- 제품+검사 최종 `2a57f730e19dd8f279b9be204911d7c5ef09b7e5`, app tree `78f6842b3ba302df8444a58a904f92025ad9e3af` (branch `work/experience137-contract-diagnostics`). 첫 제품 커밋 `5de745a`(app tree `9fae413…`)에 Root 회수 후 두 수정을 더했다(아래 ‘회수 후 수정’).
- 이 문서와 증거 JSON은 별도 docs 커밋이다. 그 뒤 제품 변경은 없다.

## 변경 파일

- `app/continuity/src/shared/map-reading.ts` (제품 유일):
  - `validateMapReply` 안에 지역 helper `need`·`object`·`field`·`list`를 두었다. map.7이 아니면 기존 전역 `check/obj/str/arr`에 그대로 넘긴다.
  - map.7의 각 일반 guard에 정적 path와 `ContractGuard` 고정 분류를 붙였다. 분류: shape, keys, text, count, new-count, parent, existing-name-parent, role-required, basis-required, kind, replaces, empty-part, role-basis, parent-cycle, ends, duplicate, match-contract, quote, explicit-request, about, secret-like, target-time, target-count, prior, prior-target.
  - `MapReplyError` rule에 `contract`를 더했다.
  - `validateRequestMatch`가 자기 거절(`INVALID_REQUEST_SCOPE`)로 실패하면 `matches[i]`·`match-contract`까지만 말한다. 그 밖의 예외는 일반 `INVALID_RESPONSE` 그대로다.
  - 비밀처럼 보이는 글 검사는 같은 문자열 집합에서 첫 위치 path만 말한다.
  - 전역 함수, 별도 prepass/두 번째 validator, 전역 mutable 문맥, 정규화·수선은 없다.
- 검사: `tests/contract137-corpus.mjs`, `tests/contract137.test.mjs`(신규), `tests/condition120.test.mjs` 단언 1개(exact-key 거절이 일반 `Error` → `parts[2]|contract|keys`; 순서 확인은 그대로)
- 비교 도구: `docs/cycles/2026-10-30-contract-diagnostics-137/compare-base.mjs`

## 동등성 증거

`node docs/cycles/2026-10-30-contract-diagnostics-137/compare-base.mjs <base checkout>`가 같은 ask/reply 객체를 base 빌드와 후보 빌드의 validator에 넣는다. 결과는 [evidence/compare-base.json](evidence/compare-base.json)이다.

- 49건, 차이 0
- 수용 2건(map.7·map.6 정상 응답)의 반환값이 JSON으로 같다.
- map.7 일반 결함 35건: base는 모두 일반 `INVALID_RESPONSE`, 후보는 모두 `MapReplyError`·`contract`·예상 path/분류다.
  - 중첩 위치 예: `parts[1].claims[2].kind`, `candidates[0].statement`, `material[0].at`, `matches[3].replaces`, `parts[0].parent`(parent-cycle)
  - 복합 match(stance·없는 요청·여분 키)는 `matches[i]|match-contract`다.
- 116·120 때부터 있던 구조화 거절 4건(not-anchor, invalid-new-key, condition-length, claim key)과 map.6 source-kind는 base와 같다.
- map.6 결함 8건은 base와 같은 일반 `Error: INVALID_RESPONSE`다.
- 새 진단(path·target)에는 심어 둔 marker(값·extra key 이름·비밀형 문자열)가 없고, wire는 바뀌지 않는다.

## 회수 후 수정 (`2a57f73`)

1. `compare-base.mjs`: 자기 경로를 `new URL(...).pathname` 대신 `fileURLToPath`로 만든다. Windows 드라이브 경로가 깨지던 문제(Root 보고)다.
2. `validateRequestMatch`의 catch: 전체를 `match-contract`로 표시하던 것을, 그 함수의 정상 거절(`Error('INVALID_REQUEST_SCOPE')`)만 표시하도록 좁혔다. 예상 밖 오류는 기존 일반 `Error(INVALID_RESPONSE)`로 남는다. 검사 조건과 map1–6은 그대로다.

수정 뒤 49건 비교를 다시 실행했다(차이 0, 증거 JSON은 `2a57f73`/`78f6842…` 기준으로 갱신). contract137을 다시 실행해 4/4다. 140건 전체는 다시 돌리지 않았다.

## 실행한 검사 (모의·모델 0)

- `contract137.test.mjs` 4/4:
  - 일반 결함의 path·분류와 marker·예외 문자열·줄바꿈 비노출을 확인했다. 중첩 위치 패턴은 15종 이상이다.
  - 정상 응답을 두 번 검사해도 같다. map.6은 일반 거절, 기존 구조화 거절은 그대로다.
  - 실제 executor 경로: 표준 `/map`은 502 `{code: INVALID_RESPONSE, detail: {path, rule: contract, target: kind}}`를 낸다. 102 fake CLI job(`map7-later`)은 failed이고, GET과 durable 영수증 파일이 같은 detail을 갖되 원값 marker는 없다. 자식은 1회이고 재시도는 없다.
  - 137-4: `validateRequestMatch` 자체가 그 wire에 `INVALID_REQUEST_SCOPE`를 던지는 경우만 `match-contract`다. 그 함수 안에서 주입한 예상 밖 예외(target 필드를 읽으면 TypeError)는 map.7·map.6 모두 일반 `Error: INVALID_RESPONSE`이고 예외 문구도 담지 않는다. getter가 정확히 1번 실행됐는지 확인했다. 이 검사는 `5de745a` validator에서는 실패하고 최종 코드에서 통과한다.
- 관련 묶음 140/140(`5de745a` 기준): contract137, condition116/118/120, owned-cli112/102, map70, source-entry114, candidate98, request71, durable100, uncertainty76. `node --check`와 client 경계 검사도 통과했다.
- process 수명주기 검사는 다시 돌리지 않았다. CLI·lifecycle·queue 코드는 바꾸지 않았다.

## 미확인 / 한계

- 136의 실제 거절 원인. 원응답이 없으므로 이 수정으로 원인을 밝혔다고 말하지 않는다.
- 예상 밖 예외는 기존대로 일반 `INVALID_RESPONSE` → executor `{rule: CONTRACT}`다. request-match 안의 주입 예외는 137-4가 직접 확인했다. 다른 위치의 예상 밖 예외는 코드상 같은 경로지만 따로 주입하지 않았다. 작성자의 코드 읽기로는, 이 수정 뒤 map.7 응답에 `CONTRACT`만 남으면 guard 거절이 아니라 다른 예외일 가능성이 크다. 다만 이는 모든 경로를 증명한 결과가 아니다.
- 116/120 이전부터 있던 구조화 오류 일부는 target에 모델 값 앞부분(최대 40자)을 그대로 담는다. 예: `claims[i].key`, 후보 `target`/`parts`, `cite`의 reference, material reference. 지시대로 바꾸지 않았다. corpus의 `kept: claim key` 행에 그대로 기록돼 있다.
- 컴파일러: 이 환경은 PATH tsc 6.0.2이고 `node_modules`가 없다. 기존 `app.ts` 1건(기준선) 외 오류는 0이며 continuity/app dist는 그 방식으로 emit했다. 잠금 TS5.8.3/Node24.19 build/check, 독립 검토, 정확 HEAD CI는 Root 몫이다. 재설치는 하지 않았다.
- 원문 보관소·prompt·모델·시간·토큰·apply·schema·UI·실패 안내의 reload 소실은 바꾸지 않았다. 새 실제 생성도 하지 않았다.

## 보존

- 116 작업 경로(HEAD `2697bb5`, untracked `check-ui-116.mjs`), 118 worktree(`8aa7c3d`, clean), 120 worktree(`ca9b563`, clean)는 그대로다.
- PR·merge·deploy·main 변경은 0이다.
