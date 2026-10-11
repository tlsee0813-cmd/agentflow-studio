# INIT-005 rev1 — Cloud 및 Windows 비용 없는 실행 검증 인계

목적: 첨부 독립 검토의 날짜 검증·OpenSSL 진단 두 수정만 검증한다. 설계/기능/새 PR를 만들지 않는다. 이 인계에는 실호출 승인이 없으며 **키 등록·--live·예산 승인 플래그 설정을 하지 않는다.** 비용 없는 검사 결과를 반환한 뒤 사용자가 실제 시험 설정과 예산을 결정한다. 기존 USD 0.12는 제안값일 뿐이다.

기준: `4caa0914d4520c76cdd0380bbb1a3c1941ab0451` / PR #1. 결과물은 **15파일 overlay**다. 이번 rev1이 이전 INIT-005 묶음을 대체한다. 두 묶음을 겹쳐 적용하지 않는다. 상위 폴더 하나의 ZIP과 답변 본문의 ZIP SHA256을 함께 전달한다. 대화나 파일이 자동 공유된다고 가정하지 않는다.

## 1. 정확한 기준과 패치 적용

별도 작업 경로에 `source/`를 준비한다. 기존 변경이 있는 작업 공간은 건드리지 않는다. `git rev-parse HEAD`, `git status --porcelain`으로 기준/깨끗한 트리를 확인한다. 다르면 reset/clean/강제 덮어쓰기하지 말고 차이를 보고한다. 처음 받는 경우:

```sh
# <BUNDLE>은 압축을 푼 AgentFlow_Studio_INIT-005_rev1 폴더, <WORK>는 별도 새 작업 경로다.
git clone https://github.com/tlsee0813-cmd/agentflow-studio.git <WORK>/source
git -C <WORK>/source checkout --detach 4caa0914d4520c76cdd0380bbb1a3c1941ab0451
python <BUNDLE>/apply_overlay.py <WORK>/source
```

`BASELINE.json`의 patch SHA256과 `MANIFEST.sha256`을 먼저 검사한다. `apply_overlay.py`는 정확한 HEAD·깨끗한 트리·패치 해시를 확인하고 `git apply --check` 후 로컬에만 적용한다. 적용된 15파일을 overlay와 대조한다(Windows의 Git CRLF 설정 차이는 명시). 원격 push/PR 변경/Actions 게시·병합·배포는 하지 않는다.

## 2. Cloud 공통 검증 — Node 22.16.0, npm 10.9.2

키 없는 작업 환경에서 실행한다. 전체 환경변수 출력, `set -x`, HTTP verbose/header 덤프, TLS 검증 비활성화는 금지한다. 패키지 또는 도구 설치가 막히면 그 단계의 실패를 남기며 이미 설치된 도구를 썼다는 사실과 클린 설치 성공을 혼동하지 않는다.

```sh
cd <WORK>/source
export AI_MODE=mock ALLOW_PAID_AI=false
node --version
npm --version
openssl version
curl --version
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm test
node scripts/init005/run.mjs --mock --output=eval-results/rev1-mock
node scripts/init005/run.mjs --plan --output=eval-results/rev1-plan
node scripts/init005/preflight.mjs
```

각 명령의 종료 코드를 별도로 기록한다. 로그를 tee로 저장한다면 shell의 pipefail을 사용한다. `npm test`가 빌드를 포함하며 예상 **119개 = 기존115 + 회귀4**, 실패/건너뜀0이다. 기존 검사 삭제·완화는 금지한다. E21은 누락/잘못된 타입·형식/달력 날짜를, E22는 미래 및 24h 경계를, E23은 비유한 경과 시간을 검사한다. E24는 실제 OpenSSL 자식에 없는 기본 설정을 강제하면서 자체 `-config`와 좁은 자식 환경, TLS/한글 POST/CONNECT를 검사한다. 성공을 모의한 프로세스가 아니다.

## 3. 제공된 독립 재현 스크립트 재실행

묶음 `review/input/`의 두 `.mjs` 파일을 `<WORK>/`로 복사하고 그 경로에서 실행한다. `source/`는 위에서 빌드한 수정본이다.

```sh
node independent-boundaries.mjs --expect-fixed
node independent-openssl.mjs
```

첫 스크립트: 키 getter 접근/외부 fetch 0, mock 6/plan 0, 현재 날짜만 accepted=true, invalid/missing/future/past는 false가 기준이다. 날짜 JSON은 hand-authored fixture이지 실제 네트워크 증거가 아니다.
두 번째: **종료 코드만 보지 않는다.** `explicitPublicOpenSslConfigStatus=0`, `localProbe="passed"`, `nativeStatus=200`, `curlStatus=200`, `tlsVerified=true`, `bodyMatches=true`, `authSent=false`를 모두 확인한다. 기존 스크립트는 localProbe 실패를 출력만 할 수 있으므로 이 필드 판정을 생략하지 않는다. 생성된 `boundary-results/openssl/*key.pem`/`*cert.pem`은 일회용 시험용이며 반환·게시하지 않는다.

## 4. Windows 보완 절차 — 외부 검토자에게도 그대로 전달 가능

실제 Windows에서 위 설치/검사/재현 절차를 Node **22.16.0**으로 수행한다. Linux E24 성공만으로 Windows 실행 완료라고 하지 않는다. OpenSSL과 curl.exe의 설치 경로·버전을 기록하되 환경 전체를 출력하지 않는다. OpenSSL의 `req -config`, `-addext`를 지원하는 실행 파일이 PATH에 있어야 한다.

PowerShell에서는 2절의 export 대신 다음을 사용한다. 이후 공통 명령을 개별 실행하고 `$LASTEXITCODE`를 확인한다.

```powershell
$env:AI_MODE = 'mock'
$env:ALLOW_PAID_AI = 'false'
node --version
npm --version
openssl version
curl.exe --version
# npm ci / npm run check / npm test / mock / plan / local preflight는 위 공통 명령 그대로
```

부모의 기본 설정도 없는 상황을 추가 확인하려면(전송 없이 로컬 TLS만 실행):

```powershell
$previous = $env:OPENSSL_CONF
$probeDir = Join-Path ([IO.Path]::GetTempPath()) ('afs-rev1-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $probeDir | Out-Null
try {
  $env:OPENSSL_CONF = Join-Path $probeDir 'deliberately-absent.cnf'
  node scripts/init005/preflight.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Local TLS preflight failed' }
} finally {
  if ($null -eq $previous) { Remove-Item Env:OPENSSL_CONF -ErrorAction SilentlyContinue }
  else { $env:OPENSSL_CONF = $previous }
  Remove-Item -LiteralPath $probeDir -Recurse -Force
}
```

이 명령은 시스템 OpenSSL 설정을 삭제·변경하지 않는다. 실제 누락된 기본 설정을 자식 프로세스에 강제하는 재현은 E24가 담당한다. native200/curl200/CONNECT1/한글 본문 일치/authSent=false를 판정한다.

## 5. 여기서 막힌 외부 목적지 검사 — 키/생성 요청 없음

같은 Cloud 환경에서 프록시·CA·`api.deepseek.com` HTTPS 접근 조건을 확인한 뒤:

```sh
node scripts/init005/preflight.mjs --external --transport=curl-proxy
# 실제 실행에 native 경로를 검토할 때만 별도 실행
node scripts/init005/preflight.mjs --external --transport=native
```

고정 `GET /models`, Authorization 없음, 생성 API 호출 없음이다. 새 결과의 checkedAt은 `YYYY-MM-DDTHH:mm:ss.sssZ` UTC 형식이어야 한다. 다른 환경의 성공 JSON을 복사하거나 날짜를 편집해 검사를 대신하지 않는다. 유효성 검사는 기록된 시점부터 정확히 24h까지를 허용하고 1ms 미래·24h 초과를 거절한다. 이것은 인증·Network secret 치환 증명이 아니다.

실패는 안전한 오류 코드/HTTP 상태/실패 단계로 기록한다. 프록시 URL의 자격 정보, 키·인증 헤더·전체 환경은 반환하지 않는다. 인증서 검증을 끄거나 목적지 제한을 우회하지 않는다. 비용 없는 사전 검사에서 막혀도 mock/단위 검사는 별개로 보고한다.

## 종료 및 반환

**여기서 종료한다. `--live`나 키 등록을 이 작업의 다음 자동 단계로 실행하지 않는다.** 반환물: 기준 HEAD·적용 패치 SHA256·변경 파일 수, 실제 런타임/클린 설치/타입/빌드/119개 검사 결과, 두 제공 스크립트의 안전한 출력, mock/plan 보고서, 키 없는 로컬/외부 preflight JSON, 실행하지 못한 항목. 생성되는 보고서는 품질검토 pending과 유료 요청0을 유지한다. browser/새 CI는 별도 실행하지 않았다면 미실행으로 기록한다. 다음 실제 시험 설정·가격 재확인·예산 결정은 이 반환을 검토한 후 별도 승인 사항이다.
