# 경험41 — 지도 선택과 집중 이어가기

상태: 수용. 정확 최종 양OS CI 성공 뒤 checkpoint로 fast-forward했고 PR23은 merged다. 기존 공개 GitHub Pages에 경험41을 게시했다.

수용 source `6840496f2d4a41d7e396f0febea3cc4cb1f90702`, app tree `5f42a2c6f5cbdb295cbb7ad7a71a1e36275b66f9`. 기준은 `a88458235e7bb4956546dfdee49a4361278c4958`의 수용40이다. [PR23](https://github.com/tlsee0813-cmd/agentflow-studio/pull/23).

실행 검증은 `b74b2597a8d8ab8ab8feeda27a74867520ce130b`에서 했다. 최종6840496은 BRANCH31의 비영점 지도 높이 기대값을 위에서 선택한 문서상 위치 규칙에 맞춘 테스트 파일만 바꿨다. 제품 src/public/runtime는 동일하며, 실행 SHA와 최종 CI SHA를 구분한다.

## 제품 판단

지도 카드 본문으로 부분을 선택하면 지도 옆에서 해당 부분과 이어갈 작업을 먼저 읽는다. 명시적인 이어가기로 작업문 편집에 들어가며, 원문·근거·중복 맥락은 필요할 때 펼친다. 선택만으로 현재 작업을 바꾸지 않는다. 짧은 프로젝트/예제 표시와 고정 행동으로 지도 공간을 확보했다.

1280 첫 작업 화면에서 실제 편집란 전체가 보인다. 총괄 IAB 관측은 y364.25..664.25, 높이300px이다. 처음 작성한 작업문을 지도 패널에서 읽고 다시 이어가면 동일 텍스트와 입력 초점으로 돌아왔다. 예제 닫기 뒤 목록은 비었고, 새 프로젝트는 목적 입력에 초점을 둔 빈 내용/scroll0으로 시작했다.

지도 높이는 문서상 위치를 기준으로 계산한다. 휠로 내려서 출발해도 복귀 때 지도를 다시 늘리지 않는다. 이 규칙은 과거30의 비영점 복귀 시 화면 아래까지 재확장하던 동작을 의도적으로 바꾼다. 창 크기·실제 상단 내용 변경은 계속 반영하며 카메라를 자동으로 다시 맞추지 않는다. [선택 근거](REVIEW_DECISION.md).

## 증거와 수용 경계

- 작성자: 같은 Claude41 세션의 좁은 후속으로 구현했다. 정확 버전별 실행/미완료는 [AUTHOR](AUTHOR.md)에 구분한다.
- 독립 실행: 작성자와 분리한 Sol High가 기존 Windows 환경에서 정상 백업 입력·예제·실제 휠/클릭으로 실행한다. 최종 결과는 [독립 보고서](independent41/INDEPENDENT_RESULT.md)에 기록한다.
- 정적 검토: 별도 Sol High가 exact source의 저장/초안/출처 계약과 마지막 변경을 검토했다. [SOURCE_REVIEW](SOURCE_REVIEW.md). 실행 통과를 대신하지 않는다.
- 총괄: 별도 IAB1280에서 홈→예제→선택→편집→반복 복귀→예제 닫기→빈 새 프로젝트를 직접 확인했다. 예제 수정 후 두 번의 복귀에서 scroll0/maptop202.8/height501.2가 유지됐다.
- 정확 최종 SHA의 양OS CI와 배포 검증은 [CI](CI.md)에 별도 기록한다. 양OS 모두 completed/success다.

초기 후보의 반례와 수정 판단은 [EVALUATION](EVALUATION.md)에 남긴다. 코드 검사만으로 제품 완성으로 판단하지 않았다. 125% 상당은1024×576 CSS viewport/DPR1.25이며 실제 브라우저 줌 조작은 아니다. 합성 입력과 MOCK 실행이며 사람 사용성·실제 AI 의미 품질·임의 규모의 모든 지도 가독성을 검증했다는 뜻이 아니다. Q02/Q06의 기존 관측39/검토40 범위는 확장하지 않는다.

## 게시 기준

- [기존 PC 체험본](https://tlsee0813-cmd.github.io/agentflow-studio/). 새 사이트나 계정 전환 없이 기존 gh-pages를 갱신했다.
- 배포 `77a3c0bd18e536bcb99b342c5d5b20fd84ea32be`, runtime tree `d31f701199beb83609ef42ca11d329ff1f8170ae`. [배포 manifest](DEPLOYMENT.json).
- 코드 이력 신규 blob43개와 runtime20개를 실제 DeepSeek 키와 메모리 안에서 대조해 일치0건. 키 값·원본 JSONL·서버 코드는 공개 번들에 넣지 않았다.
- rollback 배포는 `d2ecd38141384ce54b69563f2512a15beb4a53f8`. 공개 HTTP 일치와 실제 화면은 [게시 검증·정리](RELEASE.md)에 구분한다.
