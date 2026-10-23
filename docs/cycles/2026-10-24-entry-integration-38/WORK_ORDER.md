# 36/37 연결 경험 — 좁은 후속

2026-10-24 KST. 총괄의 작업 지시. 제품 수용 기준은 아직35.

- 담당: 기존 Claude37 `session_01KJRKarPuyzvnMWCkvYQbW1`, Opus5.5 High. 같은 문제의 짧은 후속.
- 목적: PC 홈→비저장 예제 지도→부분/작업→이어가기→지도 복귀→예제 닫기→내 프로젝트 시작을 보이는 하나의 경험으로 완성.
- repo `tlsee0813-cmd/agentflow-studio`. 기존 반환 `20bffe5fe33f11b29870a9025d2ac0089837abfb`, branch `product/project-entry-37`. 36fix2 `38beb55922e3e982f0f32fddacd5e18a5e157a15`를 명시적으로 결합. checkpoint `4a9873a5a78fe1cfe48646fc912796025b639440`의 인계·ACTIVE·QUESTIONS 문서는 최종 총괄 통합에서 보존.
- 관련 입력: 기존37 AUTHOR/MECHANISM_REVIEW/PRO_RESPONSE와36 AUTHOR, app/continuity/src/client/app.ts 및 public/styles.css, tests/entry37_browser.py·map-priority36_browser.py. 완료된 연구 반복 금지.
- 수정 범위: 36fix2를 merge 또는 정확 cherry-pick한 뒤 복귀 안내의 표시 수명/위치만 좁게 수정. 관련 브라우저 검사와 기존37 AUTHOR 갱신. 도메인/저장 스키마/새 수집기/전역 배율 재설계/다른 브랜치/배포는 제외.
- 재현: 1280×720 예제의 시간 고르기→작업01→이어가기→전체 공간. 기존 안내가 남아 지도 높이를 줄이고 하단2카드가 밖으로 밀림. 카메라 transform 동일은 통과 조건이 아님.
- 완료: 1280×720·1440×900 실제 표시 및 원래 가용 높이/카드 가림 확인, 이유/본문 잘림 없음, 작업 안내를 필요한 곳에서 읽을 수 있음, 초안 보존·내 프로젝트 오염 없음·예제 비저장·재방문 복원 유지. 단언 삭제/완화로 통과 금지. 전후 실패/성공을 같은 반례로 기록.
- 반환: branch/정확 최종SHA,36fix2 포함 근거, 변경 요약, 환경/명령/exit, 실제 화면 관측, 미실행, 대표 PNG 최대4장과 최소 manifest/해시를 GitHub. 원자료/비공개 로그/인증정보는 커밋 금지. 최종 수용·양OS CI·게시 판단은 총괄 담당.
