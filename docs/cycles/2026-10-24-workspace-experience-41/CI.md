# 경험41 CI 기록

정확 최종 source `6840496f2d4a41d7e396f0febea3cc4cb1f90702`의 [run40056301818](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/40056301818)이 **Ubuntu24.04·Windows2022 모두 completed/success**다. Code Review의 정확 headRevision/job 응답으로 확인했다. [기계 판독 기록](CI.json).

| OS | job | 최종 상태 |
|---|---|---|
| Ubuntu24.04 |120760189297|completed/success|
| Windows2022 |120760189411|completed/success|

작성자 환경의 원래 앱 Node278/279 실패는 실제 CI에서 양OS 모두 통과했다. 독립 실행은 b74에서 했으며684의 테스트 하나 변경과 제품 runtime 동일성을 별도로 기록한다. 증거 문서 후속 커밋은 같은 app tree `5f42a2c6f5cbdb295cbb7ad7a71a1e36275b66f9`를 보존하며, 그 문서 커밋에 CI를 실행했다고 주장하지 않는다.

## 초기 후보와 수정 이력

| 소스 | 실행 / job | 관측 |
|---|---|---|
| e3d18827b9b3fd27071ed8620ea4a312257db4e5 | [40051245166](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/40051245166), Ubuntu120744190947 | completed/failure. UI001의 제거된 instruction-preview, 달라진 초안 안내 문구, 접힌 맥락 내 suggestion 접근 경로 실패 |
| 7cb4710009e72c4c66e64ce824ad2915fa8d4dc2 | [40052315142](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/40052315142), Ubuntu120747444016 | completed/failure. PC12 test12 delayed file reveal, 양크기에서 접힌 select-result-file 클릭 timeout. 작성자 현재 수정 트리와 구분 |

첫 후보의 실패 로그는 도구가 제공한 잘린 tail이며 전체 원로그를 회수했다는 뜻이 아니다. job 상태는 별도 정확 SHA 응답으로 확인했다. 두 번째 후보부터 WORK41을 기존 Ubuntu24.04/Windows2022 matrix에 연결했다. 전체 workflow 변경처럼 보인 부분은 줄끝 정규화였으며 실제 단계 추가는7줄이다. 기존 timeout이나 검사를 삭제하지 않았다.

정적 검토는 기존 저장·초안·원문 보존 단언 삭제를 발견하지 못했다. outcome-context를 실제로 펼친 뒤 접근하거나 제거된 읽기 전용 preview 대신 실제 작업문 값을 확인하는 변경과, 사용자가 도달하는 경로를 검사하는 변경을 구별했다. flow090의 행동 위치는330px 제한에서 첫 화면 내로 바뀌었으므로 같은 위치 계약을 유지했다고 주장하지 않는다. 편집의 실질 가시성은 새 WORK41 강화 및 별도 독립 화면 관측으로 확인한다.

작성자 실행, 독립 Windows Chrome155/Node24 실행, 이 양OS CI는 각각 별도 증거다. 125% 상당 검사는1024×576 CSS viewport와 DPR1.25이며 실제 브라우저 UI 줌을 조작했다는 뜻이 아니다.
추가 작성자 진단: PC12 파일 선택 실패는 단순한 테스트 선택자 변경 문제가 아니라, history 왕복 후 이미 오래된 편집 위치 메모가 재적용되어 결과 파일 패널을 닫는 실제 UI 버그였다. 최종 구현은 workMemo를 복귀 시 한 번만 소비하고 다른 경로에서는 폐기한다. 이 실제 버그 수정 뒤 최종 정확 SHA의 PC12와 전체 양OS CI가 통과했다.

중간 c7a752 run40054126454(Ubuntu120753499525/Windows120753499765)와12ebc2d run40054601600(Ubuntu120754936050/Windows120754935948)는 조회 당시 진행 중이었다. PR HEAD가 바뀐 뒤 이전 SHA 조회409는 인증 실패가 아니라 버전 변경 응답이었다. 이후 최종684의 새 CI 양OS 성공을 위 표에서 확인했다.
