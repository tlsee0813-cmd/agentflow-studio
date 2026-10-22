# 33 · 늦게 읽힌 결과 파일의 자동 이동 보호 후보

기준은 `673c580d69ab5f9cffcb7f0003bcf331c57e3c93`이며, root가 제공한 동결 payload의 app.ts와 pc12_browser.py 원문을 별도 폴더에 복사했다. 원 작성자 폴더와 기준 후보는 수정하지 않았다. 이 후보는 673의 별도 REPORT16 첫 화면 회귀를 해결하거나 전체 제품 수용을 주장하는 자료가 아니다.

기존 완료 시점 검사만으로는 파일을 읽는 동안 `작업 기록 → 지금 작업`으로 왕복한 사실을 알 수 없다. 두 경로는 `displayView`만 거치며 현재 작업·revision·work DOM이 같을 수 있다. 기준·출처도 기술상 work view이지만 사용자가 명시적으로 선택한 다른 탐색 문맥이다. 이 원인은 정적으로 확인했으며, 이 작성자는 브라우저 재현을 실행하지 않았다.

파일이 실제로 선택된 경우에만 자동 이동용 객체 토큰 하나를 만든다. 선택 당시의 `contextOpen`만 토큰에 저장한다. 중앙 `displayView`가 work 이탈, 프로젝트 목록 진입, 또는 그 기준·출처 상태 변화를 관측하면 토큰을 취소한다. work로 돌아와도 취소된 토큰은 되살아나지 않는다. 새 파일 선택은 새 토큰을 받는다. 같은 work의 정상 재표시와 변경 없는 기준·출처 상태는 토큰을 취소하지 않는다.

기존 resultRead·projectEpoch·entry·current·revision 검사, 선택 원문, 명시 수신 정책은 유지한다. finally는 자기 토큰일 때만 정리해 늦게 끝난 옛 읽기가 새 파일의 토큰을 지우지 않는다. 일반 초점·페이지 스크롤·내부 details 변경을 추적하는 전역 엔진은 추가하지 않았다.

경로를 대조했다. `showProjects`는 `resetEphemeral → route=projects → render → displayView`를 거친다. 새 프로젝트는 `startNew → resetEphemeral → render → displayView`, 기존 엔트리 열기는 `openEntry → resetEphemeral → render → displayView`를 거친다. 새 엔트리가 곧바로 같은 work 문맥을 보이더라도 기존 epoch/entry 검사가 오래된 읽기의 결과 반영과 초점 이동을 막는다.

새 검사는 기존 PC12의 test12 한 메서드이며 양 PC 클래스가 상속한다. 정상 UI/MOCK로 작업·미전송 입력·실제 복사 H를 만들고, native File.arrayBuffer가 반환할 실제 bytes만 명시적으로 지연한다. 정상 완료, work 이탈 후 왕복, 기준·출처 선택, 취소 후 새 선택, 선택을 보존한 명시 수신, 새 프로젝트의 입력·초점 보호를 검사한다. 지연은 원문을 대체하거나 앱 상태를 주입하지 않는다. 저장 원문은 UTF-8 실제 파일 bytes를 decode한 값과 정확 비교하고 textarea.value 표현에만 별도 줄바꿈 기대를 적용한다.

새 선택 양성은 기준·출처가 열린 상태를 그대로 두어 선택 당시 contextOpen=true도 허용됨을 검사한다. 정상 단계의 지금 작업 클릭은 displayView 경로이며 전체 render 재생성을 실행하는 검사는 아니다. 전체 render에서 취소 조건이 추가되지 않는 점과, 아직 끝나지 않은 이전 읽기의 finally가 새 토큰을 지우지 않는 점은 이번에는 정적으로만 확인한다. 모든 초점 변경을 추적하거나 보호한다고 주장하지 않는다.

기존 test11과 다른 메서드는 그대로다. 기존 CI가 PC12 파일 전체를 실행하므로 workflow 수정은 없다. 총 검사 수는 17개에서 19개가 될 것으로 예상하며, 실제 실행 결과로 세지 않는다. 검사 모듈을 로컬에서 import하지 않았다.

Node 24.19.0 보조 환경에서 기존 TypeScript 5.8.3으로 타입과 빌드가 exit0이었다. Python AST와 새 JS 표현 구문도 정적으로 확인했다. 지원 Node22, 실제 두 PC 브라우저, 서버, 실제 AI는 실행하지 않았다. 따라서 기준 후보에서 새 검사가 실제로 실패하고 이 후보에서 통과하는지는 Cloud/CI에서 별도로 확인해야 한다. 기존 REPORT16 회귀와 기본 화면 부담도 별도 판정 대상이다.
