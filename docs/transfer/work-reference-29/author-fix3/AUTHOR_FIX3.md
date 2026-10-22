# 작업문 참고29 — AREA17 조건분리 fix3 후보

닫힌 작업문 편집기의 container-type만 제거하는 CSS 한 줄 대조입니다. 열린 때만 query container를 사용하므로 기존 760px 배치 의도는 유지합니다. app.ts, 자동 scroll 보정, Origin, 카메라, 수신·인계 정책, 기존 검사 단언은 수정하지 않았습니다. 원본 fix2는 보존했습니다.

원격 두 diagnostic gzip을 공개 GitHub blob JSON/base64로 받아 메모리에서 해제하고 Git blob/bytes를 검증했습니다. 처음 전달된 base SHA 앞의 27은 tree에서 실제 SHA를 찾아 정정했습니다. connector fetch는 binary UTF8 오류였고 공개 API GET으로 읽었습니다. 24행의 send/copy geometry와 원 READABLE 시점을 구분했습니다. 최종 버튼 pageY는 같고 후보는 첫 send부터 81px 더 아래입니다. base27 Wide는 pending 제거시 copy pageY81.5px 수축과 windowY81px 감소가 동반되지만 f10은 windowY가 남습니다. containment/native scroll anchoring 가설과 맞으나 인과 확정은 아닙니다. 비동기 pending 상태가 click 직후 샷마다 다릅니다.

Cloud에서는 exact AREA17 test06 양PC를 원 단언 그대로 비교해야 합니다. send/대기 표시 제거 단계의 windowY·copy pageY·working 표시·document height·edit-work open을 분리해 주세요. 통과하더라도 열린 참고의 입력 DOM·읽기 위치·명시 재열기는 별도 회귀 범위입니다. 원 실패를 키보드 회복이나 단언 완화로 덮지 않습니다.

Node24.19.0 보조 type/build/diff 모두0. 명령별 원 출력/exit는 type-fix3.*, build-fix3.*, diff-fix3.*이고 기존 DEP0190 build 경고는 남겼습니다. 증거 조립 첫 시도는 UTF8 JSON의 cp949 읽기 오류였으며 encoding 명시 후 완료했습니다. 이 실패는 제품 빌드 실패가 아닙니다. CSS snapshot만 새로 보존하고 app은 fix1과 바이트 동일을 확인했습니다. 단위/서버/브라우저/설치/원격 쓰기는 미실행이며 실제 UI 합격 주장은 하지 않습니다.
