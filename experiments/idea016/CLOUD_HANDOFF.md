# IDEA016 rev1 — Cloud 첫 실제 baseline 실행

현재 대상은 `source/app/continuity`다. INIT 앱, IDEA014 prompt 비교 도구, 과거 gate/원장은 실행하지 않는다.
제품 코드 수정, prompt 변경, 가격 계산, 원격 쓰기, 재승인 문서, 자동 재시도는 이번 실행에 없다.
사용자는 DeepSeek 유료 호출을 승인했다. 키는 준비된 서버 비밀 주입만 사용하고 출력/열람/채팅 공유하지 않는다.

## rev1 기록 보호 — 실행 방법은 유지

`EXPERIMENT_SECRET_ECHO`는 제품 오류와 구별되는 **실험 관측 경계의 보호 오류**다. 파싱된 앱 응답의
키 반향은 receive 전에 차단한다. literal·JSON escaped·Unicode escaped 반향은 raw/provider/app/assistant와
파생 프로젝트·checkpoint·handoff·보고서에서도 전체 표식으로 가린다. 키 일부를 진단 증거로 출력하지 않는다.
앱 HTTP 200이어도 실험은 failed일 수 있으므로 transport.json의 observationProtection을 함께 읽는다.
이때 배치를 중단하고 보호된 기록을 그대로 회수한다. 재시도·fallback·JSON 수리·failed resume는 하지 않는다.
이 보호는 원본 provider 수정이나 전수 보안 감사가 아니다. 원본 169개와 사례·prompt·gate·원장은 불변이다.

## 1. 제공본을 그대로 빌드하고 첫 배치

압축을 푼 최상위 폴더에서 다음을 실행한다. 기존 Cloud의 모델/시간초과/토큰 설정을 임의로 개선하지 않는다.

```sh
cd source/app
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm run build
node continuity/scripts/check.mjs
node continuity/scripts/build.mjs
cd ..
mkdir -p ../runs
AI_MODE=deepseek ALLOW_PAID_AI=true node experiments/idea016/run.mjs run --mode live --out ../runs/live-baseline-001
```

새 도구의 무상 자체 확인이 필요할 때만 같은 source/에서:

```sh
DEEPSEEK_API_KEY= ALLOW_PAID_AI=false node --test experiments/idea016/tool.test.mjs
```

`evidence/mock-smoke`는 rev0 때의 무상 기록으로 그대로 보존되어 있다. rev1의 새 기록 보호 회귀는
`evidence/rev1/focused/`와 `evidence/rev1/after.tap`에 있다. 어느 쪽도 실제 DeepSeek 품질 결과가 아니다.
전체 도구 검사를 반복하지 않고 새 보호만 확인하려면 위 명령에 `--test-name-pattern='IDEA016 rev1'`을 추가한다.
실호출 명령·승인 상태·설정·질문별 합성 답변 절차는 변경하지 않았다.

## 2. 실제 질문에만 합성 답변

`../runs/live-baseline-001/REPORT.md`를 읽는다. awaiting-answer인 사례의 마지막 turn 폴더에서
pending-question.json과 answer.template.json을 읽는다. 실제 질문이 묻는 값만 사례의 allowedFacts에서 선택한다.
예상했던 질문이 아니라 실제 질문에 맞춰 factIds를 고르고 relevance를 짧게 쓴다. 허용 값이 없거나 의미가 맞지 않으면
멈춘 그대로 회수한다. 모르는 중요 값을 임의 확정/삭제/보류하거나 다른 질문의 답을 강제로 넣지 않는다.

템플릿의 caseId/turn/questionSha256/inReplyTo를 바꾸지 않은 복사본을 저장한 뒤:

```sh
node experiments/idea016/run.mjs resume --run ../runs/live-baseline-001 --case C02 --answer ../runs/c02-answer.json
```

C02는 예시 위치일 뿐 질문이 거기에서만 나올 것을 가정하지 않는다. 다른 사례는 해당 ID/실제 질문 템플릿을 쓴다.
모든 후속 합성 답은 앱의 test_answer 출처다. 관련성 판단은 Cloud 운영자의 해석이며 자동 의미 검증으로 보고하지 않는다.
다시 질문이 나오면 남은 3회 상한 안에서 같은 절차를 적용한다. 상한에 도달하면 budget-ended로 회수한다.
실패나 중단은 재실행하지 않는다. report 명령은 결과만 다시 읽고 모델을 호출하지 않는다.

## 3. 품질을 읽고 원본 결과 폴더 회수

```sh
node experiments/idea016/run.mjs report --run ../runs/live-baseline-001
```

사례별 `human-review.md`에 짧게 적는다. 최소 질문으로 바로 쓸 작업문인가, 중요한 모호함을 숨겼는가,
수동값/기간 변경/돌아온 보고를 제대로 구별했는가, 최종 작업문을 사용자가 얼마나 다시 고쳐야 하는가를 본다.
JSON 유효성과 처리 상태 complete를 품질 합격으로 쓰지 않는다.

C06은 local basis 전문 → 실제 provider 본문 → 응답 → handoff를 비교한다. 이전 AI 문구가 제약을 재진술해 전달했는지도
읽는다. 원문 문자 미출현을 곧바로 의미상 미전달로 보지 않는다. 해당 마지막 단계가 실행되지 않았으면 그 사실을 표시한다.

run.json과 모든 사례 폴더, 채운 합성 답변 파일을 함께 반환한다. response/assistant/handoff/checkpoint 파일을 수리하거나
실패 기록을 빼지 않는다. 기존 서버 비밀은 어떤 회수 파일에도 넣지 않는다. 실제 호출 수는 transport 기록 기준으로 적고
중단 때문에 기록이 없으면 호출 여부 미확인으로 남긴다. 첫 결과를 받은 뒤에만 Pro에서 prompt/문맥 개선을 시작한다.
