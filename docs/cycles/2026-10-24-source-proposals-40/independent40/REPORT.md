# SOURCE40 독립 실행 검토 — 2026-10-24

최종 source `44cfc9ade567b3b7cfe66af57d9762d5bf1ead39`, app tree `c6172dd71c592ae331931b5d9e5ca5b60b0e77d0`에서 이번 범위의 수용을 막는 결함을 찾지 못했다. 작성자 실행 결과를 대신 인용하지 않고, 지정 checkout에서 별도 담당이 아래 명령을 직접 실행했다. 제품 소스 수정·커밋·설치·의존성 복사·새 worktree 생성은 하지 않았다. 최종 수용 판단과 CI 판단은 총괄 몫이다.

먼저 반환 SHA `248320d65ef7008b4d5e5e35f5ef03f4f56bf667`(app tree `3bb327ed86c3f1c0a7b14f6b1e07ba66fc2deb4c`)에서 아래 전체 검사를 통과했다. 최종 delta는 source-review.ts의 조사·분리 알림·복귀 버튼 문구와 AUTHOR 문서이며 로직은 같다. 최종 SHA에서 continuity check/build, static/preview build를 재실행해 모두 exit 0, SOURCE40 6/6·static 4/4와 별도 양PC 반례를 다시 통과했다. root/전체 unit·ENTRY37/MAP36/HOME15는 최초 SHA의 실행 증거이고 최종에서 반복하지 않았다. execution.json은 각 명령의 source SHA를 구별한다.

## 실제 실행

| 검사 | 결과 |
|---|---|
| root TypeScript / boundary / build | 각각 exit 0 |
| continuity check / build | 각각 exit 0 |
| continuity 전체 단위검사 | 287/287, exit 0 |
| static / preview build | 각각 exit 0 |
| SOURCE40 기존 브라우저군 | 6/6 |
| ENTRY37 기존 브라우저군 | 10/10 |
| MAP36 기존 브라우저군 | 12/12 |
| HOME15 기존 브라우저군 | 21/21 |
| static 기존 브라우저군 | 4/4 |
| 별도 독립 반례 probe | 1/1, 내부 1280×720 및 1440×900 두 경로 |

`execution.json`에 실제 명령·종료값·시간, `RUN_LOGS.json`에 raw/*/command.log별 원본 출력을 합쳐 보관했다. 총괄이 파일 수를 줄인 포장 변경이며 로그 내용은 그대로다. 기존 저장소 테스트를 별도 실행한 것과 독립 작성 probe를 구별한다. 기존 회귀군의 명시된 저장소·오류 주입 fixture는 그대로며, 별도 probe는 정상 프로젝트 복구 파일 선택→파일 확인 대화상자→제안 JSON 파일 선택으로 진입했다. 별도 probe는 브라우저 저장소를 읽어 비교만 하고 상태를 주입하지 않았다. 모든 브라우저는 새 격리 컨텍스트와 직접 localhost HTTP·native storage/WebLocks를 사용했으며 유료 AI 호출은 0이다. 기존 테스트의 PNG 저장만 생략했고 독립 PNG 3개만 남겼다.

## 별도 반례의 관측

1. 후보/발췌/refs/missing 배열 및 JSON 루트 키 순서를 바꾼 동일 입력은 이전 제외·분리 상태를 재사용했다. 제안 3개에서 C3:E07과 C3:E06+E08로 분리해도 새 인과나 새 해석이 생기지 않았고, 원래 해석은 접힌 참고 정보였다. E07 잘림·배정 예고·빠진 경로 상세가 남았다.
2. 동일 source ID·후보 ID에서 E07 원문과 올바른 quote hash를 함께 바꾼 입력은 별도 검토가 됐다. 기존 제외·분리 표시는 이어받지 않았다. 이름에 Pro/Opus를 넣어도 제안은 연결 대기였고 프로젝트·작업 자동 연결은 없었다.
3. 원문 한 글자를 바꾸고 해시를 유지한 입력은 거부됐으며 현재 목록이 보존되고 오류로 초점이 갔다. 가짜 raw/행 해시는 발췌 문자열 검증과 구별돼 원본을 읽지 않아 확인하지 않았다고 표시됐다. 네 번째 후보와 복수 출처 배열도 거부됐다.
4. HTML 실행 구문을 포함한 label·7,600자 연속 문자열은 문자로 표시되고 DOM img/svg/script와 실행 marker가 생기지 않았다. 두 PC에서 원문 16px, viewport scale 1, ancestor transform/zoom 없음, 가로 overflow 0. 원문 마지막 문자를 스크롤로 표시했고 닫기 버튼도 화면 안에 있었다. 최종 SHA의 대표 PNG는 1280 원문 끝과 1440 분리 해석이다. 이전 SHA의 1440 원문 끝 PNG는 로컬 참고로만 두고 공유 manifest에서 제외했다.
5. 원문→후보 초점 복귀, Tab의 modal 내부 유지, Escape/닫기의 홈 진입 버튼 복귀, 닫기 후 검토 표시 유지, 제외 복원·분리 되돌림을 확인했다. 전체 localStorage/sessionStorage의 key/value bytes가 동일했다. 새로고침하면 검토만 사라졌고 실제 프로젝트 초안·currentTaskId·수동 문장·지도 메모와 카메라가 보존됐다.

`geometry.json`에 두 해상도의 실제 좌표·16px·scale·storage 비교가 있다. 1280 원문 마지막 문자 y=417.5~441.5, 1440 y=597.5~621.5로 화면 안에서 접근됐다.

최종 문구도 실제 DOM에서 확인했다: ‘검토 예제를 열었어요’, ‘← C1 제안으로 돌아가기’, ‘C3에서 E07을(를) 별도 묶음으로 나눴어요’. copy-verified.json에 원문을 기록했다. 임시 MOCK 화면 서버는 총괄의 화면 검토 뒤 종료했다. 각 테스트 서버/브라우저도 lifecycle에서 종료했다.

## 실행 환경과 무결성

Windows 11 10.0.26200, bundled Python 3.12.14, Node v24.19.0, 기존 Playwright 1.57.0·Chrome 155.0.8059.85, 기존 TypeScript 5.8.3를 재사용했다. Node는 package engines의 22 계열과 다르므로 CI와 같은 환경이라고 하지 않는다. TS는 기존 product17-author package를 evidence의 작은 tsc.cmd로 호출했고 Python package는 product36 evidence 경로를 PYTHONPATH로 재사용했다. npm ci 결과가 아니다.

`source-integrity.json`은 source SHA/app tree·변경 경로·원문 SHA256을 기록한다. baseline `43af7412e44c49f0460323153224cdd641a89879` 대비 shared types/domain/storage/validation Git blob이 모두 같다. 검사 뒤 tracked app diff는 비어 있다. 총괄의 untracked WORK_ORDER.md/REVIEW_DECISION.md를 보존했다. static-preview-dist는 빌드 생성물로 untracked 표시되며 총괄의 배포 재사용 요청에 따라 보존했다. `build-manifest.json`은 실제 빌드 산출물 SHA256을 담는다.

독립 probe 최초 실행은 내가 lifecycle setUp 연결을 빠뜨려 page가 없는 하네스 오류로 실패했다. 제품에 도달하기 전 실패이며 `probe-harness-initial-error.log`와 execution.json에 남겼다. evidence의 probe에 setUp을 연결한 후 양PC 경로가 통과했다. 제품이나 수용 조건을 바꾼 수정은 아니다.

## 한계

구조·왕복·표시·저장 경계의 실행 확인이다. 실제 원본 302MB JSONL의 무결성을 이 앱에서 재검증하거나 일반 추출/실시간 AI를 실행하지 않았다. 사람의 의미 이해·모든 입력·모바일·실제 OS IME·다른 브라우저/CI 통과를 입증하지 않는다. 제안은 계속 미연결이며 기존 return 수신을 수행한 결과가 아니다. 최종 이후의 코드 변경은 이 보고의 실행 증거로 자동 포괄하지 않는다.
