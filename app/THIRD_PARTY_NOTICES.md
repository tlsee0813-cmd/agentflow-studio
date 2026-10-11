# Third-party tools — INIT-002

애플리케이션 런타임에는 타사 JavaScript 패키지를 포함하지 않았다. Node.js가 필요하다.
TypeScript 5.8.3은 Apache-2.0 라이선스의 개발용 컴파일러다. 로컬 설치본의 package.json과 LICENSE.txt를 확인했다.
공식 저장소: https://github.com/microsoft/TypeScript/tree/v5.8.3
npm 배포 메타데이터: https://registry.npmjs.org/typescript/5.8.3
이번 묶음에는 TypeScript 패키지 자체를 재배포하지 않는다.

선택적인 UI 검증은 설치된 Playwright Python 1.57.0을 사용했다(Apache-2.0).
브라우저 도구의 직접·전이 의존성 버전은 tests/browser-requirements.txt에 기록했다.
이 묶음에는 Playwright, pyee, greenlet, Chromium, 폰트 바이너리를 재배포하지 않는다.
Python Playwright 내부 Node 드라이버 버전과 시스템 Chromium 버전은 로컬 도구 환경이며
npm으로 설치된 production 의존성 또는 CI의 번들 브라우저와 동일하다는 뜻이 아니다.

React/Vite/Spec Kit/OpenSpec/JSON Forms/React Flow는 앱 의존성으로 추가하지 않았다.
새 앱 코드의 공개 배포 라이선스 결정은 이 작업에 포함하지 않았다. 원본 첨부·교재는 재배포하지 않는다.
