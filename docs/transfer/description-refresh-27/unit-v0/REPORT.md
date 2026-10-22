# 27 새 단위 검사 작성·실행 결과

계약4afe1ef의 새 tests/description-refresh27.test.mjs 한 파일만 추가했다. 구현 파일은 수정하지 않았으며 기존 CI의 .test.mjs wildcard에 포함된다. 새로운 TS 계층·wrapper·의존성·CI 변경은 없다.

첫 단위 실행은 새8개와 관련 기존91개, 합계99/99 통과(exit0)다. 원 stdout/stderr/명령·종료값은 unit27-first.*에 보존했다. Node24.19.0/TypeScript5.8.3 보조 검사이며 지원 Node22의 CI·Cloud를 대신하지 않는다. 구현 담당의 check/build는 반복하지 않았다. 전체 wildcard에는 HTTP 서버를 시작하는 다른 검사가 있어 실행하지 않았다. 실제 브라우저·서버·유료 AI·provider 네트워크도 미실행이다.

핵심 fixture는 처음에 U7/N7/S7/C7과 배포 금지를 준비하고 인계·합성 반환을 만든다. 설명을30일로 고친 뒤 U/N만30으로 직접 바꾸고 S/C 원문이 그대로임을 확인한다. 새 설명 기록은 설명 판본만 추가하며 다른 부분 설명까지 포함한 전체 나머지 상태를 대조한다. token 거절·무수정 새 판본·held/보관 우회 거절·후속 수정 stale·늦은 외부 수신·정확 요청/인계·원문/H·schema 왕복을 확인했다.

일곱 shared 소스의 메모리 TypeScript 변환 결과가 실제 unit이 읽는 dist 바이트와 같음을 확인했다. 정확 해시와 범위는 RECEIPT.json, 새 검사 diff는 new-test.patch에 있다. 이 역할은 검사 작성·실행이며 독립 제품 검토나 실제 AI 의미 품질 수용이 아니다.
