# INIT-005 rev1 — 독립 검토 후 최소 수정 / 실행 기록

## 기준·범위

기준 커밋 `4caa0914d4520c76cdd0380bbb1a3c1941ab0451`, PR #1, 브랜치 `init-003/fix-review-regressions`다. 이번 시작 시 GitHub 읽기로 같은 head와 Draft/미병합을 확인했다. 원격 코드/PR/CI 변경은 하지 않았다. Git 직접 clone은 DNS 때문에 실패했으므로 기존 첨부 소스와 GitHub에서 읽은 R5 본문을 사용해 기준 파일을 복원했다. 복원한 **38파일의 전체 Git tree는 `fef8967a4a924486cf5d34477656fd4ec8da9a16`로 원격 커밋 tree와 일치**하며 원격 커밋 객체 자체도 동일 SHA로 확인한 로컬 사본이다. 새 원격 커밋을 만들었다는 뜻이 아니다.

독립 검토 입력: `AgentFlow_Studio_INIT-005_review.zip`의 REVIEW.txt, review-result.json 및 independent-boundaries.mjs / independent-openssl.mjs 전체. 기존 INIT-005 ZIP SHA256 `d6a4f48b9d613196ce13d9789d50868edb2f7612349fe75c17167199ce6a640c`와 패치 SHA256 `5999ac0ae11fd3a0f1db00e126d480b3c6a11f09ad1b5ba6142fb0505b12408f`, manifest30 항목이 일치했다.

기준 대비 15파일 overlay를 유지한다. 이전 INIT-005 대비 런타임 수정은 run.mjs/preflight.mjs 두 파일뿐이다. 동일 테스트 파일에 4개 회귀 검사(E21~E24)를 추가하고 Cloud/상태/안전 계약 문서만 갱신했다. 고객 사례·도구의 호출 제한·제공업체 어댑터·R5·제품 UI·프롬프트·의존성·잠금 파일은 이번 최소 수정에서 바꾸지 않았다. 과거 INIT-005의 관측 hook 등은 누적 패치에 그대로 포함된다.

## 두 수정

1. 날짜: checkedAt이 externalProbe가 생성한 UTC 밀리초 ISO 문자열인지 검사한다. 파싱 결과/경과 시간이 유한해야 하며 달력 날짜를 ISO 왕복으로 확인한다. 누락/타입 오류/비정규 형식/불가능한 날짜/미래/24h 초과를 NETWORK_PROBE_FAILED로 거절한다. 정확히 24h는 기존 규칙대로 허용한다.
2. OpenSSL: 진단 임시 디렉터리에 공개 최소 설정을 만들고 `openssl req -config <파일>`로 지정한다. 환경 전체나 부모 OPENSSL_CONF를 상속하지 않는다. 기존 제한된 자식 환경과 TLS 검증을 유지하고, 설정·임시 인증서·임시 키는 finally에서 제거한다.

## 이번 실제 실행

Linux x86_64 / Node22.16.0 / npm10.9.2 / TypeScript5.8.3 / OpenSSL3.5.5 / curl8.10.1 / Python3.13.5.

| 검사 | 결과 |
|---|---|
| 수정 전 기존 `npm run check`, `npm test` | Linux에서 115 통과/실패0/건너뜀0. 외부 검토의 Windows114/실패1과 별도 환경 |
| 수정 전 제공 날짜 스크립트 | invalid/missing을 잘못 통과하는 결함 재현. current 허용, future/past 거절 |
| 새 회귀를 기존 코드에 적용한 red 단계 | 4개 중1 통과/3 실패. E21 누락 날짜, E23 NaN 경과 시간, E24 없는 OpenSSL 기본 설정에서 실패 |
| 수정 후 `npm run check`, `npm test`(빌드 포함) | **119 통과/실패0/건너뜀0 = 기존115 + 신규4**. 기존 설치 TypeScript 사용 |
| 수정 후 제공 independent-boundaries --expect-fixed | 종료0, 날짜5판정 충족, 외부 fetch0/키 getter 접근0, mock6/plan0 |
| 수정 전·후 제공 independent-openssl | Linux는 양쪽 모두 직접 OpenSSL 종료0/localProbe 성공. Windows 고유 실패의 현장 재현이라고 하지 않음 |
| E24의 없는 기본 설정 제어 조건 | 실제 OpenSSL+native TLS+curl CONNECT+한글 POST를 실행. 수정 전 실패 → 수정 후 성공. 별도 성공 모의 없음; 부모 비밀/일반 환경 전달 차단도 검사 |
| 모의 CLI | 6 체크포인트, 모의6/유료0, humanReview 모두 pending |
| plan CLI | 6 체크포인트, 모의0/유료0 |
| 독립 로컬 preflight | native200/CONNECT0, curl200/CONNECT1, TLS/한글 본문 일치, authSent=false |
| 새 디렉터리 클린 `npm ci` | 실패: EAI_AGAIN. 기존 컴파일러 사용을 클린 설치 성공으로 보지 않음 |
| 키 없는 외부 GET /models (native) | 실패: EAI_AGAIN. 인증/생성 요청 없음 |
| 키 없는 외부 curl-proxy | 전송 전 PROXY_REQUIRED. 이 환경에 해당 프록시 설정 없음 |

모든 수정 전후 증거는 반환 묶음 verification/에서 확인한다. 제공 재현 스크립트는 원문 그대로 review/input/에 보관했다. 이번 재실행은 작성자 자기 검증이며 새 독립 검토 판정으로 표시하지 않는다. 날짜 fixture는 실제 연결 관측 자료가 아니다.

## 미실행·후속 경계

실제 Windows/새 Codex Cloud/GitHub Actions/브라우저 suite는 이번 수정본으로 실행하지 않았다. 시스템 기본 OpenSSL 설정을 삭제·변경하지도 않았다. Windows 환경의 119개 검사·제공 스크립트·기본 설정 누락 조건을 CLOUD_RUN.md에 구체적으로 적었다. Linux 제어 조건의 성공은 Windows 실제 성공을 대신하지 않는다.

실제 DeepSeek 키 요청/인증/Network secret 치환/모델 권한/응답 품질/토큰/청구는 미검증이다. 모든 생성 응답은 모의이며 실제 유료 생성 요청0이다. 원격 게시·main 병합·운영 배포·후속 제품 기능 확대 없음. 비용 없는 Cloud 검증 결과를 검토한 뒤 사용자가 실호출 설정과 예산을 별도로 결정한다. 이전 USD0.12는 제안이며 승인된 예산으로 바꾸지 않았다.
