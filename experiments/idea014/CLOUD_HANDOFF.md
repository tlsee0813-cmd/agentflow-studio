# IDEA014 rev1 — 기존 Codex Cloud 실행 인계

rev1은 실호출 전 발견된 명시 변경의 재승인 오류만 수정했다. 이 묶음의 두 프롬프트·공통 계약·검증기·새로 조립한 요청을 함께 사용한다. 출력 `schemaVersion`은 `idea014.v2`를 유지하고 notes.kind에 `change`를 추가했다. `requested+change`는 이미 받은 고객지시의 기록이지 새 승인 절차나 외부 실행 권한이 아니다. 이전 미수정 IDEA014의 생성 요청과 섞지 않는다. 조립기 코드는 변경하지 않았고, 원본 요청 일치 검사도 유지한다.

## 범위와 비교

기존 DeepSeek 연결과 비밀 주입을 그대로 사용한다. 새 클라이언트·키 입력·예산관리기를 만들지 않는다. **기존에 성공한 deepseek-flash 설정을 재사용하되 실제 가용성은 Cloud가 확인한다.** 모델/별칭이 안 되면 오류를 보존해 알리고 몰래 다른 모델로 바꾸지 않는다. 양쪽 전략에 동일한 기존 모델·출력 한도·샘플링·응답 형식 설정을 적용하고 변경하지 않는다. 별도의 파라미터를 이 자료가 새로 정한 것은 아니다.

이번 첫 비교는 **기존 10사례+새 미공개 4사례 × 두 전략 = 28회**다. 필요하면 실제 첫 질문에 연결한 후속 약 4회를 더한다. 이 숫자는 작은 품질 실험의 크기이지 영구 호출 상한이나 가격 걱정이 아니다. 기존 IDEA013/앱/옛 원장은 그대로 둔다. 원격쓰기·병합·운영 배포는 하지 않는다.

## 입력 조립

이 디렉터리에 `cases/existing-10.json`과 준비된 `requests/existing-20.jsonl`이 있다. 이전 Claude 4사례도 이제 공개 개발자료다. 새 미공개 4사례는 별도로 받아 **모델 입력만 있는 배열**로 준비한다. 각 객체는 `caseId, request, context, decisions, materials`이며 세부 형태는 기존 사례와 같다. 평가 메모는 별도 파일로 보관한다. 빈 decisions/materials도 배열로 둔다. 기존과 중복되지 않는 caseId가 필요하다.

경로 자리표시자 NEW4.json, RUN/는 실제 받은 파일과 새 실행 디렉터리로 바꾼다.

```sh
node --test scripts/structure.test.mjs
node scripts/assemble.mjs initial --cases cases/existing-10.json --cases NEW4.json --out RUN/first-28.jsonl
```

조립 수 28개와 14사례 × baseline/enhanced 한 개씩을 확인한다. 요청마다 독립 대화를 사용하고, JSONL 각 행의 **messages만** 기존 호출 경로에 전달한다. requestId 등은 기록용 메타데이터이지 고객 입력이 아니다. system에는 전략+공통 계약, user에는 같은 원본 사례만 있다. 기대답·관찰 메모·과거 응답·CUSTOMER_WORDING.md는 보내지 않는다. 생성된 28개를 한 비교로 고정하고 중간 결과에 맞춰 프롬프트를 고치지 않는다.

## 응답과 실패 보존

모든 요청의 requestId, 실제 assistant 본문과 기존 경로가 제공하는 HTTP/종료 상태, 오류를 새 실행 위치에 저장한다. 보안 정보·인증 헤더는 저장하지 않는다. 응답을 검사 전에 고치지 않는다. 자동 재시도·JSON 수선·코드펜스 제거·성공본으로 덮어쓰기는 하지 않는다. 실패한 항목도 첫 비교의 분모와 읽기 자료에 남긴다.

본문이 있는 응답은 다음처럼 검사한다. ID는 해당 행의 실제 requestId다.

```sh
node scripts/assemble.mjs check --requests RUN/first-28.jsonl --id IDEA014.DEV-02.baseline.t1 --assistant RUN/DEV02-baseline-raw.txt --out RUN/DEV02-baseline-check.json
```

pass의 종료코드는 0, 검사 실패는 1이며 실패 이유도 새 check 파일에 저장한다. 이는 비교 항목 하나의 실패이지 다른 첫 요청 결과를 숨기거나 재시도하라는 신호가 아니다. HTTP 실패 등 assistant 본문이 없으면 그 사실을 기록하고 내용을 만들어 검사하지 않는다. 검증기는 의미 품질을 판정하지 않는다. 기존 v1 응답은 v2로 재채점하거나 자동 변환하지 않는다.

## 후속 약 4회

적합한 실제 첫 질문에서 가능하면 두 사례×두 전략으로 선택한다. 명시 선택과 모르겠음/보류·범위 제한을 볼 수 있으면 유용하지만 예상한 질문이 안 나오면 억지로 맞추지 않는다. **실제 질문에 답이 되는 명시적 시험답변**을 사람이 작성한다. 같은 의도라도 각 질문을 읽고 맞춰야 한다.

`examples/followup-answer.template.json`을 별도 파일로 복사해 제공자·inReplyTo·text를 채운다. inReplyTo는 실제 decision.question 그대로다. 시험은 origin=test_answer, kind는 answer/defer/unknown 중 실제 답변에 맞춘다. 실제 사람이 제공하지 않은 답을 customer_answer로 표시하지 않는다. 빈칸이나 질문 불일치는 조립기가 거절한다.

```sh
node scripts/assemble.mjs followup --requests RUN/first-28.jsonl --id IDEA014.DEV-01.baseline.t1 --assistant RUN/DEV01-baseline-raw.txt --answer RUN/DEV01-baseline-answer.json --out RUN/DEV01-baseline-followup.jsonl
```

이 명령의 사례는 사용법 예일 뿐이다. 해당 실제 첫 응답에 적합한 질문이 없으면 다른 유효한 질문을 고른다. 첫 계약이 깨진 응답은 원형대로 보존하고 자동수선해서 후속을 만들지 않는다. 조립기는 첫 대화 뒤 한 번의 후속만 허용한다. 후속 검사는 --requests에 해당 후속 JSONL, --id에 그 t2 ID를 주는 같은 check 명령을 쓴다.

## 읽기와 반환

`review/OBSERVATIONS.md`로 모든 쌍을 읽고 구조 결과와 문장 품질을 따로 기록한다. 첫 비교와 후속, 기존 10과 새 4를 구분한다. 구조통과 수만 아니라 **실제 고객에게 보여 줄 문장과 선택 경험이 어떻게 나아졌거나 나빠졌는지** 짧은 근거를 남긴다. 판별이 안 되면 그렇게 적는다. 비가림/합성이라는 한계를 유지한다.

총괄에게 실제 요청·응답/실패·검사 결과·명시 시험답변·짧은 쌍별 판단을 회수 가능한 묶음으로 반환한다. 선별된 성공본만 반환하지 않는다. 장황한 날짜·해시·가격 감사나 논문식 평가는 추가하지 않는다. 결과를 보고 다음 수정이나 더 단순한 제품 방향을 판단한다.
