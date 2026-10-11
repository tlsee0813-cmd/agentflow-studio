# 총괄 검토 후 Cloud 배정 — C2 진단 시험 한 번만

이 파일은 실행 절차다. **이 Pro 세션은 키·유료 호출을 사용하지 않았다.** 사용자는 프로젝트의 DeepSeek 실호출/비용 사용을 승인했으나, 이번 새 시험은 총괄이 변경본과 무상 결과를 검토한 뒤 직접 배정한다. 기존 6회 배치 재개·C1 재호출·C3~C6 실행이 아니다.

## 1. 정확한 변경본과 무상 검사

새 격리 체크아웃을 `4caa0914d4520c76cdd0380bbb1a3c1941ab0451`에 둔다. 원본 작업 공간을 reset/clean하지 않는다. 이 ZIP의 누적 패치를 한 번만 적용한다. **INIT-005 ZIP을 먼저/다시 적용하지 않는다.** `apply_overlay.py`와 SHA256/manifest로 검사한다. byte 비교를 위해 격리 저장소만 `core.autocrlf=false`로 준비한다. 원격 쓰기·병합·배포 금지.

Node 22.16.0 / npm 10.9.2, 키 없는 상태에서:

```sh
export AI_MODE=mock ALLOW_PAID_AI=false
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm test
node scripts/init006/run.mjs                         # 기본 plan; API 요청 0
node scripts/init006/run.mjs --mock                 # C2만 모의 1회; 유료 요청 0
```

명령별 종료 코드를 확인한다. 기대 Node 178/178; 브라우저는 기존 `tests/browser.py`의 direct-http 경로로 Cloud에서 확인한다. Pro 환경의 npm DNS/브라우저 정책 차단을 Cloud 성공으로 가정하지 않는다. mock의 validated는 AI 품질 판정이 아니다.

검토한 소스+실행 JS fingerprint는 아래다. 계획 파일의 해시를 새로 읽어 자동 승인하지 말고 **총괄이 검토한 이 값**과 비교한다. mismatch면 코드/빌드 차이를 보고하고 멈춘다.

```
a47484ece376bac0b228c473869c9aaac1e5d793cfa542e090acf5ed14f7dbc6
```

## 2. 이전 증거 보존·키 없는 preflight

동일한 지속 작업 공간에 이전 `eval-results/init005-live/run.lock`와 `report.json`을 **원본 그대로** 보존한다. 격리 체크아웃으로 옮길 때는 이전 eval-results 전체를 안전하게 인계해 기존/새 잠금 누락으로 실행 권한이 되살아나지 않게 한다. 자료가 없으면 만들어 채우거나 이전 보고서를 재생성하지 않는다. 새 도구는 이전 두 파일이 없으면 차단하고 읽기 전용 해시로 변경 여부만 비교한다.

새 목적 `INIT006-C2-DIAGNOSTIC`, 고정 실행 ID `INIT006-C2-20261011-01`을 총괄 장부에 한 번만 배정한다. 새 전용 경로는 `eval-results/init006-c2-diagnostic/`다. 기존 또는 새 `run.lock`은 성공·실패·취소·프로세스 종료에도 삭제하지 않는다. CLI는 case/limit/id/reset/resume/재시도 옵션 및 live output 재지정을 지원하지 않는다. 잠금은 해당 지속 파일시스템에서 유효하며, 별도 clone/Cloud 작업 간 전역 잠금은 아니다. 다른 작업 공간에 같은 ID를 중복 배정하지 않는다.

실제 사용할 transport/runtime에서 실행한 24h 이내 키 없는 외부 preflight가 필요하다. 기존 결과를 덮어쓰지 않고 새 파일로 저장하는 예:

```sh
node --input-type=module <<'JS'
import { externalProbe } from './scripts/init005/preflight.mjs';
import { writeFileSync } from 'node:fs';
try {
  const r = await externalProbe('curl-proxy'); // Authorization 없음, GET /models만
  writeFileSync('eval-results/init006-c2-preflight.json', JSON.stringify(r,null,2)+'\n', {flag:'wx',mode:0o600});
  console.log(JSON.stringify({reachedHttp:r.reachedHttp,authSent:r.authSent,httpStatus:r.httpStatus}));
  if(!r.reachedHttp) process.exitCode=1;
} catch { console.error('PREFLIGHT_FAILED'); process.exitCode=1; }
JS
```

같은 파일이 있으면 덮어쓰지 않는다. 만료됐으면 기존 파일을 보존하고 새 이름으로 실제 probe를 수행해 아래 --preflight 경로만 바꾼다. 날짜 편집·다른 환경의 성공 JSON 재사용 금지. 기본 OpenSSL/날짜 검사는 승인된 INIT-005 rev1 코드를 그대로 사용한다. Network secret은 기존 승인된 프록시·CA 경로를 사용하며 토큰/키/환경 전체를 출력하지 않는다. `set -x`, curl verbose/header 덤프, TLS 검증 끄기 금지.

## 3. 승인된 단일 생성 요청

가격은 INIT-005의 고정 스냅샷이다. 실제 실행 직전 공식 가격/모델 지원을 재확인한다. 적용 peak cache-miss 요율이 스냅샷보다 높거나 모델이 바뀌었으면 실행하지 말고 재검토한다. 아래 **USD 0.02는 새 한 번 시험의 제안 하위 예산**이며 총괄/실행자의 명시 확인이 필요하다. 기존 6회 예산 승인 문자열은 사용할 수 없다. 요청 예약은 40,000 input + 4,096 output 기준 USD 0.0169152, input 본문 32KiB 이하다. 이는 공학적 예약이며 제공업체 tokenizer/계정 청구의 절대 상한 증명은 아니다.

검토와 가격 확인 후, 기존 승인된 Network secret이 등록된 Cloud에서만:

```sh
# DEEPSEEK_API_KEY는 안전한 환경 설정/Network secret에만 둔다. 값 출력·명령 인자 전달 금지.
# 유료 플래그는 이 자식 프로세스에만 부여한다. 부모 환경은 false 유지.
if ALLOW_PAID_AI=true AFS_INIT006_APPROVED_USD=0.02 AFS_PRICE_RECHECKED=true \
  node scripts/init006/run.mjs --live --approve=INIT006-C2-ONCE \
    --transport=curl-proxy --credential=network-secret \
    --preflight=eval-results/init006-c2-preflight.json \
    --code-sha256=a47484ece376bac0b228c473869c9aaac1e5d793cfa542e090acf5ed14f7dbc6
then RUN_EXIT=0; else RUN_EXIT=$?; fi
export ALLOW_PAID_AI=false
# RUN_EXIT를 기록하되 실패/불확실 상태여도 위 명령을 다시 실행하지 않는다.
```

활성화는 한 자식 프로세스에 한정되므로 종료·실패 후 부모 환경에 남지 않는다. 직접 Secret/native를 이미 검증한 경우만 두 transport/credential 값과 같은 transport preflight를 함께 바꾼다. 상한은 **생성 요청 최대 1, 자동 재시도 0, 동시 1**이다. 호출 전 예약·dispatched 기록을 디스크에 동기화하며 디스크 쓰기 실패 시 전송하지 않는다. 전송 도중 실패는 호출권을 돌려주지 않는다.

C2는 기존 `cases.mjs`의 독립 고정 입력을 그대로 사용한다(claude-only 방문자 조건). C1 결과가 필요하지 않으며, 과거 C2 요청의 무작위 ID나 실패 응답 바이트를 재생하는 것은 아니다.

## 4. 판정·반환하고 종료

`eval-results/init006-c2-diagnostic/report.json`과 새 `run.lock`을 보존하고 안전한 보고서만 반환한다. 원본 응답/입력/추론/헤더/예외/키는 별도 캡처하지 않는다. `paidAttempts=1`은 dispatch 예약 횟수이며 실제 과금 확정값은 아니다. `actualChargeUsd`는 null을 유지하고 usage 기반 비용은 추정으로 구분한다.

실패 시 diagnostic의 stage/path/rule/length/count로 **이번 응답의 최초 실패**를 판정한다. HTTP/인증/타임아웃은 기존 안전 코드로 분리되고 계약 진단은 없을 수 있다. stateChecks/errorDataPreserved/legacyEvidenceUnchanged를 함께 확인한다. 성공 시 diagnostic=null과 상태 검사 결과를 보고하되 과거 C2 원인 해결·사용자 품질 통과라고 하지 않는다. 실패해도 계약을 완화하거나 재시도하지 말고 여기서 종료해 총괄에 반환한다.
