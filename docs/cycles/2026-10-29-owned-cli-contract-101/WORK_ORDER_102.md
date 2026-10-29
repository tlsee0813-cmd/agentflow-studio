# 102 작업 지시 — 내구 작업 소유자에 연결하는 로컬 CLI preview

- 목적: 첫 지도 생성 중 다른 프로젝트 작업/새로고침을 허용하면서 원래 요청의 결과·취소·실행자 수명을 보존한다.101 DESIGN.md의 계약 구현이며 새 모델 실험은 하지 않는다.
- 기준: 이 문서의 Git commit, app3fc2ab0421cda167bd3fbb70c5eaa2a2e9dcc0e5. UI75/693 및97/98/100 수리 유지.
- 작성자: 다음 총괄이 별도 접수할 Claude Code 좁은 구현1명. 독립 Sol High는 새 경계만 검토한다. 현재 작성 세션은 아직 만들지 않았다.
- 변경: createStudioHandler의 서버 주입 경계·실제 executor 상태, Node 전용 cycle preview adapter/실행 정책 metadata·내구 실행 lease. 실제100 API 보안·저장소 재사용. CLI를 Worker에 import하지 않는다. 기본 공급자/환경 설정 유지.
- 입력/완료: 전체 map.6,98 prompt,원본 MapInput/hash. 검증된 완결 응답만ready.100 조회/원래reading identity/명시반영 권한 유지.
- 실행 제한:299초 선택/300초실행자판정,global1/queue0/retry0,크기 제한과tool금지. deadline과AbortSignal을child수명에결속. 종료불명은신규operation도차단,재시작뒤옛child생존과PID재사용을고려. 실제모델호출0.
- 검증: DESIGN.md 새경계표의 fake-child/HTTP/재시작 새ID 차단을검증. 가능하면실제무해한로컬child로종료·orphan경계를확인하되 모델/네트워크호출금지. 코드판본과환경을기록하고작은검사를제품완성으로확대하지않는다.
- 재사용: 기존96 UTF-8/raw byte/stop guard,100 owner/cancel/ready/restart. 완료된연구·모델실패재시도·기존전체검사무조건반복금지. 실제CLI판본0.165의지원/격리경계는단정하지않고필요한차이만확인. 설치/계정/키변경금지.
- 반환: 정확branch/SHA·변경파일·실제검사와작성자주장구별·남는한계. 실행중모델0·실행정책불변확인. draft PR은총괄회수후부착·독립검토·수용별도.
- 제외: 제품기본CLI전환,실제Zephyr호출,원문/응답수선,배포·병합,token/cost보장발명. 실제호출은구현검증후총괄이별도판정한다.
