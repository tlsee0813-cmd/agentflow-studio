# 구현 결정 — INIT-003

2026-10-10. 아래는 사용자 결정이 아니라 위임 범위의 구현 선택이다.

INIT-002의 TypeScript DOM UI + Node HTTP ESM 구조를 유지한다. React/Vite가 최종 제외된 것은 아니다.
새 기능·의존성을 추가하지 않고 Node22.16.0, TypeScript5.8.3 잠금 파일을 유지했다.
SDK 없이 서버 fetch를 사용하는 DeepSeek 어댑터도 유지하며 실제 호출은 하지 않았다.
모델/CLI/구독 지원이나 비용 절감이 검증되었다고 주장하지 않는다.

R1: 출처 재사용과 현재 선택 적용을 분리한다. 잠금 충돌은 별도 로컬 상태로 가시화한다.
R2: 동일 key/topic/kind의 proposed+unlocked 초안만 갱신한다. 확정·잠금·보류·제외를 덮어쓰지 않는다.
R3: 원문과 요약 계약을 분리하고 긴 원문을 자르지 않는다. 기존 답변 수정은 이번 복구 범위에 포함한다.
R4: 접두사 문자열 비교 대신 path.resolve/relative/isAbsolute와 realpath를 사용한다.
공식 Node22.16.0 경로 문서: https://nodejs.org/download/release/v22.16.0/docs/api/path.html
실제 함수를 path.posix/path.win32에 주입하는 검사와 Windows CI를 함께 준비한다.

CI는 PR head SHA를 명시적으로 checkout하고 Ubuntu24.04/Windows2022에서 클린 설치·타입·빌드·
전체 테스트·직접 브라우저 HTTP를 검증한다. CI가 서비스 운영 서버를 제공하는 것은 아니다.
Playwright CI 안내: https://playwright.dev/python/docs/ci
브라우저 대역 dom-bridge는 로컬 보조 검사일 뿐이다. direct-http와 구분해 보고한다.

GitHub에서 이전 확인한 Action SHA를 고정했다:
checkout d23441a48e516b6c34aea4fa41551a30e30af803;
setup-node 949feb2413d6458794dcd2491c4babbbce0c15c1;
setup-python ece7cb06caefa5fff74198d8649806c4678c61a1;
upload-artifact ea165f8d65b6e75b540449e92b4886f43607fa02.
Action 파일 작성과 실제 실행 성공은 다르다. 결과는 해당 커밋의 실행 기록으로 판단한다.
외부 Windows/Node24에서 H05가 실패한 사실을 기존 Linux/Node22 보고가 거짓이라는 의미로 해석하지 않는다.
