# 103 한 건 관측 — 실제 Zephyr 기록으로 정상 제품 경로 판정

102 [범위 수용](../2026-10-29-owned-cli-preview-102/ROOT_ACCEPTANCE.md) 뒤101에서 이미 정한 Zephyr1건을 실행한다. 사용자 추가검토의 '안정화 뒤 전체 사용 경험으로 성과 확인'을 수용한 후속 관측이며 새 기반 설계나 이전 실패 재실험이 아니다.

총괄은 frozen 원본·기준·102 실행자 아래 **새 top-level 생성1회만 선택**한다. 설치 CLI0.165.0-alpha.1.2, gpt-6.1-sol/high,98 FIRST map.6 지침을 사용한다. output-schema와 사후 수선은 없다. UI 접수→다른 프로젝트 편집/새로고침→원 프로젝트 결과 회수→명시 반영→원문 근거·전체 백업을 확인한다. 실패·cutoff·의미 반려이면 후속 자료·재시도·fallback0으로 마친다.

실행자는 기존102의 전역1child/큐0/앱재시도0,299000ms선택/300000ms판정,stdout512KiB/stderr128KiB/final128KiB를 지킨다. **토큰·금액 hard cap은 확인하지 못했으며 총괄은 그 한계를 명시하고 이1건의 운영 범위를 선택한다.** 시간·byte 제한을 과금 상한으로 해석하지 않는다. 원격 연산/과금 중단과 내부 transport retry횟수도 보장하지 않는다. 실험 rollout_budget 설정을 강제 상한의 증거로 쓰지 않는다. 기존 인증을 유지하고 설치·계정·키 변경은0이다.

권한 요청은 ignore-user-config/ephemeral/read-only/빈cwd,web_search disabled 및 shell/apps/plugins/browser/computer/delegation/hooks/memory 등18개 기능 disable이다. 기존인증은 사용한다. [공식 CLI 문서](https://learn.chatgpt.com/docs/developer-commands?surface=cli)의 ignore-user-config는 인증과 설정을 구별하고, [설정 문서](https://learn.chatgpt.com/docs/config-file/config-reference)는 shell tool과web 설정을 설명한다. 설치binary의 도움말/기능명도 확인했다. 이것을 실제모델에 제공되는 모든tool inventory의 실증으로 주장하지 않는다. unified_exec opt-out은 무시될 수 있어 상위 shell/code-mode 설정을 함께 닫는다. 출력에서 tool/unknown event를 발견하면 거절하되 사후검출이 이미 일어난 동작을 예방했다고 주장하지 않는다.

원본 전체 ask는 이전76 원본과 동일함을 확인했다. Z1–Z4 및 FAST/default/sleep독립사실·B1/B72대응·always-on제약·문서/DTS와실물확인구별을 미리 고정했다. 명칭/노드수/인용량만으로 의미합격을 판정하지 않는다. 판본·prompt·전달경로가 바뀌었으므로 결과를 시간연장만의 효과로 귀속하지 않는다.89/91/92/96은 당시 판정대로 남긴다.

정상102 서버·실행자·저장소를 사용하며 private관측launcher는 spawn을 그대로 전달하고 stdout/stderr를 제한된크기로 복사한다. 응답/입력/정책/취소를 대체하지 않는다. 이로써 실패해도 원응답·진단을 다시호출하지 않고 분석할 수 있다. 원문·raw·자격정보는 로컬에만 두고 판정과 최소metadata를 공유한다. [동결 기록](evidence/frozen.json),[독립 정책 검토](evidence/gate-review.json).

현재: 실행 전. 통과해도 이한표본의 범위 결과다. 공개73/미수용74/UI수용75,PR61draft미병합을 유지한다. 이후 연결된 체험과 독립적으로 공개 가능한 개선/보류사유를 판정한다.
