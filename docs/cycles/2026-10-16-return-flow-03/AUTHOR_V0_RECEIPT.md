# cycle03 첫 ZIP 수령·범위 확인

- ZIP: `C:/Users/이준혁/Downloads/cycle03-return-flow-study.zip`
- ZIP SHA256: `a4f0283db3a5cc2775d6f1aa40c7bbb8e2c3a131dd045c5ec1182f2ad6b9bbff`
- 추출: `work/return-flow03-v0/`. 추출 전 대상 없음 확인. 12개 항목(9파일·3디렉터리)의 정규화 경로·절대경로·부모탈출·중복·심볼릭 링크를 먼저 확인했으며 문제 없음.
- 총 파일 크기 563,451 bytes. 파일별 크기/SHA256은 `work/research/return-flow03-v0-receipt.json`.
- `MANIFEST.sha256`의 8개 대상 전부 일치·누락 없음. manifest 자체는 자신의 목록에서 제외되어 있으며 별도 파일 해시를 JSON에 기록했다.
- HTML 41,476 bytes, SHA256 `f19011eb3b0b31d9ff57ba3fdd519eccb7a01e75ba789d3442f11f5b09778768`.
- 기존 HTTP 루트의 `work/cycle/docs/cycles/2026-10-15-mixed-depth-01/return-flow-study.html`로 바이트 복사했다. 대상 기존 없음·부모 디렉터리 존재 확인, 원본/복사 SHA 일치. 기존 서버에서 사용할 URL은 `http://127.0.0.1:8765/return-flow-study.html`이며 이 수령 작업에서는 HTTP 요청·새 서버·브라우저를 실행하지 않았다. 이 임시 복사본은 cycle01 원격 게시 대상이 아니다.

파일은 HTML, REPORT, MANIFEST, `check/flow_check.py`, JSON/TXT 로그, PNG 3장이다. ZIP 원본 파일은 수정하지 않았다.

## 작성자 주장과 기록된 범위

REPORT는 작성자 자체 검사임을 명시한다. 기본 지도→목적 정정 선택→제자리 근거 읽기/닫기→인계 준비 제안 읽기/닫기→전체 복귀의 작은 흐름과 한 번 반복을 다룬다. 일반 제품 완성이나 실제 인계를 주장하지 않는다.

JSON/TXT는 1440×900와 390×844에서 각각 14개 단계 기록(1–7, 8.2–8.7, 반복 대조 8), 110개 세부 체크가 모두 참이라고 기록한다. 각 14 PASS/0 FAIL/0 UNOBSERVED, 콘솔/pageerror를 모은 배열과 외부 요청 배열은 비어 있다. 브라우저는 작성자 환경 Chromium 141.0.7390.37, REPORT상 Playwright 1.56이며 HTTP 200을 기록한다. 실행 시작 원문은 `2026-10-16T02:01:40+0900`이다. 이를 감사자 독립 실행 결과로 바꾸어 쓰면 안 된다.

클릭은 좌표 mouse.click/390 touchscreen.tap이며, 위치 준비는 wheel이다. 코드 검색상 DOM scrollTo/scrollIntoView 보조 호출은 없고 390도 손가락 스와이프가 아닌 mouse wheel이다. 공통 act 함수는 bounding box 존재 후 좌표 입력하며, 모든 클릭에 중앙 hit-test/조상 clipping을 공통 강제하는 구조는 아니다. 개별 체크의 화면 상태·hit-test 관측 범위로 제한해야 한다.

**미실행/제한:** 390×664, 목적 정정 외 두 부분의 전체 흐름, 실제 외부 GitHub 링크 클릭·원문 읽기·왕복, 사람 사용성 관찰. 외부 원문 왕복은 href만 확인한 NOT_RUN으로 명시되어 있다. 1440에서는 읽기 본문이 한 화면에 들어가 비초기 읽기 위치 복원은 390에서만 의미 있게 시험됐다는 작성자 한계도 유지한다.

## 최초 실패 보존과 검사기 한계

REPORT는 수정 전 실제 관측 4건을 서술한다: 모바일 근거 닫기 후 위치 변화(첫 검사는 기록만 하고 오판정), 사라지던 복귀 sticky 바, 준비 시트 폭/관계 맥락, 모바일 안내 문구. 그러나 ZIP에는 **수정 전 코드·첫 실패 로그/JSON이 없다.** 최종 코드/최종 로그와 서술만 있으므로 이전 실패의 원본 보존이 완료됐다고 말할 수 없다.

`Run.step()`은 예외나 거짓 체크를 FAIL로 기록한다. 하지만 프로그램 끝에 전체 FAIL·pageerror·미완주를 nonzero 종료로 묶는 판정이 없고, 실제 프로세스 종료값 증거도 포함되지 않았다. 따라서 이 작성자 검사기의 프로세스 성공만으로 통과를 판정해서는 안 된다. 이는 검사 증거의 한계이며 HTML 제품 실패를 확정하는 말은 아니다.

이번 작업은 수령·무결성·주장 범위의 빠른 확인이다. 새 테스트, 환경 변경, 브라우저 우회, 원격 쓰기를 하지 않았다.

