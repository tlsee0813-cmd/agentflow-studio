# Cycle19 높이 fix1과 검사 이벤트 대기 분리

2026-10-22. 후보acfafd2dd6426e3fa6fa5443bd2e67d8461608c9. app SHA C3A8E77A96E58758D62EC6819CB902E9F9762362C48A9D60E22CEE00AF15773D, W19 SHA E1FCE56C2509DAC4CB9667F411E78E8B63D5F2F8973110631087AFF5D2682328. CSS/HTML unchanged F97F/190C.

Cloud의 [실패 원본/이벤트 관측](https://github.com/tlsee0813-cmd/agentflow-studio/tree/430f6aa3c3b47f06a640af63da171cd6247c1ec3/docs/transfer/workspace-records-19/independent-v0/failure-first)을 대조했다. 9fb와81d의 W19는각6실행4실패/exit1이며 수정 없이 보존한다. 두 문제는 다르다.

1. 이름 입력으로 가져오기 안내가 사라졌지만 지도 높이는 이전 값에 남았다. 다음 행동 없이100/400/1000ms 유지됐고 다음 records render가 수리했다. renderStatus는 notice.hidden만 바꿨다. UI 작성자가 상태 갱신 뒤 표시중 PC 전체지도의 높이만 재계산하는4줄을 추가했다. Astra는 정확C3A8을 독립 읽고 원인경로 해소/홈·숨은지도guard/재귀없음/기존최종복원순서를 확인했다. scroll clamp 실제영향은브라우저재실행대상이다.

2. brief-edit 닫기 click은 open=false를즉시만들지만 native toggle handler는뒤에처리됐다. Cloud on-target 관측은1280 height240→411.515625,1440 343.328125→591.515625이며앱documentcapture뒤target도같다. 작성자검사는brief-edit에만 trusted activation이후같은details의native targettoggle 완료Promise를기다리도록보완했다. 실패deadline5초는성공sleep이아니고CSS공식/기하조작을넣지않았다. 기존6개test본문/단언은C855와AST동일하다.

검사준비 보완을제품수정으로부르거나최초실패를통과로다시쓰지않는다. 로컬type/build/구문검사만실행했고 실제Cloud/CI는별도다.

## 별도 HOME15 CI 불일치

81d exact Ubuntu [CI39790388931](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/39790388931/job/119865109890)는 HOME15 test08 background list y272 vs120 실패로 종료했다. W19 이전단계실패이므로 해당CI에서W19도완료했다고말하지않는다. [provider 반환 원문](../ci-v1/ubuntu-provider-response.json)의 logTruncated=true를그대로보존했다. 전체로그라고부르지않는다. 기존Cloud9fb HOME15 exit0와다르므로독립재현/시점분할을진행중이다. y0는열기두click이전값이므로dialog열기/자동가시화와본문key/wheel을나눠원인을확인하며아직해소로판정하지않는다.
