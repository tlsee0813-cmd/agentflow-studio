# 기존 Codex Cloud에 전달 — IDEA-013 첫 실제 비교

**이번 한 작업:** 이 묶음의 두 프롬프트로 개발용 6사례와 별도 Claude의 미공개 4사례를 비교하고 원문 결과를 반환하라. 기존 제품 코드는 변경하지 않는다. 새 제공업체 클라이언트·평가 플랫폼·예산 관리기를 만들지 않는다. 이미 승인된 DeepSeek 유료 호출이므로 키를 다시 요청하거나 승인을 다시 받지 않는다. 다른 채팅의 파일이 공유되어 있다고 가정하지 않는다.

## 1. 같은 실행 조건으로 20회

기존 Cloud에서 성공한 **deepseek-flash 설정과 비밀 주입 경로**를 찾아 재사용한다. 이 묶음은 그 모델명·사용 가능 여부를 검증한 것이 아니다. 현재 사용할 수 있는지는 Cloud가 확인한다. 별도 사전 유료 호출을 만들 필요 없이 첫 계획 요청을 그 확인에 사용할 수 있다. 사용할 수 없으면 실패를 남기고 이유를 보고하며, 다른 모델을 몰래 대신 쓰거나 성공했다고 기록하지 않는다.

두 전략에서 실제 모델·출력 한도·사용 중인 생성 설정·출력 모드를 같게 유지한다. 이번에 새로 지원 여부가 불명확한 파라미터를 추가하지 않는다. 기존 경로가 자동 재시도한다면 이 비교에서는 끈다. 실제 사용한 모델과 설정은 간단히 한 곳에 기록하면 충분하다. 가격 계산기·호출 승인 게이트·전후 해시 감사는 불필요하다.

`requests/development.jsonl`의 12행을 읽는다. 각 행의 **messages만** 기존 호출에 전달하고 메타데이터는 결과 연결에 사용한다. 독립된 초기 대화로 실행하여 한 전략의 응답이 다른 전략에 들어가지 않게 한다. 파일 순서는 사례마다 baseline/enhanced의 선후를 번갈아 둔 것이다.

별도 Claude가 제공한 미공개 **4개 고객 사례**는 Cloud에서만 추가한다. 다음 명령의 `CLAUDE_FOUR_CASES.json`은 Cloud가 실제 받은 파일 경로로 바꾼다. 해당 파일은 아래 입력 형태의 배열이어야 한다.

```sh
node scripts/assemble.mjs initial --cases CLAUDE_FOUR_CASES.json --out work/holdout.jsonl
```

입력 사례마다 `caseId`, `request:{id,text}`, `context:[{id,text}]`, `decisions:[{id,text,status,locked}]`, `materials:[{id,kind,text}]`를 둔다. `cases/development.json`과 같은 형태다. 없는 맥락·결정·자료는 빈 배열로 둔다. 새 사실을 보충하지 않는다. caseId는 개발용과 겹치지 않는 실제 ID로, 출처 ID는 사례 안에서 고유하게 둔다. status는 confirmed/proposed/deferred, kind는 note/code_diff/test_report/summary다. 기존 원문과 확인 상태를 바꾸지 않는다.

미공개 자료의 기대 관찰·정답·작성자 설명은 별도 보관하고 고객 입력으로 넣지 않는다. 4개가 아직 없으면 없는 상태를 보고하고 임의의 대체 4개를 만들지 않는다. **12 + 8 = 20회**의 첫 응답이 나올 때까지 프롬프트·계약·사례를 보고 고치지 않는다. 이는 작은 첫 품질실험의 크기이지 영구 상한이 아니다.

## 2. 성공도 실패도 원문부터 보존

각 requestId별로 기존 실행 경로의 응답 본문, assistant 텍스트 원문, 간단한 상태를 저장한다. 원문을 먼저 보존하고 그 뒤 JSON/계약을 확인한다. HTTP/제공업체 오류, 빈 응답, 출력 중단, JSON 오류, 계약 위반도 그 요청의 결과다. 자동 재시도·JSON 자동 수선·선별한 성공본 덮어쓰기를 하지 않는다. 비밀키나 인증 헤더는 결과 묶음에 넣지 않는다.

가벼운 저장 예: `results/<requestId>/response.json`, `assistant.txt`, `status.json`. 상태에는 requestId, 성공/오류 종류, 알 수 있는 HTTP 상태·종료 사유·오류 내용을 남기면 충분하다. 본문이 없으면 없는 이유를 적는다. 제공업체가 이미 돌려주는 사용량은 그대로 남겨도 되지만 별도 과금 측정 기능은 만들지 않는다. 이 묶음의 조립 코드는 API 결과를 저장하는 실행기가 아니므로 실제 보존은 기존 Cloud 경로에서 수행한다.

필요하면 `scripts/assemble.mjs`의 `validateResponse(parsedOutput, caseData, answerOrNull)`을 로컬 검사에 사용한다. 초기에는 마지막 인자를 생략한다. 의미 품질 자동 채점기가 아니며 잘못된 결과를 수정하지 않는다. 구조 실패도 `review/COMPARISON.md`의 원래 행에 남긴다.

## 3. 필요할 때 후속 약 4회

첫 결과를 보고 실제로 질문이 나온 사례에서 약 두 사례 × 두 프롬프트의 후속을 고려한다. 선택 이유를 적고, 양쪽의 실제 질문에 맞는 명시적 시험답변을 각각 작성한다. A/B라는 글자가 아니라 같은 고객 의도가 전달되는지 맞춘다. 한쪽이 질문 없이 진행했다면 없던 질문이나 답변을 만들어 쌍을 강제하지 않는다. 이 경우 실행 수가 달라도 그대로 보고한다.

`examples/followup-answer.template.json`을 새 파일로 복사해 채운다. `origin=test_answer`, `providedBy=실제 작성 주체(예: Cloud 시험담당)`, `kind=answer/defer/unknown`, `inReplyTo=실제 첫 응답의 decision.question 원문`, `text=명시적으로 작성한 답변`을 둔다. **실제로 고객에게 받은 답변만** customer_answer로 표시한다. 모델/시험 담당자가 쓴 답변을 사람이 실제 말한 것처럼 기록하지 않는다. 이 묶음에는 미리 작성한 고객 답변이 없다.

아래 경로와 requestId는 실제로 저장한 것에 맞춘다.

```sh
node scripts/assemble.mjs followup --requests requests/development.jsonl --id DEV-01.baseline.t1 --assistant results/DEV-01.baseline.t1/assistant.txt --answer work/DEV-01.baseline.answer.json --out work/DEV-01.baseline.followup.jsonl
```

조립기는 첫 두 messages와 assistant 원문을 그대로 유지하고 답변 데이터 하나만 붙인다. 질문 불일치·빈 답변·잘못된 JSON·계약 오류는 거절하고 자동 재호출하지 않는다. 질문이 없거나 실패한 초기 응답에 가상의 질문을 보충하지 않는다. 기존 실패는 보존하고, 별도 오류복구 실험이 필요하면 다음 실험으로 구분한다. 후속은 이전과 같은 모델·계약을 사용한다.

## 4. 반환과 다음 판단

실제 사용 설정 한 건, 시도한 모든 요청의 원문/실패, 별도 4사례의 실제 입력, 작성한 시험답변과 후속 결과, 사람이 읽을 비교표를 같은 결과 묶음으로 총괄에 반환한다. 평가자가 아직 읽지 않았다면 품질 판정은 미평가로 남긴다. 모델 자기평가를 사람 비교로 대체하지 않는다.

개발용 관찰은 `review/DEVELOPMENT_OBSERVATIONS.md`, 빈 비교표는 `review/COMPARISON.md`에 있다. 불필요한 질문, 편향된 선택지, 중요한 누락, 기존 확정 침범, 실제 서비스 검증을 과장하는 표현을 함께 본다. 기본안이 충분하거나 개선안이 낫지 않다는 결과도 그대로 보고한다. 좋은 20개 응답만으로 제품효용이 입증되는 것은 아니며, 결과를 보고 다음 개선이나 방향 변경을 결정한다.
