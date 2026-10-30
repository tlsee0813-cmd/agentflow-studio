# 131 — 전제 검토의 출력 한도와 시간 수리 (구현)

[설계](DESIGN.md)대로 `app/continuity/server/studio.mjs`의 `callStudioModel`에서 두 조건에만 scope를 넣었다. 기준은 83da0f7(app 581571f)이다.

## 현재 동작

- **출력 한도**: scope(`studio.scope.1`)는 plan/digest와 같은 `max_tokens` 8192를 쓴다. 이전 값은 4096이다.
- **시간**: scope는 `planTimeoutMs`(기본 60초)를 쓴다. 이전에는 일반 `timeoutMs`(기본 30초)를 썼다. planTimeoutMs가 없는 설정에서는 기존과 같이 `timeoutMs`로 대체된다.
- **그대로 둔 것**:
  - `planning` 분류
  - scope의 thinking enabled·reasoning_effort low
  - SCOPE_PROMPT(sha256 00cf7462…)와 PLAN3(aacb45c3…)
  - 입력 전문, 모델(비-ask 경로의 `planModel ?? model`), response_format
  - 응답 크기 경계, 키 포함 거절, stop일 때만 읽기, 검증, 취소, 1회 호출(자동 재시도 없음)
  - ask·map·plan·digest의 한도와 시간
- **새로 넣지 않은 것**: 설정, 큐, 저장, UI, 직접 확정, 재시도, 키 요구는 없다.

## 검사

새 `tests/scope131.test.mjs` 4건을 추가했다. 모두 controlled fetch를 쓰고, 공급자 호출은 0회다.

1. **scope 경로 요청**: fetch 본문이 다음과 같은지 확인한다.
   - max_tokens 8192, thinking enabled, low, json_object, stream false, 모델 `DEEPSEEK_PLAN_MODEL`
   - system이 SCOPE_PROMPT와 정확히 같고, user가 입력 전문과 정확히 같다.
   - 호출은 1회이고, 키가 본문에 없다.
2. **다른 경로의 한도**: ask는 `config.maxTokens`이고 thinking이 꺼져 있다. plan.1~3·digest.1~2·scope는 8192/low다. map은 자기 한도(16384)다.
3. **시간 선택**: `node:test`의 mock timers로 실제 대기 없이 확인했다.
   - 일반 timeout(1000ms)에서는 ask만 끝나고 scope·plan·digest는 남는다.
   - planTimeoutMs(5000ms)에서 scope·plan·digest가 `AI_TIMEOUT/504`로 끝난다.
   - planTimeoutMs가 없는 설정의 scope는 1000ms에 끝난다(대체값 유지).
4. **거절 유지**: 다음은 각 1회 호출 뒤 거절된다. 유효한 stop 응답만 그대로 받는다.
   - `length`는 `AI_RESPONSE_INCOMPLETE`
   - 다른 종료나 종료 사유 없음은 `AI_RESPONSE_UNFINISHED`
   - 잘린 JSON이나 없는 근거 ID는 `INVALID_RESPONSE`
   - 진행 중 취소와 사전 취소는 `CANCELLED`이며, 사전 취소면 fetch를 부르지 않는다.

같은 검사를 기준 `studio.mjs`에 돌리면 1~3번은 실패하고 4번은 통과한다. 즉 이 검사는 변경을 구별한다.

작성자 실행 결과는 아래와 같다. 모두 참고용이다.
- 이 환경에는 잠긴 TypeScript 5.8.3이 없다. 그래서 PATH tsc 6.0.2로 `tsc -p continuity/tsconfig.json --noEmitOnError false`를 실행해 continuity dist를 다시 만들었다.
- 그 dist로 `node --test`를 scope131, plan-api, zero85, authoring84, change-plan, scope108, uncertainty106, http, failure78, studio, digest63, release124에 돌렸다. 88/88 통과했다.
- `continuity/scripts/check.mjs`는 수정하지 않은 `src/client/app.ts:2406`에서 TS6 오류 1건을 냈다. 기존에 알려진 컴파일러 버전 차이다.
- 잠금 check/build, 전체 suite, 정확 CI, 브라우저 화면 검사는 실행하지 않았다. root가 맡는다.

이 결과는 계약·분기 검사일 뿐이다. 실제 scope가 8192 토큰·60초 안에 끝난다는 증거가 아니며, 성공을 보장하지 않는다.

## 잔여 한계

- 130의 원 usage는 노출되지 않았다. 그래서 4096이 추론과 본문에 어떻게 나뉘었는지, 8192면 충분한지 모른다.
- 8192에서도 length로 끝날 수 있다. 그때는 기존처럼 `AI_RESPONSE_INCOMPLETE`로 거절하고 자료를 보존한다. 자동 재시도나 응답 수선은 없다.
- 60초 상한 때문에 길어진 추론이 `AI_TIMEOUT`이 될 수 있다.
- 실제 관측은 수용 뒤 root가 130 보존 plan과 동일 scope ask로 1회 따로 선택한다. 작성자는 0회다.

실제 모델/API/CLI 호출, 배포, merge, PR, 설치, 계정 전환은 모두 0회다. UI75/693과 128 runtime은 그대로다.
