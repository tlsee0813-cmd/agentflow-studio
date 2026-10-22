# 27 작성자 v0 원본

v0는 독립 정적 검토에서 task-reader 취소/저장 뒤 편집기가 토큰 없이 다시 열릴 수 있는 P2가 발견된 중간 후보다. fix1은 별도 author-fix1 접두사에 둔다. 최초 parent-build exit1과 .bin shim 환경 준비 오류를 원 stdout/stderr/exit로 보존하고 bootstrap exit0으로 덮어쓰지 않았다.

새8+관련91=99/99는 별도 unit-v0의 Node24 보조 검사다. Cloud UI와 Node22 CI는 별도 단계다. receipt의 pending/notRun은 해당 스냅샷 당시 상태이며 이후 결과로 소급 수정하지 않았다. 큰 source-before/candidate-source/css/html/dist/node_modules는 중복 업로드하지 않는다. source 해시와 fixed v0 commit으로 특정한다. prepare-receipt의 commandsFromApp은 준비 시의 제안 명령이며 실제 실행은 개별 exit 원문을 따른다.
