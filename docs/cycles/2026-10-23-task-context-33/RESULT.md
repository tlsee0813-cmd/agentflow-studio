# 33 읽는 작업에서 실제 행동으로 — 한정 수용
판정 시점: 2026-10-23 KST. 최종 bfa6591fab4b04727f25de721a41f755a88b3205를 PR18로 checkpoint에 병합했다: 0f8627ef53c85e979301a35420026ad305b56c35. 병합 전 최신 checkpoint의 변경 대상 외 1000개 blob이 모두 보존됐고, app subtree adf88ae1d90bace46485175c531a46ab846a74d0는 검증 후보와 같다. main·gh-pages는 유지했다. 현재 작업은 [ACTIVE](../ACTIVE.md)를 따른다.

## 바뀐 사용자 흐름
읽는 작업의 제목 가까이 실제 고칠 작업·소유 부분과 명시 이어가기를 둔다. 별개 초안은 본문의 기존 입구·대상을 유지한다. 이어간 뒤에는 기존 다음 행동(N) 편집과 파일 결과 인계 구역으로 이동할 수 있다. 이동만으로 값을 저장하거나 H를 생성·복사하지 않는다.
파일을 고르면 기존 검토 내용으로 안내하며, 새 선택의 ‘아직 가져오기 전’과 이미 받은 파일을 구분한다. 명시 가져오기만 현재 작업을 새 보고로 바꾼다. 다른 화면을 보고 돌아온 동안 끝난 파일 읽기는 현재 초점·스크롤을 옮기지 않는다. 파일 선택 결과 자체는 버리지 않는다.

## 연구와 반례가 바꾼 구현
32에서 한 작업 완주가 가능했어도 이어가기·N·선택 후 수신 확인을 찾는 비용이 남았다. [Web Pro 비교](https://chatgpt.com/c/6ada8e89-5b6c-83ee-91a5-1e4bfd328c20)를 Dify·n8n·VS Code 고정 소스와 대조해 기존 구역으로 연결하는 후보A를 선택했다. 새 wizard/전역 확정 막대/별도 수신 작업면은 넣지 않았다. [판단과 원문](RESEARCH.md).

첫673에서는 정상 두PC 완주 및 PC12 검사 성공 뒤에도 두 결함을 확인했다.
- reader 헤더가 약144px 높아져 기존 초안 주행동이1280에서 y718.16–763.16으로 밀렸다. 원729는 y574.17–619.17로 보였다. 기존 REPORT16 단언을 유지하고 중복 draft 안내·불필요한 세로 간격을 줄였다. 실제 대상 안내와 긴 대상의 선택적 상세, 원래 초안 주행동/대상을 보존했다.
- 실제 파일 buffer 반환을 보류한 뒤 history→work 왕복하면 뒤늦은 완료가 y0/nav-work에서 y4005/review heading으로 이동시켰다. 화면 이동으로 안내 자격만 취소하고, 자기 읽기만 정리하는 token으로 보완했다. 같은 화면에서 기다린 새 선택은 정상 안내한다. 이 반례는 자연 파일 지연이 아닌 계측이다.

별도 ‘이전 작업00’ 오류는 복제 뒤 옛 객체의 indexOf가 실패한 결과여서 ID로 번호를 찾도록 고쳤다. notice만 고친4ffa 원본/후보 비교, guard만 고친0e11 비교, 결합 후보 검증을 구분했다.

## 근거 연결과 실제 범위
- [notice 원본/후보](https://github.com/tlsee0813-cmd/agentflow-studio/blob/019683b1eed1461f5944e4dc2906c635133c0c11/docs/transfer/task-context-33/notice00-independent-a/v0/REPORT.md): 후보 exact test02 양PC 통과, 원729 같은 신규 검사 양PC 실패. 원본 뒤 조건의 미실행과 HTTP 수집 수 정정은 함께 읽는다.
- [원673 정상 흐름과 실패](https://github.com/tlsee0813-cmd/agentflow-studio/blob/8ac357a4b77bab9eb70a7f9852c568aff84f898a/docs/transfer/task-context-33/flow-independent-a/v0/REPORT.md): current04/read02/별개draft에서 N만 수정, 정확H 인계·파일 선택·당시 작업문 왕복·명시수신·지도 복귀. 정상2PC 완주, exact02/11 4개 성공과 전체FAIL을 합산하지 않는다. 독립Sol이 raw와 manifest123행/remote124blob, 회수42파일·gzip12개를 대조했다.
- [guard 독립 비교](https://github.com/tlsee0813-cmd/agentflow-studio/blob/4de6d430c48179d669fb96d7ef9a91c7583499cd/docs/transfer/task-context-33/reveal-guard-independent-a/v0/REPORT.md): 동결 controller/judge의 원실패 조건을 그대로 통과, exact test12 양PC 후보 통과/원673 초점 비교 실패. 후보는 context 이동·context 열린 새선택·명시수신 exactH/parent/raw·비대상 보존·새entry 보호까지 도달했다. 원673의 뒤 조건은 미실행이다. Astra가 원자료·검사순서·HTTP를 별도 대조했다.
- [헤더 작성자 근거](https://github.com/tlsee0813-cmd/agentflow-studio/tree/102710165056024f5a1e2d542b044393699ac5f1/docs/transfer/task-context-33/reader-layout-author-v0): app a104d3…/CSS8e4c38…, guard·기존검사 불변. Node24 타입·빌드·AST는 보조 확인이며 지원Node22/실제UI와 구분한다. Astra 정적 대조에서 추가 차단 없음.
- [최종 결합 후보 Cloud](https://github.com/tlsee0813-cmd/agentflow-studio/blob/78f8136695b9c3f0561ffc6a100e1b2e2583731b/docs/transfer/task-context-33/reader-layout-independent-a/v0/REPORT.md): runtime843과 PR bfa의 app subtree가 같다. 기존 REPORT16 test01 양PC2개, PC12 test02/11/12 양PC6개가 통과했다. 고정 REPORT16의1280 초안 주행동은 y595.78–640.78, 대상은646.78–691.16으로 복구했다. T2 짧은 조작은 펼침 키보드 왕복·명시 이어가기·N만 변경·정확H 인계·파일 선택 후 미수신까지이며 그 구간의 수신 완료를 주장하지 않는다.
- 같은 최종 실행에서 동결 지연 controller/judge의 같은 화면 정상 안내와 화면 왕복 후 위치 보존을 확인했다. 별도1280 A→B 파일 선택 겹침은 이전 A 완료가 새 B의 읽기/초점/스크롤을 바꾸지 않고 B만 검토·명시 수신돼 exact H/parent/rawText와 비대상 기록을 보존했다. 다른 완료 순서·자연 지연·모든 rerender로 일반화하지 않는다.
- 독립Sol은 최종 manifest123행/remote124파일, 회수40파일·gzip11개·원자료/HTTP/동일app를 대조했다. 총괄은 REPORT16 1280 첫 화면, T2 1280 제한,1440 선택 후 미수신의 실제 PNG3장을 읽었다. 글자 범위가 line box 위아래 약1px 넘은 수치는 잉크 잘림 실패나 모든 글자 완전 노출로 확대하지 않았다.
- [정확 bfa 최종 CI](https://github.com/tlsee0813-cmd/agentflow-studio/blob/eac51d4b37076840d0c7ef4efbade180e38b0e5d/docs/transfer/task-context-33/ci-bfa659/REPORT.md): run39871706618 Windows·Ubuntu 모두 success, 각 브라우저26묶음256개와 보이는 TAP275개 통과. 양쪽120000자 tail이어서 잘린 앞부분의 타입/일반빌드 개별 exit·실제Node출력·browser.version JSON은 미회수다. 각 warning1개는 액션 Node20→24 전환 안내다. 원673 CI 실패/중간 provider502와 최종 성공을 구분했다.
- 공개 guard 로그에서 개인 로컬 경로를 제거한 사본은 [정정ef9](https://github.com/tlsee0813-cmd/agentflow-studio/tree/ef9ce5fcf4253aae9090aa926d888edeeee762fd/docs/transfer/task-context-33)로 연결한다. 원실패·과거 커밋은 보존했고 무손실 gzip/현재 공개 경로 정정을 검증했다.

## 남는 경험과 다음 관문
가져오기 안내가 남고 현재 설명이 긴 T2의1280 reader에서는 별개 초안 입구가 첫 화면 밖에 남는다. 원729의 같은 T2 대표 PNG에서도 해당 입구는 첫 화면에 없다. 원본의 정확 좌표 raw는 회수되지 않아 정량 차이는 미확정이다. 최종1280 T2의 초안 주행동 y760.52–805.52, 대상811.52–855.89가 화면 아래에 남는다. REPORT16 고정 장면의 회귀 복구를 모든 reader의 무스크롤 행동 노출로 확대하지 않는다.
두PC 정상 흐름은 개선 가능성을 보여 주지만 관측자는32를 수행한 AI이고 최초 발견성/사람 이해 개선을 증명하지 않는다. N을 고친 뒤 파일 이동 입구를 위해 다시 위로 스크롤한 비용은 남았다. 이 사실만으로 후보B나 고정 전역 막대를 자동 채택하지 않는다.
33은 지도 전체에서 다음 읽을 부분을 찾는 문제를 해결하지 않는다. 전체 지도에서 작은 글자와 실제 판단 정보 부족을 구분하는34 관문을 이어간다. 수신 report11은 manual-mode 결과 보고이며 새 사용자 요청·실제AI생성으로 해석하지 않는다. 수신·보존은 실행/완료/현재 조건 채택의 증거가 아니다.
