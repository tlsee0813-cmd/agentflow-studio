# INIT-007B — 기존 Cloud 인계 명령

총괄의 B 독립 검토 뒤 한 기존 Cloud 세션에만 이 run ID를 배정한다.
기존 사용자 키 사용/필요 DeepSeek 비용 승인은 이미 주어졌다. 새 비용 승인을 사용자에게 다시 묻는 절차가 아니다.
아래 review hash와 session 배정은 코드/실행 통제를 위한 총괄 인계다. Pro에서는 live를 실행하지 않았다.

## 1. FULL SOURCE와 무상 확인

받은 ZIP의 `source/`를 작업 루트로 사용한다. Git/DNS 복원, 기존 005/006 overlay, 첨부 patch를 다시 적용하지 않는다.
ZIP SHA256와 MANIFEST.sha256를 먼저 대조한다. dist/node_modules는 포함하지 않는다.

```sh
cd /받은_폴더/AgentFlow_Studio_INIT007B/source
node --version       # v22.16.0
npm --version        # 10.9.2
npm ci               # Cloud에서 1회. DNS 차단이면 반복 복원/재설치하지 말고 로그와 차단을 전달.
npm run check
npm run build        # TypeScript 5.8.3 필수. PATH compiler 대체 사용이면 ci 성공으로 표시하지 않는다.
AI_MODE=mock ALLOW_PAID_AI=false node --test --test-concurrency=1 tests/eval-init007b.test.mjs tests/http-init007b.test.mjs tests/http.test.mjs
AI_MODE=mock ALLOW_PAID_AI=false node scripts/init007b/run.mjs --plan > ../plan.json
```

plan의 sourceFingerprint는 SOURCE_MANIFEST.sha256의 SHA256와 일치해야 한다.
runtimeFingerprint는 빌드된 dist/public의 정렬된 `{path,sha256}` 목록을 compact JSON으로 해시한 값이다.
ZIP 최상위 RUNTIME_MANIFEST.json 및 verification/plan-final.json과 대조한다.
plan의 review 템플릿은 미확인 필드가 null/false다. 이를 자동 승인 값으로 복사하지 않는다.

mock/단위검사는 실제 env 키/계정을 읽지 않는다. 모의 upstream을 고정 주입하고 실제 app/provider adapter를 통과시키기 위해
격리된 메모리 config의 gate만 true로 만든다. **프로세스 ALLOW_PAID_AI=false**, 실제 네트워크 provider/유료 호출은 0이다.
이 모의 gate를 live 승인으로 사용하지 않는다.

## 2. CLI mock — 2단계 무상 리허설

고정 mock 원장은 `source/eval-results/init007b-mock`이다. 결과를 지우고 재실행하는 테스트로 기록을 덮지 않는다.
완료한 단계는 no-op, 중단한 단계는 거절된다. firsts 6 + 질문 있는 followups 최대 6만 존재한다.
Pro에서는 engine/slot/HTTP 경계를 검사했으며, 이 전체 CLI mock 리허설은 별도 Cloud 수용 항목이다.

```sh
AI_MODE=mock ALLOW_PAID_AI=false node scripts/init007b/run.mjs --mock
mkdir -p eval-results/init007b-mock-control
AI_MODE=mock ALLOW_PAID_AI=false node scripts/init007b/run.mjs --mock-questions > eval-results/init007b-mock-control/questions.json
AI_MODE=mock ALLOW_PAID_AI=false node scripts/init007b/run.mjs --mock-answer-template > eval-results/init007b-mock-control/answers.json
```

작업자가 questions.json을 실제로 읽고 고정 persona 사실로 answers.json을 작성한다.
다른 채팅의 질문, 미리 만든 가짜 질문, 새 사실, 자동 응답자 모델을 쓰지 않는다.
`factIds`가 존재하는지 검사는 의미 충실성을 보증하지 않는다. 관련 사실이 없으면 action=skip,
answerDocument=null, resolutionActions=[]로 명시한다. 숫자를 채우려고 호출하지 않는다.

```sh
AI_MODE=mock ALLOW_PAID_AI=false node scripts/init007b/run.mjs --mock-followups
AI_MODE=mock ALLOW_PAID_AI=false node scripts/init007b/run.mjs --mock-collect > ../mock-review.md
AI_MODE=mock ALLOW_PAID_AI=false node scripts/init007b/run.mjs --mock-items-template > eval-results/init007b-mock-control/items.json
# 실제 출력에서 항목 ID와 현재 state hash를 골라 items를 명시적으로 작성한 뒤:
AI_MODE=mock ALLOW_PAID_AI=false node scripts/init007b/run.mjs --mock-review-items
AI_MODE=mock ALLOW_PAID_AI=false node scripts/init007b/run.mjs --mock-collect > ../mock-review-with-items.md
```

items 행: `{personaId, stateHash, requirementId, status}`. status는 proposed/confirmed/deferred/rejected다.
확인할 수 없는 항목을 confirmed로 채우지 않는다. 선택한 항목만 결정하며 인간 품질 판정은 계속 pending이다.

## 3. 실제 실행 직전의 읽기 전용 확인

이 단계부터는 **총괄이 실행 배정한 기존 Cloud만** 수행한다. 승인된 Network-secret 환경을 그대로 사용하며
키를 붙여 넣거나 인자/파일/ZIP/로그로 옮기지 않는다. direct-secret, 새 host, TLS 해제, 환경 전체 출력은 금지다.

실제 기존 자료 루트는 `/workspace/validation/init006/source`다. 원본 source/ZIP/005·006 lock/report를 수정하지 않는다.
B는 필요한 기존 source 및 report/lock을 읽어 hash를 검사한다. 없으면 stop하며 synthetic 파일로 메우지 않는다.

공식 가격/모델 문서를 실행 직전에 다시 읽는다(README의 공식 URL). 총괄이 review.json의 실제 확인 시각/가격/지원/예약과
코드 지문을 검토하고 compact JSON.stringify 기준 review SHA256를 전달해야 한다.
source/runtime/fixture hash, projectSchemaVersion, sessionSchemaVersion, node, budget 등의 필드와 예산은 plan 템플릿 그대로 검토한다.
확인한 새 단가의 소수 3자리보다 정밀한 값을 지원하지 않거나 예산을 넘으면 실행하지 않는다.
review JSON hash는 파일 공백을 포함한 `sha256sum review.json`과 다르다. 계산 정의는 아래와 같으며, 자체 계산으로 총괄 검토를 대체하지 않는다.

```js
sha256(JSON.stringify(JSON.parse(reviewFileUtf8)))
```

control에 놓을 파일은 총괄이 검토한 `review.json`, 작업자가 읽고 작성할 `answers.json`/`items.json`뿐이다.
키 파일은 없다. `coordinatorReviewRef`는 실제 검토 결과를 식별하는 비밀이 아닌 64자리 hash다.
새 live 원장은 이 단계에서 미리 만들지 않는다.

```sh
mkdir -p /workspace/validation/init007b/control
# 검토된 review.json을 위 control 디렉터리에 전달. 실키/키 파일 전달 금지.
ALLOW_PAID_AI=false node scripts/init005/preflight.mjs --external --transport=curl-proxy > ../preflight-console.json
# 기존 keyless /models 진단만 실행. INIT005/006의 run.mjs를 실행하지 않는다.
```

생성된 `source/eval-results/preflight-curl-proxy.json`은 기존 날짜 검증을 통과해야 한다.
이는 인증·잔액·Network-secret 치환 확인을 의미하지 않는다. 첫 실제 generation이 이 경계를 확인한다.

## 4. firsts — 첫 6개 슬롯만

아래 환경 변수들은 **해당 자식 명령에만** 적용한다. `DEEPSEEK_API_KEY`는 기존 승인된 Network-secret placeholder로
이미 제공되어 있어야 한다. 여기서 실키를 쓰거나 환경값을 출력하지 않는다.
`<총괄_검토_SHA256>`를 총괄이 전달한 정확한 값으로 교체한다. 키/비용 재승인을 사용자에게 요구하는 것이 아니다.

```sh
env ALLOW_PAID_AI=true \
  AFS_INIT007_ASSIGNMENT=INIT007-KO-20261011-01 \
  AFS_INIT007_APPROVED_USD=0.25 \
  AFS_INIT007_CREDENTIAL=network-secret \
  AFS_INIT007_REVIEW_SHA256='<총괄_검토_SHA256>' \
  node scripts/init007b/run.mjs --firsts > ../live-firsts-summary.json
```

자식은 종료 시 ALLOW_PAID_AI를 해제하며 부모 환경을 변경하지 않는다. 일반 환경에서 paid=true를 export하지 않는다.
401/402/429/network/timeout/model/usage/finish/보호 오류나 중단 잠금이 생기면 바로 회수한다.
키를 바꿔 같은 슬롯을 다시 호출하거나 새 out/ID로 우회하지 않는다.
계약 거절만 안전 조건을 충족하면 나머지 **기존 예정 독립 case**를 진행할 수 있다. 원장에 분류가 남는다.

## 5. 질문 읽기 → 고정 사실 답변 → followups

```sh
ALLOW_PAID_AI=false node scripts/init007b/run.mjs --questions > /workspace/validation/init007b/control/questions.json
ALLOW_PAID_AI=false node scripts/init007b/run.mjs --collect > ../live-firsts-review.md
ALLOW_PAID_AI=false node scripts/init007b/run.mjs --answer-template > /workspace/validation/init007b/control/answers.json
```

실제 질문·이유·예시·선택 효과와 persona facts를 읽은 사람이 JSON을 작성한다. A의 지원 경계를 유지한다.
예: p03은 관련 저장 질문이 있을 때 unknown과 deferred 행을 작성할 수 있고,
p04는 실제 충돌에 대해서만 아래처럼 같은 상태의 취소/확인을 기록한다.

```json
[
  {"action":"preview","requirementId":"실제_저장된_요구_ID","choice":"apply"},
  {"action":"cancel"},
  {"action":"preview","requirementId":"같은_실제_요구_ID","choice":"apply"},
  {"action":"confirm"}
]
```

질문/요구 ID와 hash는 템플릿의 실제 값을 유지한다. 이 예시의 ID로 실행하지 않는다.
p05의 JSON/1501자 오류를 시험했다면 미호출 단계에서만 수정한다. 검증된 긴 답변과 수정은 같은 answer ID/출처 이력을 유지한다.
답변 파일 검증 오류는 원장 입력 이벤트만 남기고 generation을 하지 않는다. 이미 완료한 생성의 답을 고쳐 재생성하지 않는다.

```sh
env ALLOW_PAID_AI=true \
  AFS_INIT007_ASSIGNMENT=INIT007-KO-20261011-01 \
  AFS_INIT007_APPROVED_USD=0.25 \
  AFS_INIT007_CREDENTIAL=network-secret \
  AFS_INIT007_REVIEW_SHA256='<첫_단계와_동일한_총괄_검토_SHA256>' \
  node scripts/init007b/run.mjs --followups > ../live-followups-summary.json
ALLOW_PAID_AI=false node scripts/init007b/run.mjs --collect > ../live-followups-review.md
ALLOW_PAID_AI=false node scripts/init007b/run.mjs --items-template > /workspace/validation/init007b/control/items.json
# 실제 후속 출력과 state hash를 읽고 항목을 선택한 뒤, 생성 없이 명시 확인:
ALLOW_PAID_AI=false node scripts/init007b/run.mjs --review-items
ALLOW_PAID_AI=false node scripts/init007b/run.mjs --collect > ../live-review-final.md
```

항목 확인을 작성하지 않았으면 미확인으로 보고한다. 실제 고객 승인이나 사람 내용 품질 PASS로 바꾸지 않는다.
동일 단계 재실행은 no-op 또는 명시 거절이어야 하며 추가 generation이 없어야 한다.

## 6. 종료 회수와 수용 기준

회수 대상은 새 고정 live 원장의 journal/sessions/남아 있는 active.lock과 안전 summary/review다.
control 원본에는 미검증·문법 오류 입력이 남을 수 있어 자동 ZIP에 넣지 않는다. 검증된 답변/항목 결정은 session에, review 정체성은 원장 hash에 남는다.
control은 Cloud에서 읽기 전용으로 보존하고, 별도 전달이 필요할 때 총괄이 안전성을 확인한다.
기존 005/006 원장, env/키/개인 파일, node_modules/dist/.git은 회수 묶음에 복사하지 않는다.
검증된 보고서를 생성할 수 없는 손상 원장은 고치지 말고 그대로 별도 보존한다. 이 경우 quality report 생성 실패를 명시한다.
아래는 **읽기 전용 ZIP 회수** 예시이며 원본을 변경하지 않는다. 모든 이름은 고정 allowlist다.

```sh
python - <<'PY'
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from hashlib import sha256
root=Path('/workspace/validation/init007b/live/INIT007-KO-20261011-01')
out=Path.cwd().parent/'INIT007-KO-20261011-01-results.zip'
with ZipFile(out,'x',ZIP_DEFLATED) as z:
    for sub in ('journal','sessions'):
        for p in sorted((root/sub).glob('*.json')):
            if p.is_symlink(): raise RuntimeError('UNSAFE_PATH')
            z.write(p, 'INIT007-KO-20261011-01/'+p.relative_to(root).as_posix())
    lock=root/'active.lock'
    if lock.is_file() and not lock.is_symlink(): z.write(lock,'INIT007-KO-20261011-01/active.lock')
    for name in ('live-firsts-summary.json','live-followups-summary.json','live-firsts-review.md','live-followups-review.md','live-review-final.md'):
        p=Path.cwd().parent/name
        if p.is_file() and not p.is_symlink(): z.write(p,'INIT007-KO-20261011-01/reports/'+name)
print(out.name, sha256(out.read_bytes()).hexdigest())
PY
```

수용 기준: 정확한 코드/fixture/상태 identity, 첫 실제 질문 이후 같은 state의 후속, 12 고정 슬롯과 무재시도,
영속 12초/rolling6·앱20, durable 저장 실패 send0, 계약 case failure vs global halt, 이전 자료 불변,
관측 usage/model/finish/timing/비용 예약, rejected raw 미보존, 실제 항목 확인 및 미발생 분기/사람 검토 대기의 분리다.
HTTP·protocol·state 통과와 내용 품질을 따로 보고한다. 전체 CLI 무상 결과와 real 결과도 합치지 않는다.
원격 PR/main/배포/공개 게시를 실행하지 않는다.
