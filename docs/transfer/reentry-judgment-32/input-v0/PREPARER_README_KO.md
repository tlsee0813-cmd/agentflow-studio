# 32 입력 준비 — 관측자에게 먼저 전달하지 않는 설명

고정 계약은 checkpoint `4e45b99a424738dc0069dc688241b8e8fdd0d496`의 `docs/cycles/2026-10-23-reentry-judgment-32/INPUT.md`와 `RESEARCH.md`이다. 제품은 수정하지 않았다. 기존29와 같은 shared domain/schema를 컴파일한30 작업 폴더의 모듈을 읽었고, 실제 binding은 `VERIFY_V0.json`과 `generated-v0/preparer-artifacts/MODULE_BINDING.json`에 있다. Node24 작성자 보조이며 최종 통합 모듈/Node22 재검증은 별도다.

## 전달 분리

관측자 첫 단계에는 `generated-v0/observer-input/`의 정상 복구 파일 T0/T2와 목표 안내만 전달한다. `sealed-answer/`, 이 문서, 생성 코드, 원본 H 목록은 준비자용이다. 폴더 분리는 접근 통제가 아니며 완전 블라인드·사람 연구라고 부르지 않는다. 반복 PC에는 학습 전이가 있을 수 있다.

`sealed-answer/FACTS.json`은 정확한 소유·질문·설명 판본·조건·현재 작업·초안·H·보고·관계·좌표 표이다. 특정 부분을 선택하라는 정답이 아니다. B 외에도 실제 화면 근거로 정당화되는 판단을 허용하고, 근거가 없으면 판단 불가로 기록한다.

## 만들어진 자료의 사실

- 두 부모 아래 세 자식의 실제 포함 구조이며, 작업 단계→구현→검사 계층이 아니다. 관계도 공개 addRelation으로 따로 기록했다. 위치는 공개 moveArea로 만든 합성 배치다.
- A는10행→20행→20행 유지의 외부 설명 판본1/2/3이다. T0 후 직접 U/N만20으로 바꾸고 각각 새 실제 H/anchor로 판본2/3을 수신했다. 판본3의 changes는[]이고, 판본2 요약과 같다. 판본1과 당시 H 작업문은 보존된다. 원문과 서로 다른4값이 표에 있다.
- A는 헤더 처리 질문에 답했고 B는 중단/제외 질문에 답하지 않았다. 두 소유자의 기록 질문 수는 각각1이다. B의 설명은 T0/T2에서 동일하며 현재 유효하다. 공개 questionAnswered와 subtreeSignals로 A는 answered/답변 기록 있음, B는 active/제품 선택 항목 있음임을 T0/T2 모두 확인했다. A의 자료는 정상 answer API를 사용한 명시 합성 답변이며 실제 사용자 증언이나 시험 답변 API 기록은 아니다. B는 T0 이전부터 남은 순서상 오래된 질문이지, 며칠 전으로 날짜를 조작한 기록이 아니다.
- C는 조건 변경 전에 H를 만들고 직접 scope를 CSV 한정으로 고쳤다. 이 변화는 이미 T0에 있다. T2에서 원 H/basedOn의 늦은 설명을 수신하면 plan-changed 보류가 생긴다. 기존 설명 본문/판본1은 T0/T2 동일하지만 둘 다 이전 기준이며, 보류를 새 현재 설명이라고 하지 않는다.
- 현재 작업은 출력 부모의 별도 D, 미전송 요청 대상은 읽기 부모이다. A/C 수신 전후 D·초안·대상을 유지한다. T0/T2의 소속·좌표·관계·기준·기존 원보고와 H도 검사했다.

## 순수 생성과 재검증

`node generate.mjs`는 공개 domain 함수→검증된 합성 응답/return.2→parseProject만 사용하며 새 `generated-v0`가 이미 있으면 거절한다. UUID/시간을 교체하지 않는다. 생성 시 project 필드를 직접 덮거나 브라우저 storage/DOM에 쓰지 않는다. 합성 응답은 실제 begin/ticket과 receive 검증을 거친 mock envelope이며 유료 모델·AI 성과가 아니다.

`node verify.mjs --receipt REVIEW.json`으로 같은 자료를 다시 검사한다. 최종 통합 제품의 compiled shared 디렉터리가 준비되면 `--module-root <그 shared 디렉터리>`를 추가한다. 데이터/모듈을 재생성하거나 바꾸지 않고 parse·귀속·판본·질문·정확한 H/원보고·해시를 다시 확인할 수 있다. `node verify-signals.mjs --module-root <그 shared 디렉터리>`는 같은 질문 총수 안에서의 실제 answered/applicability/status와 C의 이전 기준 상태, 직접값 보존을 재대조한다. 결과는 준비자 전용 `sealed-answer/QUESTION_SIGNAL_PROOF.json`이다. source/dist/dependencies는 이 폴더에 복제하지 않는다.

관측자가 실제로 선택해 내보낸 H는 새 것이다. `make-return.mjs --handoff <실제 내보낸 md> --report-file <명시 합성 보고 txt> --out <새 json> [--project <현재 정상 백업>]`는 그 실제 템플릿의 T/H를 보존한다. 설명이 필요할 때만 `--summary-file`을 사용하며 기본은 description=null이다. 준비 자료의 예전 H를 관측자의 새 H 대신 쓰지 않는다. 이 보조 도구는 제품에 자동 수신하지 않는다.

## 남은 관측 경계

정상 복구 import는 동일 Project.id를 보존하고 workspace entryId를 새로 만든다. T0/T2는 별도 복구 사본이며 live 동기화가 아니다. 같은 Project.id의 탭 지도 편의 메모가 재사용될 수 있으므로 실제 첫 화면·entryId·카메라/선택을 관측에 적는다. 이를 지우거나 강제해 첫 화면을 꾸미지 않는다. 저장된 자료는 receivedAreas/Origin/last-read 같은 탭 상태를 만들어 주지 않는다.

제품에 없는 마지막 열람 비교나 unread를 이 사실표에서 발명하지 않는다. 현재 설명/받은 보고/남은 판단은 다르다. 브라우저·서버·복구 UI·fit·클릭·사람 이해·실제 AI/구현은 실행하지 않았다.30/31의 최종 수용과 정확 통합 소스 고정 뒤에만32 UI 관측을 진행한다.
