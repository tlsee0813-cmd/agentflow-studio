# 125 — 수용된 기존 지도 작업용 후보의 공개 전달

124에서 확인한 기존 지도 읽기·편집·변경안·동결 요청·저장된 반환 읽기를 별도 주소로 전달한다. 새 기반 기능이나 모델 실험을 추가하지 않는다. 공개73 원주소는 유지한다.

대상은 https://agentflow-studio-existing-map-124.tlsee0813.workers.dev 이다. 기존 Cloudflare 계정의 Workers 목록에서 이 이름이 없고 공개73 하나만 있음을 읽기로 확인했다. 기존 키와 접속 코드를 서버 binding으로 재사용하며 실제 값은 공개하지 않는다. model은 기존과 같은 deepseek-flash다. [선택과 고정 해시](SELECTION.json).

수용 제품 cfe993f와 54 assets/27 modules를 그대로 전달한다. 추가 설치 없이 현재 clean 저장소를 잠시 해당 커밋으로 고정하고 기존 잠금 의존성으로 빌드한다. 별도 작업 공간 생성 도구가 중첩 저장소 경로를 받지 않아 새 checkout은 만들지 않는다. 현재 작업 브랜치와 stash는 보존하고 완료 후 복귀한다. 업로드 전 guard가 manifest 전체와 실제 요청 bytes를 확인하며 다른 Worker 경로는 거절한다. 원래 배포 스크립트와 제품 코드는 바꾸지 않는다.

업로드는 한 번만 시도한다. 결과 불명확 시 기존 대상을 조회해 회수하며 재전송하지 않는다. 성공 뒤 공개 asset54개·Worker 모듈27개·설정·권한 경계를 대조하고, Root가 실제 공개 PC 화면에서 안내→정상 백업 사본→근거→저장된 요청 회수를 확인한다. 새 AI 생성은 하지 않는다. 공개73 원주소와 데이터는 검사로 수정하지 않는다.

공개 smoke가 실패하면 기존73으로 돌아갈 수 있는 상태를 유지하고 실패 원인과 남은 범위를 기록한다. 전체 첫 자료→첫 지도→작업 결과 이해의 완성 판정과는 구별한다. 배포 API는 [Cloudflare 공식 Scripts API](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/)와 기존 수용 스크립트를 따른다.
