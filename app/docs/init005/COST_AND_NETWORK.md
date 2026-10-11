# INIT-005 — 가격, 호출 한도, 키와 네트워크

확인일: 2026-10-10. 공식 문서에서 확인한 사실과 이 시험의 설계값/추정을 구별한다. 단가는 실행 직전에 다시 확인한다. 가격 변경 시 숫자만 승인 플래그로 덮지 말고 rates와 계산을 검토해야 한다.

## rev1 승인 경계

아래 가격/Cloud 설명은 이전 INIT-005 준비 때 기록한 snapshot이다. 이번 최소 수정에서는 최신 가격이나 Cloud 기능을 새로 확인하지 않았다.
USD 0.12와 아래 실호출 예시는 기존 제안/참고이며 현재 실행 승인이 아니다. **비용 없는 Cloud 검증을 먼저 끝내고 설정·예산을 별도 결정한다.**
이번 `CLOUD_RUN.md`에는 실호출 단계가 없고, 키 등록·유료 활성화·승인 플래그 설정을 하지 않는다.
날짜 기록은 externalProbe의 UTC 밀리초 형식과 0~24h 경계를 검증한다. OpenSSL 로컬 진단은 자체 공개 임시 설정을 사용한다.

## 공식 근거

- DeepSeek Models & Pricing: https://api-docs.deepseek.com/quick_start/pricing/
  공식 도메인의 검색 추출 본문에서 `DeepSeek-V4.1-Flash`, 아래 단가와 피크 시간을 확인했다. 확인에 사용한 검색 주소는 `https://api-docs.deepseek.com/quick_start/pricing/?push_animated=1&theme=light&webview_progress_bar=1`이며 표의 재확인 검색 결과도 일치했다. 원 URL 직접 열기는 cache miss/오류가 있어 최신 결제 계정 화면을 직접 읽었다고 주장하지 않는다.
- DeepSeek Lists Models: https://api-docs.deepseek.com/api/list-models/
  공식 예시의 `deepseek-flash`는 입력+출력을 합한 context_window=1,048,576, max_output_tokens=393,216이다. 계정에 대한 실제 GET 결과가 아닌 문서 예시다.
- DeepSeek Chat Completions: https://api-docs.deepseek.com/api/create-chat-completion/
  `max_tokens` 1~393,216, 입력+출력 합계의 문맥 제약, model/usage/finish_reason 반환을 설명한다. 이번 요청은 `thinking.type=disabled`, `response_format=json_object`다. JSON 외에 제품 계약·출처·상태는 별도 검증한다.
- OpenAI Cloud environments (현행): https://learn.chatgpt.com/docs/environments/cloud-environments
  Network secret은 로컬 프로그램에 placeholder를 주고 지정된 HTTPS 목적지/443에서 프록시가 실제 값으로 바꾼다. setup과 tasks에서 지원한다. 일반 환경 변수와 같은 이름을 중복 사용하지 않는다. 개인 vault 값은 환경의 목적지 제한을 따르며, 환경 업데이트는 재게시 후 새 작업에서 확인해야 한다.
- OpenAI Agent approvals & security: https://learn.chatgpt.com/docs/agent-approvals-security
  Legacy의 setup-only secret과 현행 Cloud Network secret을 구별한다. Legacy 설명만으로 현행 기능이 불가능하다고 판단하지 않는다.

## 단가와 예상 비용

USD / 100만 토큰. 공식 검색 본문 기준의 표이며 환율·원화·세금·실제 청구액을 추정하여 확정하지 않는다.

| deepseek-flash | 피크 | 비피크 |
|---|---:|---:|
| 입력, 캐시 미사용 | 0.30 | 0.15 |
| 입력, 캐시 적중 | 0.006 | 0.003 |
| 출력 | 1.20 | 0.60 |

공식 피크 시간은 월~금 UTC 01:00~04:00 및 06:00~10:00, 중국 공휴일 제외다. 이 시험은 시간대·캐시 할인을 가정하지 않고 **더 비싼 피크/캐시 미사용**으로 예약한다.

계산식: `(입력 토큰 × 입력 단가 + 출력 토큰 × 출력 단가) / 1,000,000`.

예시 workload를 호출당 입력 3,000~8,000, 출력 1,000~3,000토큰으로 가정하면 6회 합계는 **$0.0126~$0.0360**이다. 아직 토크나이저나 실제 API로 측정한 예상치가 아니다. 한국어 문자 수에 중국어/영어 환산율을 적용하지 않는다.

시험 도구가 실제 제한하는 값은 전체 직렬화 요청 본문 **32KiB 이하**, 출력 **4,096토큰**, 생성 요청 **최대 6회**, 동시 **1회**, 재시도 **0회**, 시간 **15초/요청**이다. 공급업체의 1M 문맥을 채워 보내지 않는다. 입력은 토크나이저 검증 대신 40,000토큰의 보수적 공학 예약값을 사용한다.

- 1회 예약: `(40,000 × 0.30 + 4,096 × 1.20) / 1,000,000 = $0.0169152`.
- 6회 합계 예약: **$0.1014912**.
- 제안 승인 예산: **$0.12**. 사용자가 승인한 예산으로 아직 기록하지 않았다.

40,000은 정확한 토큰 수의 증명이 아니다. $0.12는 로컬 예약·중단 정책에 쓰는 제안값이지 공급업체 계정에 설정된 강제 청구 상한이 아니다. 모델의 공식 전체 문맥 상한만으로 계산하면 출력 4,096일 때 입력은 최대 1,044,480토큰이며 6회 이론상 금액은 $1.9095552다. 이 극단은 이번 32KiB 입력과 달리 문맥 전체를 사용한 계산이다. 별도의 엄격한 계정 금액 한도가 필요하면 공급업체 설정 지원을 확인하거나 정확한 토크나이저 검증을 추가 승인해야 한다.

전송 전 각 요청 비용을 예약하고, 시간 초과/취소/검증 실패라도 자동 환급 또는 재시도하지 않는다. 응답 토큰이 입력 예약 40,000이나 출력 4,096을 넘으면 다음 요청을 중단한다. 사용량·모델 누락/변경도 중단한다. 실제 invoice가 없으므로 `actualChargeUsd`는 null이며, 반환 토큰×단가는 비용 추정 필드로만 기록한다.

## 키 없이 먼저 확인

```sh
# 로컬 TLS/CONNECT/POST 호환 시험. 임시 자기서명 인증서는 시험 후 삭제한다.
# 실 DeepSeek 키와 외부 네트워크 모두 필요 없다.
node scripts/init005/preflight.mjs

# 명시적 외부 연결 검사: 고정 GET /models, Authorization 없음, 생성 요청 0
node scripts/init005/preflight.mjs --external --transport=native
# Cloud 프록시 경로를 평가할 경우에만, 해당 환경의 HTTPS_PROXY를 사용
node scripts/init005/preflight.mjs --external --transport=curl-proxy
```

현 Pro 컨테이너에서 Node 22.16의 native fetch는 테스트 HTTPS 목적지에 직접 도달했지만 환경 프록시 CONNECT는 0회였다. 명시적 curl 프록시 전송은 CONNECT 1회, TLS 검증, 한글 JSON POST 전달에 성공했다. 특정 버전/환경에서 직접 관찰한 결과이지 모든 미래 Node 버전에 대한 단정은 아니다.

실제 `api.deepseek.com/models`의 native GET은 이 컨테이너의 DNS `EAI_AGAIN`으로 실패했다. 환경 프록시가 없어 외부 curl-proxy는 전송 전 `PROXY_REQUIRED`였다. Cloud 실패를 재현한 것이 아니며 Cloud에서 사용할 수 없다는 판정이 아니다. 준비한 명령을 Cloud에서 키 없이 먼저 실행한다. HTTP 401은 연결이 도달했다는 관찰일 수 있지만 인증/모델/치환 성공을 뜻하지 않는다.

프록시 전송은 기존 어댑터의 주입 가능한 fetch 경계에만 연결한 **시험 전용** 옵션이다. 모델/상태 계약이나 제품 UI 서버를 대체하지 않는다. curl은 `-q --config -`로 키와 프록시 설정을 stdin으로 전달하며 명령줄·자식 환경·stderr 로그에 넣지 않는다. 리디렉션·재시도·TLS 검증 해제를 하지 않는다. CA는 실행 환경의 인증서 설정을 사용한다. 앱 서버의 기본 global fetch를 프록시 대응으로 바꾼 것은 아니다.

## 사용자가 마지막으로 설정할 값

권장 경로는 현행 Codex Cloud의 **Network secret**이다. 환경 설정에서 key=`DEEPSEEK_API_KEY`, 허용 목적지=`api.deepseek.com`으로 등록한다. 값은 비밀 입력 UI에서만 넣는다. 동명 일반 환경 변수를 동시에 만들지 않는다. 환경의 인터넷 허용 목록에 정확한 목적지가 있는지, 요청한 개인 vault 값이 해당 환경에 제공되는지도 확인한다. 범위를 넓혀 무제한 인터넷을 허용할 필요는 없다. Node/TypeScript 설치에는 기존 패키지 관리자 접근이 별도로 필요하다.

실키 등록 전에 위 keyless 검사를 완료한다. 현재 Node 22.16 + Network secret 조합의 시험에서는 `--credential=network-secret --transport=curl-proxy`를 사용한다. 실제 placeholder 치환과 인증 성공은 이후 승인된 첫 생성 요청에서만 확인한다. 별도의 유료 '연결 테스트'를 먼저 추가하지 않는다.

로컬 서버 비밀 설정으로 실행하는 대안은 `--credential=direct-secret`이다. 프로그램이 직접 키를 읽는 경로이며 Network secret의 비밀 격리와 같지 않다. 작업자에게 키를 채팅·로그·.env 파일로 전달하지 않는다. 안전한 비밀 주입 경로가 준비되지 않으면 실호출은 중단한다.

최종 실행 승인 전에는 `ALLOW_PAID_AI=false`를 유지한다. 실행 직전에 최신 가격을 확인하고, 이 6회 배치와 $0.12 제안 예산 및 가상 입력 전송에 사용자가 동의한 뒤에만 다음 **비밀이 아닌 실행 승인 설정**을 적용한다: `ALLOW_PAID_AI=true`, `AFS_EVAL_APPROVED_USD=0.12`, `AFS_PRICE_RECHECKED=true`.

그 뒤의 명시적 실행 명령(이번 준비 단계에서는 실행하지 않음):

```sh
node scripts/init005/run.mjs --live --approve=INIT005-SIX-CALLS \
  --credential=network-secret --transport=curl-proxy \
  --preflight=eval-results/preflight-curl-proxy.json
```

실행은 해당 환경에서 24시간 이내에 만든 같은 전송 방식의 키 없는 외부 검사 기록을 요구한다. 인가 실패면 오류 코드만 반환하고 키를 출력하지 않는다. Network secret/CA/프록시가 실패하면 원인을 기록하고 멈춘다. 키를 출력하거나 TLS를 끄는 우회는 하지 않는다. 평가 완료 후 유료 활성화를 다시 끄고 비밀 설정의 사용 범위를 정리한다.
