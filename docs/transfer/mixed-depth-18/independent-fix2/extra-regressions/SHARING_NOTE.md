# 9330 原본 추가 게시

총괄 지시에 따라 기존 fix2 증거의 새 extra-regressions 하위에 원본을 add-only 공유한다. 부모 independent-fix2/MANIFEST.tsv는 9bf35aff 당시 기존 payload의 동결 manifest이며 변경하지 않는다. 이 하위의 MANIFEST.tsv는 이번 추가 payload(본인 제외)를 크기/SHA로 지정한다. 이전 README의 ‘다음 후보 증거에 포함 예정’은 당시 원문으로 보존했고, 지금은 이 고정 커밋으로 실제 공유했다.

원본 PC13 14개 중5fail/1error, HOME15 21pass, REPORT16 13개중2fail, static1fail. 실제child/collector/tool-observed 종료값 및 원본 stdout/stderr/입력/raw/PNG를 포함한다. static build prerequisite는기존 build-static 경로이고새설치없다. static의 shared/hierarchy.js 파일집합 실패 이후 UI는미실행. source-after는188파일 source동일을 기록한다. root 원자료는 변경하지 않았다.

1280 PC13 실패가 assertion 이전 shot보다 먼저 생겨 원본에는 해당 장면 PNG가 없다. 현재 원래 단언/조작을 그대로 선택 실행하고 teardown 직전 rect·clip·elementFromPoint와 PNG만 읽는 별도 진단이 진행 중이며 후속 add-only diagnostics 경로로 공유할 예정이다. 원본 실패와 진단 재실행은 별도이며 성공으로 바꾸지 않는다.
