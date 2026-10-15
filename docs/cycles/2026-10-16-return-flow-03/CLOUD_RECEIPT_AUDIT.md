# Return-flow cycle03 fix1 Cloud 수령·증거 감사

**결과: 수령·무결성·실행 메타데이터 사이의 중요 불일치는 발견하지 않았다.** 지정 경로의 16파일만 추가됐으며 PNG 3장을 포함한 manifest 대상 15파일의 크기와 SHA256이 전부 일치한다. 이 감사는 고정 증거의 대조이며, 새 브라우저 실행이나 검사기 전체 정확성 심사는 아니다. 코드의 세부 판정 타당성은 별도 담당 감사로 분리한다.

고정 증거: [0201912의 fix1 묶음](https://github.com/tlsee0813-cmd/agentflow-studio/tree/0201912a2e05ae920337bf25c9e2d116142c94d7/docs/transfer/return-flow-03/fix1). 파일별 해시·실행 요약은 [CLOUD_RECEIPT_MANIFEST.json](CLOUD_RECEIPT_MANIFEST.json)에 기록했다.

## 경로·원본 바이트

GitHub connector의 commit/compare 결과를 대조했다. 기준 `afb5252d86ceb567fee889f28992d48ba89446a4`→`0201912a2e05ae920337bf25c9e2d116142c94d7`는 ahead 1/behind 0/총 1커밋이며, 변경은 전부 `docs/transfer/return-flow-03/fix1/`의 **16파일 추가**다. 수정·삭제·경로 밖 파일이 없고 manifest 15개 + manifest 자체와 정확히 대응한다.

16개 파일의 내용은 고정 commit의 connector base64를 디코딩한 원본 바이트로 회수했다. manifest 대상 15개는 **581,703 bytes, 15/15 크기·SHA256 일치**, 누락 없음이다. manifest 자체는 자기 목록에서 제외되며 2,478 bytes, SHA256 `bcf3e3c4b43f9461005bf0fce6336c2625ba8a259bbb652b9567c71137a8aede`다. 전체는 **584,181 bytes**다. PNG는 텍스트 변환 없이 바이너리로 대조했다.

대상 연구 commit은 `34b4124098fe6242b34e16e23532ceb3e0fe91ad`로 기록된다. 수령한 fix1 HTML의 로컬 원본 해시를 다시 계산했고 **`af748df1dfacb7ed6b4ae3709d5ced26ef43f96bc45a9e6c2c05cdc02e9cc77e`**다. result의 fileHashBefore/After, 1440×900·390×844 두 실제 HTTP 200 response-body 해시, 도움말 후속 응답 해시가 모두 이 값이다. Cloud 묶음은 HTML을 중복 포함하지 않으며 이번 감사에서 연구 원격 HTML을 다시 내려받거나 실행하지 않았다.

## 실행 기록의 정합

[REPORT](https://github.com/tlsee0813-cmd/agentflow-studio/blob/0201912a2e05ae920337bf25c9e2d116142c94d7/docs/transfer/return-flow-03/fix1/REPORT.md), JSON, process 로그를 대조했다. 환경은 기존 Playwright **1.57.0**, `/usr/bin/chromium` **154.0.8037.57**, 기본 devicePixelRatio 1이다. 실제 주 실행 URL은 `http://127.0.0.1:33687/return-flow-study.html`.

시각은 JSON.parse로 문자열 그대로 읽었다. PowerShell 날짜 파싱·재직렬화 값을 원문으로 사용하지 않았다.

- 시작 원문: `2026-10-15T17:18:04.859160+00:00`
- 종료 원문: `2026-10-15T17:18:18.840667+00:00`

1440×900·390×844 각각 stage 1~8이 한 번씩 있으며 **expected/executed 16/16, complete=true, 16 PASS/0 FAIL**이다. stage 8 안에 작은 흐름 한 번 반복이 들어가며 개별 assertion 수나 사람 성공률이 아니다. process.log, result.exit_code=0 및 별도 process-exit.json의 actual_process_exit=0이 일치한다. fatal=null, pageerrors=[], cleanup_errors=[]도 별도 pageerrors.json과 맞는다. 유일한 콘솔 resource error는 server.log의 favicon.ico 404와 대응한다. 이를 JavaScript 오류 0개와 혼동하지 않았다.

도움말 열기만 분리한 후속 결과는 **별도 PASS/실제 exit 0**이며 16단계에 추가 합산하지 않는다. actual URL `http://127.0.0.1:41235/return-flow-study.html`, 응답 해시 동일, endpoint error 네 쌍 모두 0, fatal/pageerrors 없음이 JSON·로그·help-process-exit와 맞는다. **후속 자체의 실행 시각은 기록되지 않았다.** 주 실행 시각이나 commit 시각을 후속 시각으로 대체하지 않는다.

## 시각 증거와 범위

다음 두 PNG를 connector base64 → 로컬 원본 파일 → view_image로 직접 열람했다.

- `1440x900-returned-map.png`: 120% 지도에서 목적 정정 선택, 열려 있는 도움말, 관련 선·영역, 전체 복귀 뒤 화면이 보인다. 스크롤 때문에 아래 노드는 화면 밖이며, 모든 노드 동시 가시성을 주장하지 않는다.
- `390-prep-lower-conditions.png`: 준비 모달의 보존 조건, 수신자 ‘기록에 없음’을 포함한 알 수 없는 것, 보내기/수락/완료가 아니라는 하단 안내와 닫기가 실제 보인다. 상단 일부 내용은 스크롤돼 있으므로 준비 내용 전부가 동시에 보인다는 뜻은 아니다.

`390x844-returned-map.png`는 바이트·해시만 검증했다. 이미지 자체는 클릭·초점·기하 복원 검사의 대체 증거가 아니다.

기록은 독립 verify.py 실행이며 작성자 flow_check.py를 재실행하거나 그 PASS 수를 독립 성과로 옮긴 것이 아니다. 실제 mouse click/wheel·Escape가 기록되어 있고, 모바일은 mouse wheel이지 실제 터치 스와이프가 아니다. 읽기 근거는 자연스러운 inline이며 자체 내부 스크롤이 없는 것으로 기록된다. **출발 읽기 위치는 두 화면에서 0→0인 관측**이므로 비초기 읽기 위치 복원 스트레스까지 통과했다고 확대하지 않는다.

명시 미실행/범위 밖: 390×664, 실제 외부 원문 클릭·읽기·왕복, 실제 터치 스와이프, 사람의 이해/부담 관찰, 실제 AI, 실제 인계 전송/수신/수락, 새 작업 복원, 예전 reading-study 검사. 준비 제안을 실제 인계로 해석하면 안 된다. 도움말 후속은 한 번의 데스크톱 기하 관측이다. 모든 배율·읽기 위치·다른 부분의 흐름 보장은 아니다.

새 테스트·서버·환경 설정·인증서 우회·원격 쓰기 없이 수령 감사를 완료했다.

