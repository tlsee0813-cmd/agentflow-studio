# QUALITY024 — 읽은 실제 코드와 아직 없는 증거

## 기준선/읽기 검증

- IDEA023 ZIP SHA256: `0b42a8a5320b3612e5edd83129b1c66499bc1f50ac90296d30a03ad0a76b6b8a`
- SOURCE_IDEA023.sha256 파일 SHA256: `e26a6aec7e7ee785b14dbc9298bc61636f5223bf3da06ed0ebefbed854058e95`
- 실제 `source/app/continuity/server/prompt.mjs` SHA256: `22f0ae77eee864fed0b4f50efb38847ae31526b6152797fca520c1c188d9f023`
- RESEARCH021 ZIP SHA256: `96c58488447a9673bb53d3fad92332a249b291ec16b3628743d720ebeade5c06`
- 이번 QUALITY024 첨부 TXT SHA256: `7d12993751eec7bdbca3387d6f37e0bfdaf01b028b898a12a6fe289a2c8cf9e7`

ZIP을 별도 읽기 작업 폴더에 풀어 실제 파일을 읽었다. 023 source manifest의 182개가 모두 일치했다. 애플리케이션/domain/provider/runner를 실행하지 않았으며 테스트·빌드·설치도 하지 않았다. 이 문서의 코드 근거는 정적 읽기이고 관측 재현 결과가 아니다.

## 정확한 위치 (모두 IDEA023의 source/ 상대경로)

| 위치 | 확인한 코드 사실 | 인과 판단 경계 |
|---|---|---|
| `app/continuity/server/prompt.mjs:9,13–21` | 외부 코드 미확인을 미구현으로 단정하지 않기, 핵심 질문, 범위 유지, 필드 대조가 이미 지시돼 있다. | 더 같은 금지 문장을 붙이는 것이 병목 해결이라는 증거가 없다. 실제 모드/입력/최종 답 비교가 필요. |
| 같은 파일 `41–44` | buildBody는 model=config.model, system/user 두 messages, `thinking:{type:'disabled'}`, max_tokens=config.maxTokens, stream=false, json_object를 만든다. | thinking env가 없고 config에 필드를 추가하는 것만으로 mode가 바뀌지 않는다. |
| `app/server/config.mjs:7–26` | 공식 host/https/경로 제한, 키·유료 gate, timeout 100–60000ms, maxTokens256–4096, rate6/cap20/concurrency2 기본. | provider 공식 상한과 제품의 검사 상한을 구분해야 한다. env8192는 현재 구성 오류. |
| `app/continuity/server/provider.mjs:7–22,31–38` | provider 타이머와 실제 fetch body 생성, 전체 body131072 제한, finish=stop, tool_calls 없음, content 문자열, content JSON과 validateAdvice를 요구. reasoning_content를 advice로 넘기지 않는다. | 추론 본문도 전체 raw body 상한을 소비한다. finish/길이 실패를 앱 의미 오류로 단정할 수 없다. |
| `app/server/providers/deepseek.mjs:6–20` | 재사용 body reader는 전체 chunk bytes를 세고 초과 시 취소/실패한다. | 저장 8MB나 입력128KB와 다른 응답 한도다. |
| `app/continuity/server/app.mjs:23,39–48` | createContinuityApp은 주어진 config와 fetchImpl을 사용하며 실제 request/advice 검증과 provider 경로를 유지한다. | 후속 실험은 앱을 우회한 별도 정답 생성기가 아니라 이 동일 경로와 제한된 wire 설정 접착으로 비교할 수 있다. 아직 구현/실행 아님. |
| `experiments/idea016/transport.mjs:98–121` | 실호출 mock 주입 거부, readConfig/키 결속 writer, 실제 global fetch 직전 request hash와 raw 기록. | fetch 내부에서 body를 바꾸면 이미 쓴 raw/hash는 실제 wire와 달라지므로 접착 위치가 중요. |
| 같은 파일 `48–68,137–166` | 관측 clone128KB, parsed app 반향 감지, raw/provider/content 모두 같은 redact/writer 사용, protection error 후 반환 차단. | 기존 보호를 그대로 재사용한다. 모든 인코딩 보안 감사나 실키 검사는 이번 범위가 아님. |
| `experiments/idea016/engine.mjs:24–26`; `cases.mjs:23–36` | fresh가 사례 title을 projectName으로 쓰며 C02 title에 질문 목표가 들어 있다. C02 허용 facts에 알림 채널은 없다. | 실험 제목의 평가 힌트는 중립화하고, 허용 답 부재를 곧바로 모델 오답으로 세지 않는다. 기존 사례 원본은 고치지 않는다. |
| `engine.mjs:54–78,87–91,103–108,134` | submit/begin→transport→receive→handoff, 질문 대기, 오류 후 중단. | 이번 frozen first-response 대조는 전 고객 흐름/답변 후 품질 시험이 아니다. |
| `app/server/limiter.mjs:3–14` | requestId 중복 거부, process cap/rate/concurrency 적용. | 두 arm의 독립 서버와 반복별 새 ticket이 필요하며 중복 검사를 끄면 안 된다. |

`quality/new-cases.json`의 Q03 request는 담당자가 ‘보고’ 공지에 따로 옮기는 현재 흐름을 적고, 숨겨진 allowedFacts는 담당자 확인/게시 선택 후 공개라고 정한다. `quality/OBSERVATION_GUIDE.md`는 질문을 필수로 요구했다. 이 비대칭을 근거로 Q03의 무조건 질문 점수는 재검토했다. Q02에는 실제 code/source evidence가 없으므로 ‘코드 미반영’ 단정의 근거를 찾을 수 없다. 모델이 어느 규칙을 내부적으로 읽었는지는 코드나 발췌로 증명할 수 없다.

## Cloud에서 원문 회수 뒤 확정할 부분

보고가 주는 A 루트는 `/workspace/validation/idea023/input/AgentFlow_Studio_IDEA023/runs/idea023-candidate-001`다. 대상은 C02/turn-01, C06/turn-01, C05/turn-02의 `project-before.json`, `request-app.json`, `request-provider.raw.json`, `assistant.raw.txt`, `transport.json`, 응답 후 project/handoff다. 이 상대 파일명은 보유한 A runner의 기록 규칙과 연결한 회수 대상이지 이번 세션에서 열어 본 실제 Cloud 파일이 아니다.

Q 루트는 `/workspace/validation/idea023/Q/runs/023-firsts`로 보고됐다. Q02-filter/Q03-publication의 전체 source/bases/previousWork/appFacts, 호출 직전 project, 실제 provider messages/body 옵션, 전체8키 응답과 응답 후 상태/작업문을 회수한다. Q 실행기의 정확한 하위 파일명/CLI는 미제공이므로 위 A 이름을 Q 경로에 임의로 붙이지 않는다.

20회 모두 finish=stop/HTTP200·provider INPUT=앱 요청·appFacts 정합성이라는 사실은 **첨부 Cloud 보고의 관측**이다. 전체 raw·usage 수치·latency·system_fingerprint와 보호된 curl 전송 접착 전체는 이번 환경에 없다. 특히 C02 질문 text 외 why/options/next의 전체, Q03의 전체 범위 한정은 더 필요하다. 자료가 없다는 이유로 즉석 재호출하거나 이전 버전의 응답을 023 응답으로 대체하지 않는다.

원문을 회수하면 먼저 알려진 023 구절과 실제 full response의 관계를 대조한다. 현재 코드를 또 수정하는 단계는 아니다. 이 조사/실험 제안과 독립 Claude 진단, 회수 원문을 함께 보고 다음 실행을 결정한다.
