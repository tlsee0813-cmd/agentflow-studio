# AF78 · 응답이 끝나지 않은 실패의 이유

**범위:** 실패 이유의 분류와 안내 문구만 고친다. 최종 지도 품질이나 실제 지시의 길이 초과 자체를 해결하지 않으며, 전체 제품 수용이 아니다. 기준 `work/experience76-explicit-uncertainty` `9c27ef618cf50e6f9ccd8b40c5329083ef385094`(app `eac7b08…`), 브랜치 `work/experience78-response-failure`.

**문제:** `server/studio.mjs`의 `callStudioModel`은 `finish_reason`이 `stop`이 아닌 응답을 `INVALID_RESPONSE`로 합쳤고, `client/map-run.ts`는 이를 "근거 규칙(원문 인용·알려진 부분)에 맞지 않아"로 안내했다. 길이 제한으로 끝난 응답이 근거 위반처럼 읽혔다.

**바뀐 행동**

| 공급자 응답 | 서버 코드 | 지도 정리 안내 |
|---|---|---|
| `length` (내용이 유효 JSON이어도) | `AI_RESPONSE_INCOMPLETE` 502 | AI가 응답을 끝내지 못해 지도에 반영하지 않았어요. 원문과 기존 지도는 그대로예요. |
| `stop`·`length` 밖의 이유 또는 이유 없음 | `AI_RESPONSE_UNFINISHED` 502 | AI 응답이 정상적으로 끝나지 않아 지도에 반영하지 않았어요. 원문과 기존 지도는 그대로예요. |
| `stop`, 계약·근거 위반 | `INVALID_RESPONSE` 502 (+map.6 detail) | 기존 그대로 |
| `stop`, 유효 | 200 | 기존 그대로 |
| 시간 초과 / 취소 | `AI_TIMEOUT` 504 / `CANCELLED` 499 | 기존 그대로 |

끝나지 않은 응답의 내용은 파싱·검증·적용·부분 저장하지 않으며 자동 재시도도 없다. 다른 화면(`ERROR_TEXT`)도 두 코드에 짧은 문구가 있다. 새 코드를 모르는 이전 클라이언트는 기존 일반 문구("지도를 정리하지 못했어요. 기록은 그대로예요.")로 떨어진다. map.6 계약·prompt·provider 설정·UI 레이아웃·저장 schema는 바꾸지 않았다.

**검사:** `tests/failure78.test.mjs` (모의 공급자). 실제 API 호출 없음. 실제 지시의 `length` 실패는 남는다.
