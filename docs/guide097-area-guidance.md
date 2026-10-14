# GUIDE097 — 영역 구상에서 첫 요청 초안까지 (개발용 수직 흐름)

작성 2026-10-15 KST. 기준 source `0e884307`, 브랜치 `feat/area-guidance097`. 공개 배포 없음. main/dev/PR2/gh-pages 변경 없음.

## 1. 판단

**구현 가능하다.** 새 인증 설계는 필요 없다. 이미 있는 continuity 개발 서버의 경계를 그대로 쓴다.
- localhost Host/Origin 확인, `X-AgentFlow-Request` 헤더, 128 KiB 한도
- 서버 쪽 키, `ALLOW_PAID_AI` 명시 동의, 같은 limiter
- 화면 상단 연결 메뉴의 전송 동의

**차단 사항(이번 범위 밖).** 공개 정적 사이트(Pages)에서는 실제 AI를 쓸 수 없다. 키를 둘 서버가 없고 CSP가 `connect-src 'none'`이기 때문이다. 공개본에 실제 AI를 붙이려면 인증·프록시를 따로 설계해야 한다. 정적 빌드에서는 같은 기능이 브라우저 MOCK 규칙으로만 동작하며, AI로 표시하지 않는다. 이번에는 배포하지 않았다.

## 2. Pro 추천에서 빠진 기존 기능과 계약 (코드 근거)

| 이미 있는 것 | 위치 | 이번에 한 일 |
|---|---|---|
| 요청 → 질문 하나(fact/choice) → 답·모름·보류 → 재정리 → 작업문 | `domain.ts` `submit/answer/begin/receive`, `/api/continuity`(context.7) | 그대로 재사용. 채택한 초안은 이 경로로 들어간다. |
| 목적과 영역 구상의 배경 사본 | FLOW091-C `captureBackground` | 그대로. 채택한 초안을 보내면 사본이 붙는다. |
| 오래된 응답 차단 | `receive`(ticket·revision), 화면의 `projectEpoch` | 같은 방식. 안내에서는 revision 대신 자료 digest로 비교한다(아래 4). |
| 수동값 우선, AI가 기준을 바꿀 쓰기 경로 없음 | `currentWork`, README ‘잠금 기능은 없다’ | 그대로. 안내 응답에도 쓰기 경로가 없다. |
| MOCK의 예약 확정 방식 질문 규칙 | `mock.ts`(대기자 규칙) | 같은 축(바로 확정 / 확인 뒤 확정)을 안내 MOCK에 사용. |
| DeepSeek 호출(1회, 재시도 없음, 시간 제한, 오류 코드 고정, 키 반향 거절) | `continuity/server/provider.mjs` | 본문 생성과 응답 검사만 바꿀 수 있게 나눴다. 동작은 같다. |

**빈 곳은 ‘요청을 보내기 전’ 단계 하나다.** 기존 경로는 요청 원문이 있어야 시작하고, 시작하면 Task·Source(사용자 요청 원문)·Basis(requested)를 만든다. 영역 구상만으로 `/api/continuity`를 부르면, 앱이 쓴 문장이 사용자 요청 원문과 기준으로 영구 기록된다. 이는 원문 출처 계약 위반이다. 그래서 저장하지 않는 미리보기 계약(`guidance.1`)을 따로 두었다.

**경로 혼동 주의.** 구형 INIT 앱 경로(`app/server/app.mjs`, `/api/interview`, `app/server/providers/deepseek.mjs`의 `callDeepSeek`·`systemPrompt`)는 쓰지 않았고 바꾸지도 않았다. 공용으로 쓰는 것은 기존 continuity가 이미 쓰던 `readLimitedBody`, `config.mjs`, `errors.mjs`, `limiter.mjs`, `static-files.mjs`뿐이다.

## 3. Pro 추천과 다르게 한 점

1. **질문의 답을 바로 ‘이미 정한 답’(answered 기준)으로 저장하지 않는다.**
   - 이유: 채택 전에는 프로젝트를 바꾸지 않는다는 요구가 있다. 또 사용자가 초안을 고쳐 답과 다르게 바꿀 수 있다.
   - 답은 채택한 초안 원문에 들어간다. 사용자가 그 초안을 보내면 이후 모든 문맥에 requested 기준으로 남는다. 다음 안내는 이 영역의 요청 원문을 읽으므로 같은 질문을 다시 하지 않는다(G097-2).
2. **‘첫 작업문’을 별도로 만들지 않는다.** 채택한 초안은 그 영역을 대상으로 기존 요청 입력칸에 들어간다. 작업문은 기존 ‘작업문 준비하기’가 만든다. 그 결과 질문·배경 사본·오래된 응답 차단·수동값을 다시 만들지 않았다.
3. **저장 형식을 바꾸지 않는다(project.5 유지).** 안내 상태(질문·답·초안·고친 내용)는 탭 메모리에만 프로젝트와 영역별로 둔다.
   - 한계: 새로고침하면 채택 전 안내 상태는 사라진다. 프로젝트와 요청 입력칸은 기존대로 보존된다.

## 4. 계약 `guidance.1`

요청은 사용자가 쓴 자료만 담고, 써 넣을 Source·Task·Basis는 없다.
- `ticket{projectId,revision,requestId,areaId}`, `projectName`
- `brief`(목적, 없으면 null)
- `area{id,name,note}`(ticket.areaId와 같아야 함)
- `decisions`: confirmed·deferred·answered 기준의 현재 값. 자르지 않는다.
- `areaWork`: 이 영역의 요청 원문과 직접 고친 scope·checks. 최신순, 최대 5개. 크기를 넘으면 오래된 것부터 빼고, 빠진 만큼 화면의 ‘읽은 자료’에 표시된다.
- `answer`: 질문과 사용자 답(provided·unknown·deferred). 없으면 null.

응답은 `{question, proposal}`이며 정확히 하나만 null이 아니다.
- `answer`가 있으면 question은 거절한다. 질문은 많아야 하나라는 것을 코드로 강제한다.
- `proposal{goal,scope,checks,open[]}`, 추가 키는 거절한다.
- 응답 봉투의 ticket은 요청 ticket과 같아야 한다. 다른 영역의 응답은 거절한다.

화면은 응답을 다음 조건이 모두 맞을 때만 적용한다.
- 같은 프로젝트 활성화
- 같은 대기 요청
- 요청에 쓴 자료(목적·영역·결정·영역 요청·답)의 digest가 지금과 같음

요청 입력칸에 글을 쓰는 것은 digest에 들어가지 않으므로 응답을 막지 않는다.

## 5. 사용자 흐름

1. 영역 화면에 ‘무엇을 요청할지 같이 정하기 · 선택’이 보인다. 요청이 없는 영역에서는 펼쳐져 있고, 요청이 있는 영역에서는 접혀 있다. 지도 패널에도 같은 버튼이 있다.
2. ‘질문 또는 초안 받기’를 누르면 결과가 둘 중 하나다.
   - 질문 하나: 선택지, 직접 답, 모름, 보류로 답할 수 있다.
   - 바로 초안: 목적·구상·결정·영역 요청에 답이 이미 있을 때.
3. 초안을 고칠 수 있다. 고친 내용은 영역 전환, 중단, 실패, 늦은 응답 뒤에도 남는다. 고친 상태에서는 ‘다시 받기’ 대신 ‘고친 내용 되돌리기’가 나온다.
4. ‘이 초안으로 요청 쓰기’를 누르면 초안이 이 영역의 요청 입력칸에 들어간다. 아직 보내지 않은 상태다. 사용자가 확인한 뒤 ‘작업문 준비하기’로 보내면 기존 경로가 이어진다.
   - 작성 중인 요청이 있으면 넣지 않고 알린다. 초안도 그대로 남는다.
5. 숙련자는 기존 ‘＋ 이 영역에 새 요청’을 그대로 쓴다.

## 6. 바꾼 파일

- `continuity/src/shared/types.ts`: guidance 타입(저장 형식 아님)
- `continuity/src/shared/validation.ts`: 질문 검사 함수 분리(동작 동일), guidance 요청·응답·봉투 검사
- `continuity/src/shared/guidance.ts`(새 파일): 요청 구성, digest, 읽은 자료, 초안 문장, 채택
- `continuity/src/shared/mock.ts`: `mockGuidance`. 규칙 하나(예약 확정 방식)와, 그 밖에는 중립적인 첫 단계
- `continuity/server/prompt.mjs`: `GUIDE_PROMPT`, `buildGuideBody`. 기존 프롬프트는 바꾸지 않았다.
- `continuity/server/provider.mjs`: `callProvider` 공용화, `callGuidance`. `callContinuity` 동작은 같다.
- `continuity/server/app.mjs`: `POST /api/guidance`. 같은 검사를 거치고 MOCK/DeepSeek으로 나뉜다.
- `continuity/server/mock.mjs`, `continuity/src/client/runtime*.ts`: 요청 함수. 정적 빌드는 브라우저 MOCK을 쓴다.
- `continuity/src/client/app.ts`, `continuity/public/styles.css`: 영역 화면 안내 패널
- 테스트: `continuity/tests/guide097.test.mjs`, `continuity/tests/guide097_browser.py`, CI 단계 1개
- 기존 테스트 1곳 변경: `static_browser.py`의 정적 배포 파일 허용 목록에 `shared/guidance.js`를 추가했다. 새 공유 모듈이 정적 빌드에 들어가기 때문이다(14개 파일). 같은 테스트의 네트워크 호출·`/api/`·키 문자열 금지 검사는 그대로이며 이 파일에도 적용된다.

## 7. 실제 DeepSeek으로 확인하려면 (값 없이)

서버 프로세스 환경변수:
- 필수: `AI_MODE`(생략하면 deepseek), `DEEPSEEK_API_KEY`(서버에만 둔다. 클라이언트·저장소·ZIP에는 넣지 않는다), `ALLOW_PAID_AI=true`
- 선택: `DEEPSEEK_MODEL`, `AI_TIMEOUT_MS`, `AI_MAX_TOKENS`, `AI_REQUESTS_PER_MINUTE`, `AI_PROCESS_CALL_CAP`
- 엔드포인트는 `api.deepseek.com`으로 고정돼 있다.

실행과 확인:
1. `node continuity/server/index.mjs`로 서버를 띄운다.
2. 화면 상단 연결 메뉴에서 전송 동의를 체크한다.
3. 같은 구상(예약받기)에서 두 가지를 본다.
   - 질문이 필요한 경우에 질문을 하는지, 답 두 갈래에서 범위·완료 조건이 달라지는지, 모름·보류에서 그 선택이 남는지.
   - 충분한 기존 정보가 있을 때 질문 없이 초안을 내는지.

## 8. 검증과 구분

- **실제 AI: 미검증.** 이 환경에는 승인된 키가 없어 실제 DeepSeek을 한 번도 호출하지 않았다. 질문 품질과 초안 품질은 확인하지 않았다.
- **대역 upstream(fake fetch)으로 확인한 것**(G097-6/7):
  - 보낸 본문(안내 프롬프트, 자료 JSON, json_object, 인증 헤더)
  - 성공 응답 전달
  - 답 뒤의 두 번째 질문, 추가 키, 키 반향 거절
  - 401·429·네트워크 오류·시간 초과의 고정 코드, 재시도 없음
  - 유료 끔이면 전송 0회
- **MOCK 규칙으로 확인한 것**(G097-1~5, 브라우저 3개):
  - 같은 구상에서 답 두 갈래의 범위·완료 조건 차이, 모름·보류, 직접 답
  - 충분한 기존 정보(구상, 사용자 결정, 영역 요청) → 질문 없음
  - 채택 전 쓰기 0
  - 작성 중인 요청 보호
  - 영역 교차, 자료 변경 후 늦은 응답 폐기, 실패 후 답 유지와 재요청, 중단
  - 채택 → 기존 작업문 경로에서 원문 1회, 배경 사본
  - 390px 가로 넘침 없음
- MOCK은 일반 자연어를 이해하지 않는다. 예약 확정 방식 외의 영역에서는 질문 없이 중립적인 첫 단계만 낸다.

## 9. 남은 제한

- 실제 AI 품질은 미검증이다. 프롬프트는 후속 실제 검증에서 바뀔 수 있다.
- 안내 상태는 탭 메모리에만 있다. 새로고침하면 채택 전 상태가 사라진다.
- 공개 정적 사이트의 실제 AI는 차단 사항이다(1장).
- 질문의 답은 사용자가 초안을 보낼 때 그 원문으로만 남는다. answered 기준으로 따로 기록하지 않는다.
- 결정(decisions)은 영역 구분 없이 프로젝트 전체를 보낸다. 관련성 판단은 모델 몫이다.
