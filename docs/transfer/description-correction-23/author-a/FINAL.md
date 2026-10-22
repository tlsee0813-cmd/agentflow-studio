# Cycle23 작성자 동결

기준 HEAD `f7b25a586dca42466f07c7db2bedb9c59703deda`, 계약 `01aa3cbb80b44bca51e17301f6de6ecd7dae5513/docs/cycles/2026-10-23-correction-context-23/` INPUT·RESEARCH 대조 완료. 새 격리 폴더 `work/product23-author`의 detached HEAD를 유지했다. commit/push/원격 쓰기는 하지 않았다. 변경 다섯 파일과 전체 SHA256은 `FINAL_RECEIPT.json`, 원 diff는 `product23.patch`, 바이트 사본은 `frozen-source/`에 있다.

정확 작업의 실제 소속 부분에 대해 기존 exportAnchor 및 areaDescription.current.valid가 고르는 설명 하나를 선택 필드 currentAreaDescription으로 전달한다. 작업·부분 ID, 판본, external/user, corrects, 필요한 보고 task/return ID·origin·text만 포함한다. 유효한 보관 부분의 기존 작업 참고 읽기는 기존 규칙을 유지하며 보관을 해제하거나 실행 범위를 바꾸지 않는다. 보류만 있는 경우·낡음·다른 부분·전역에는 현재 설명을 대체 선택하지 않는다.

새 검증기는 기존 키 부재를 그대로 보존한다. 새 필드는 정확 키·ID·정수·귀속 조합·기존 설명 2000자 한도·전체 UTF8 요청 크기로 검사하며 잘못된 입력을 수리하거나 자르지 않는다. 외부 source는 실제 도메인 보고의 returnId에서 생성하지만 서버에서 ID/내용의 진실을 인증하는 계약은 아니다. 새 클라이언트가 보내는 키는 구 서버의 정확 키 검사에서 거절된다. 같은 클라이언트/서버 번들을 배포해야 한다. API/project/return 스키마 상수와 저장 마이그레이션은 바꾸지 않았다.

provider에는 자료 JSON으로만 전달하고 SYSTEM_PROMPT는 참고의 권위·시점·출처와 명령 승격 금지를 설명한다. UI 3파일과 GUIDE_PROMPT/buildGuideBody 바이트가 기준과 동일하다. 원보고·기존 직접 네 값·과거 H·구상·확정 조건·기존 stale/복사 정책은 보존된다.

## 실행한 검사

- Node v24.19.0 / 재사용한 TypeScript5.8.3 보조 검사. Node22 최종 CI를 대신하지 않는다.
- 최종 check/build 각각 exit0. 새 domain/validation/provider-data 검사 6/6 exit0.
- 기존 domain/understanding17/hierarchy18/ai055 집중 회귀 90/90 exit0. 불필요한 전체 회귀 반복은 하지 않았다.
- 실제 f7b25 OldD와 후보 NewD에 같은 프로젝트·같은 ticket을 넣은 7일→30일 합성 probe exit0. 같은 작업과 새 같은 부분 요청 모두 기존 필드 JSON은 동일하고 후보 설명 필드에만 정정문·귀속이 추가됐다. 기존 7일 작업값과 원보고·H는 유지됐다. `before-after-evidence.json`, 네 요청 JSON 및 probe 원문 참조.
- diff check exit0, GUIDE 및 UI 바이트 동일 정적 확인 exit0. 실행별 stdout/stderr/exit.json 원문 보존.

## 보존한 실패 및 한계

초기 두 unit 실행은 provider가 import하는 기존 approot dist 의존물이 없는 환경 준비 실패였다. 기존 approot build 스크립트 두 실행은 tsc 실행 shim 부재로 exit1이었다. 새 의존성 설치나 제품 수리 대신 기존 pinned TypeScript 직접 emit exit0으로 필요한 기존 의존물을 생성했다. 그 후 새 검사 5pass/1fail은 archived=null이라는 작성자 기대가 기존 유효 설명 참고 읽기와 달랐던 실패다. 원 실패 로그를 보존하고 기존 정책에 맞는 읽기·비활성 유지 양성 검사로 고친 최종 6/6을 별도 기록했다. 어느 원 로그도 성공 로그로 덮어쓰지 않았다.

서버·브라우저·유료 AI·실제 provider 네트워크 호출은 실행하지 않았다. provider 시험은 주입한 fake fetch와 합성 응답만 사용했다. 입력 전달 및 구조 경계가 검증됐을 뿐, 기존 작업문과 정정 설명의 의미 충돌 해결이나 실제 AI 품질 성공은 주장하지 않는다. PC 정상 UI와 Node22 CI는 별도 수행 대상이다. 기존21 원검사·증거는 변경하지 않았다.
