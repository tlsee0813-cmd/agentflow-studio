# AgentFlow Studio — INIT-004

코드 0.0.3 / 공통 요청 계약 0.1.1. 기존 R1~R4 수정 기반에 R5 선택 충돌 해결 흐름을 추가했다.
전체 MVP·실제 DeepSeek 연결·공개 운영 준비 완료가 아니다.

## 구현 범위

자유 입력 + 개발 도구 선택 → 후속 질문 최대 한 차례 → 요구 요약 → 항목 확인·수정·보류.
도구 선택 복원/미정/잠금 충돌, 미확정 초안의 답변 반영, 긴 원문 보존과 수정·재시도를 포함한다.
선택 충돌은 새 답변 반영/기존 요구 유지 중 하나를 고른 뒤 본문과 완료 조건을 함께 확인한다.
취소는 요구를 변경하지 않는다. 자유 답변의 미정 완료 조건은 확정하지 않고 추가 확인 대상으로 남긴다.
질문 한 차례는 이번 작은 검증 범위일 뿐 완성 제품의 고정 정책이 아니다.
방문자가 설계할 서비스의 저장 범위와 Studio 자체 클라우드 기능은 별개다.
그래프·영구 저장·내보내기·CLI 실행은 후속 범위다. 새로고침하면 입력은 사라진다.

## 비용 없는 실행

Node **22.16.0**, npm **10.9.2**, 잠긴 개발 의존성 TypeScript **5.8.3**을 사용한다.
Git에는 dist가 없으므로 설치·빌드가 필요하다.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm test
npm run demo
# http://127.0.0.1:3000
```

모의 모드는 한정된 규칙/fixture이며 실제 AI가 아니다. 런타임 외부 패키지는 없다.
INIT-004 클라우드에서는 클린 npm ci, 타입 검사, 빌드와 Node 검사를 직접 실행했다.
과거 INIT-003 설치 실패와 새 실행 결과는 docs/PROJECT_STATUS.md에서 구분한다.

## 검증

```sh
python -m pip install -r tests/browser-requirements.txt
python -m playwright install --with-deps chromium
python tests/browser.py
```

기본 브라우저 전송은 direct-http다. CI는 Linux/Windows에서 실제 로컬 서버에 접속한다.
AI 제공업체만 테스트 대역이며 비용은 발생시키지 않는다. 선택적 dom-bridge는 브라우저 fetch도
대체하므로 종단 검증이 아니다. 그 모드의 직접 네트워크 B15는 명시적으로 건너뛴다.
기존 Node 50개와 UI 9개를 삭제하지 않고 회귀 검사를 추가했다.
현재 전체 Node 92개(기존83+R5 신규9), 브라우저18개(기존15+R5 신규3)를 실행한다.
번들 Chromium 다운로드가 차단된 클라우드에서는 BROWSER_EXECUTABLE=/usr/bin/chromium으로
직접 HTTP 검사를 실행했다. Playwright는 tests/browser-requirements.txt의 **1.57.0**을 사용한다.
시스템 Chromium 결과와 CI의 Playwright 번들 Chromium 결과는 구분한다.
새 CI 증거는 test-results artifact에 남긴다. dist·test-results·.env·설치 패키지는 Git 제외다.

## 비밀 설정과 운영 경계

서버만 DEEPSEEK_API_KEY 환경 설정을 읽는다. 실제 키를 채팅·소스·로그에 넣지 않는다.
DEEPSEEK_MODEL 기본값은 deepseek-flash다. 승인된 HTTPS 기본 URL은 서버 설정이다.
ALLOW_PAID_AI=false가 기본이다. 키 부재/실패를 모의 응답으로 숨기지 않는다.
이번 작업에서 실제 키·유료 호출 검증은 수행하지 않았다.
서버는 **127.0.0.1 개발 전용**이다. 공개 사용자 인증과 영속 과금 제한이 없어 운영 배포하지 않는다.

자체 개발 기록: docs/BASELINE.md, CONTRACTS.md, DECISIONS.md, PROJECT_STATUS.md.
원본 프로젝트 첨부·교재·검토 ZIP·이전 검증 로그/이미지는 저장소에 복사하지 않는다.
