# Cycle29 새 검사 fix2 실제 실행

정확 2c75d0c6 후보의 신규 검사 SHA 9713415a8acb0b6b700ab460119d6b8dbd666bad0dc6c4106a99d3164be4f4bf를 수정 없이 실행했다. f10 대비 검사 파일만 다르며 제품 app/CSS는 동일하다. 기존 빌드와 Node22.16/PW1.57/Chromium154를 재사용했다. 새 설치·제품 변경·전체 회귀 없음.

8개 메서드 완주: 6 OK, 2 FAIL. child/외부 collector 실제 exit 모두1. 양PC test03 line217에서 동일한 긴 r2를 닫고 재열었을 때 body/summary scrollTop 실제 [150,0], 기대 [0,0]으로 실패했다. 본문 판본·소유자 검사는 그 직전 통과했다. 새 설명 수신과 이후 Range 보존 검사는 이 실행에서는 도달하지 않았다. 기존 독립 정상UI 수신 보존 결과와 합산하지 않는다.

양PC test01/02/04는 통과: 실제 편집 대상 구분, 첫 키 DOM·초점·선택·읽기 위치 및 stale 인계 제외, 작업/프로젝트 전환·held-only 경계. 공개 domain API 합성 fixture를 정상 UI 복구로 가져오는 작성자 검사이며 정상UI 독립 준비 전체 흐름으로 부르지 않는다.

이 실패의 제품/검사 기대 계약 판정은 root 검토 대상이며 임의 수정하지 않았다. 원 traceback·관측·최종 화면을 보존했다. 원 harness는 서버 종료값을 별도 보존하지 않으므로 NOT_CAPTURED. 이번 추가 실행은 HTTP 응답 바이트를 별도 계측하지 않았으며 기존 f10 실행의 HTTP 바인딩을 새 관측이라고 재인용하지 않는다. runtime 환경은 raw/browser-environment.json.gz. 압축 JSON/JSONL은 무손실 복원 SHA를 RAW_INDEX에 기록했다.

AREA17/30 및 전체 회귀는 실행하지 않았다. MANIFEST는 자신을 제외한 정확 payload 집합이다.
