# INIT-007A — 고정 고객의 HTTP 2턴 평가 골격

## 무엇을 실행하는가

6명의 고정 한국어 **가상 고객**마다 독립된 프로젝트를 만들고, 각 프로젝트의 같은 ID·누적 상태로 최대 두 번 생성한다. 첫 생성은 기존 `createApp`의 로컬 HTTP `/api/interview`, 제공업체는 기존 **명시적 mock**이다. 검증된 실제 첫 질문을 읽고 별도 답변 JSON을 작성한다. 공통 `answerQuestion`/`reviseAnswer`로 답변을 적용한 뒤, 명시적 `next`에서 둘째 HTTP 생성과 실제 요약·요구 항목을 확인한다.

미리 정한 질문을 넣지 않는다. fixture에는 고객의 사실·직접 선택·미정·잠금·기대 변화만 있다. p04의 기존 잠금은 **합성 초기 상태 seed**이며 과거 HTTP 대화가 아니다. 질문이 없으면 `question_absent`로 끝나고 둘째 요청을 보내지 않는다. 실제 나오지 않은 저장·충돌 분기는 `unevaluated`다.

현재 도구는 `codex-only / claude-only / mixed / undecided`, 고객이 설계하는 서비스의 저장 선택은 `browser-only / multi-device / undecided`로 분산한다. 고객의 저장 선택을 AgentFlow Studio의 클라우드 기능으로 구현하지 않는다. 구독 한도·API 크레딧·예산·실행 권한을 만들지 않는다.

## 실행

`source/`가 프로젝트 루트다. Node 22.16.0 / npm 10.9.2 / TypeScript 5.8.3을 사용한다. 기존 build는 정확한 5.8.3 PATH 컴파일러의 오프라인 경로도 지원한다. 그것은 `npm ci` 성공과 다르다. 새 의존성·package/lock 변경은 없다.

```sh
npm run check
npm run build
AI_MODE=mock ALLOW_PAID_AI=false node scripts/init007a/run.mjs --mock --out /tmp/agentflow-007a-review
```

Windows PowerShell에서는 아래와 같이 프로세스 환경을 명시한다. 사용자/시스템 환경설정을 변경하는 명령이 아니다.

```powershell
$env:AI_MODE='mock'; $env:ALLOW_PAID_AI='false'
node scripts/init007a/run.mjs --mock --out "$env:TEMP\agentflow-007a-review"
```

한 명만 확인하려면 `--persona p01`을 붙인다. `--out`은 **아직 없는 새 디렉터리**여야 한다. 기존 결과에 덮어쓰기·자동 resume하지 않는다. CLI 인자에 `--mock`이 없거나 live/endpoint/credential 인자가 있으면 실행하지 않는다. 제품의 기본값은 바꾸지 않았으며, `npm start` 단독 실행은 이 평가 방법이 아니다.

각 고객의 첫 생성 후 `review.md`, `question.json`, `answer-template.json`, `session.json`이 저장된다. `answer-template.json`을 별도 `answer.json`에 복사한다. template 파일 자체는 상태가 바뀔 때 갱신되므로 답변 파일로 편집하지 않는다. `question.json`의 **실제** 질문·예시·선택 결과와 `fixtures/init007a/personas.json`의 해당 고객 사실을 읽고 답한다.

답변 형식은 다음과 같다. ID·버전은 예시값을 사용하지 말고 방금 만들어진 template에서 유지한다.

```json
{
  "schemaVersion": "init007a.answer.1",
  "personaId": "p01",
  "projectId": "방금 생성된 프로젝트 ID",
  "baseVersion": 4,
  "questionId": "실제로 받은 질문 ID",
  "answers": [
    {
      "factIds": ["F-core"],
      "optionId": null,
      "disposition": "answered",
      "text": "해당 고정 사실에 근거하여 실제 질문에 답한 내용"
    }
  ]
}
```

`baseVersion: 4`는 설명용 예시이며 고정값이 아니다. `optionId`는 실제 질문의 선택지 ID 또는 직접 입력의 `null`만 사용한다. `unknown`/`deferred`에서는 `optionId:null`이어야 한다. 한 파일의 `answers`는 1~3개이며, 첫 답변 뒤 행은 같은 질문에 대한 **수정**이다. 추가 대화 턴이나 생성 호출이 아니다. 고정 사실로 답할 수 없는 실제 질문에는 사실을 지어내지 말고, 정해진 미정 사실을 근거로 unknown/deferred를 작성하여 인간 검토에 남긴다. factIds 검증은 의미 일치나 내용 품질을 증명하지 않는다.

CLI에 다음을 입력한다.

```text
answer /absolute/path/answer.json
next
```

`answer`는 파일 읽기·JSON·문맥·선택지·길이·공통 상태 검증만 수행한다. 실패하면 기존 상태와 원본 파일을 유지하고 HTTP 요청을 보내지 않는다. 파일을 고쳐 다시 `answer PATH`를 입력한다. 이미 유효하게 저장한 답을 고칠 때는 최신 template의 baseVersion을 사용한다. 명시적인 `next` 전까지 둘째 호출은 없다. 이미 성공·실패·시도 중인 생성은 재실행하지 않는다.

입력 길이는 기존 계약의 UTF-16 code units 기준 최대 1500이다. 선택지는 공통 함수가 label과 consequence로 정규화한다. 사용자가 제출한 text와 실제 저장된 답변은 모두 증거에서 구분한다. 유효한 긴 직접 입력의 앞뒤 공백과 원문을 보존한다. p05의 1490자 문장은 경계 검증용 합성 반복문이며 자연스러운 고객 답변 품질의 근거가 아니다.

## 충돌과 항목 확인

실제 충돌이 생겼을 때 `session.json` 또는 `review.md`의 requirement ID로 미리보기한다.

```text
preview 실제_REQUIREMENT_ID apply
cancel
preview 실제_REQUIREMENT_ID apply
confirm
next
```

`keep`도 지원한다. `cancel`은 프로젝트 상태를 바꾸지 않는다. `confirm`은 기존 `confirmSelectionResolution`을 호출하며 요구·완료 조건 쌍을 적용하고 ID·잠금·이전 출처를 유지한다. 미리보기가 열려 있으면 `next`는 거절한다. 미해결 충돌 자체의 제품 보호 동작은 변경하지 않았다.

둘째 결과 또는 `question_absent` 결과를 읽은 뒤 항목별로 상태를 결정할 수 있다.

```text
decide 실제_REQUIREMENT_ID confirmed
done
```

`proposed / confirmed / deferred / rejected`를 지원하며 실제 `decideRequirement` 보호를 재사용한다. 이는 **합성 테스트 운영자의 명시적 항목 확인**이지 AI 품질 PASS나 실제 사용자 승인, 운영 실행 승인으로 표시하지 않는다. `done`은 현재 고객을 마치고 다음 고객으로 진행한다. `stop` 또는 EOF는 현재 기록을 남기고 종료한다. 프로세스 재시작 복구는 구현하지 않았으므로 종료 후 기존 결과를 입력하여 첫/둘째 생성을 반복하는 방법은 제공하지 않는다.

## 증거와 한계

`session.json`은 첫·둘째 생성의 요청 ID/버전, **검증 통과한 envelope만**, 공통 함수 적용 후 질문, 답변·수정 전후 상태, 원문 출처, 충돌 취소/확인, 항목 확인을 보존한다. `review.md`는 질문 이유·예시·선택 결과, 실제 요약, 전후 요구·완료 조건·출처·상태를 사람이 읽을 수 있게 묶는다. 저장은 요청 전 시도 상태를 기록한다. 저장 실패나 프로세스 중단 후의 자동 재요청은 없다. 운영급 영속 원장·트랜잭션·동시 실행·재시작 복구는 이 단계의 범위가 아니다.

거절된 provider 원문·reasoning·headers·동적 예외 메시지를 기록하지 않는다. 기존 INIT006 `safeDiagnostic`의 고정 진단만 사용한다. 성공한 계약 검증이 내용의 사실성·적절성을 보증하지는 않는다.

내용 품질 상태와 rubric의 각 항목은 모두 `human_review_pending`이다. rubric은 기존 정보 재질문, 핵심 구체화, 질문의 쉬움·부담, 답변의 요구/완료 조건 반영, 제안·확정·미정, 보류·잠금·출처, 도구·고객 서비스 저장의 일관성을 다룬다. 기계 검사 결과를 내용 품질 PASS로 바꾸는 로직·자기 점수는 없다.

테스트는 실제 HTTP 응답을 받은 **후** 고정 사실과 실제 선택지 ID로 답변 JSON을 작성한다. 이 응답 작성은 명시적 합성 테스트 작성자다. 사람이나 실제 모델과 대화했다고 보고하지 않는다. 예외/거절 저장경계 검사는 별도 `mock-test-double`로 표시하며 실제 provider HTTP 거절 실험과 혼동하지 않는다.

## 좁은 검증 명령

```sh
AI_MODE=mock ALLOW_PAID_AI=false node --test tests/eval-init007a.test.mjs
AI_MODE=mock ALLOW_PAID_AI=false node --test tests/domain.test.mjs tests/conflict-resolution.test.mjs
AI_MODE=mock ALLOW_PAID_AI=false node --test --test-name-pattern='^(R1\.|R2\.(1 |2 |3 |5 )|R3\.[12345] )' tests/regressions.test.mjs
```

새 HTTP 검사는 한 createApp/한 limiter로 6개 사례를 순차 실행한다. 정상 경로는 p02의 질문 부재 때문에 **11번**이며 모든 시작 간격은 최소 12000ms다. 기존 `6/min`, `process cap 20`, `concurrency 2`는 그대로다. 429 재시도·프로세스 재시작 우회를 하지 않는다. 추가 장애 검사는 실제 HTTP가 아닌 명시적 adapter double이다. 위 기존 회귀 선택은 rapid HTTP·확장 limiter 사례와 simulated DeepSeek를 제외하고 공통 상태 관련 검사만 실행한다.

INIT005/006 CLI·실험은 실행하지 않는다. 기존 parity/전체 브라우저/178 전체 테스트의 기존 성공 기록을 이번 실행 실적으로 재사용하지 않는다. 실제 실행 결과와 최종 상태는 패키지 `verification/` 및 `README_HANDOFF.md`를 기준으로 읽는다.

## 007B 경계

`generate(session, transport, persist)`와 `openMockHttp()`가 작은 교체 경계다. 007A는 `mock-http`와 명시적 단위검사 double만 허용한다. 실제 provider 연동, credential/preflight, 승인/비용 원장, 네트워크 secret 연결, 중단 복구와 안전한 real 실행 CLI는 007B에서 별도 설계·총괄 검토한다. onTelemetry 연결도 추가하지 않았다. 현재 파일을 수정 없이 live 실행할 수 있다고 주장하지 않는다.
