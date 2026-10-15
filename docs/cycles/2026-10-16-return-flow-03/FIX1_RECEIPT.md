# cycle03 화면 fix1 수령 확인

- ZIP: `C:/Users/이준혁/Downloads/cycle03-fix1.zip`
- ZIP SHA256: `d5a90e0557ea232553f5308af950196d9d933cc2611a16dab9b5b2c9c6a7d423`
- 추출: `work/return-flow03-fix1/`. 추출 전 대상 없음, 전체 경로 안전, 부모탈출·중복·심볼릭 링크 없음 확인.
- **11파일 + 2디렉터리 = 13항목, 325,892 bytes.**
- manifest 대상 10파일 전부 SHA256 일치·누락 없음. manifest 자체는 자기 목록에서 제외하며 파일별 크기/해시는 `work/research/return-flow03-fix1-receipt.json`에 모두 기록했다.

HTML은 42,241 bytes이고 SHA256은 예상한 **`af748df1dfacb7ed6b4ae3709d5ced26ef43f96bc45a9e6c2c05cdc02e9cc77e`**와 일치한다. 원본 그대로 기존 HTTP 루트의 `work/cycle/docs/cycles/2026-10-15-mixed-depth-01/return-flow-study-fix1.html`에 복사했으며 원본/복사 SHA가 같다. 대상 파일은 복사 전 없었다. 기존 서버용 주소는 `http://127.0.0.1:8765/return-flow-study-fix1.html`이고 이 수령 작업에서 HTTP 요청이나 새 서버를 실행한 것은 아니다. 앞선 원본 폴더와 기존 `return-flow-study.html`은 수정하지 않았다.

## 수정 주장·바이트 대조

FIX1_REPORT와 동봉 diff의 변경은 다음 세 갈래다.

1. 기본 화면의 FIX058/FIX059/FIX061 등 기술 식별자를 사용자 문장으로 바꾸고 상세 맥락에는 남김.
2. 헤더에 프로젝트 목적 한 문장과 ‘연구 시안’ 표시 추가.
3. 관련 영역 목록 중복을 문장으로 합치고 영향 영역 안내를 줄여, 선/묶음 경계 설명은 접힌 도움말로 옮김.

실제 수령한 v0/fix1의 script 블록은 각각 하나다. fix1에서 바뀐 단일 표시 문자열(저장 복구의 후속 보완 문장)을 원래 문자열로 되돌린 **메모리상의 비교 결과 script 전체가 정확히 같다.** 이는 동작 함수 보존 주장과 일치한다. HTML/CSS 배치 변경의 실제 화면 효과까지 무변경을 뜻하지는 않는다. 원본 파일을 수정하거나 검사기를 실행하지 않았다.

## 작성자 실행 증거와 제한

`logs/run_record.txt`는 원본 파일·HTTP 응답 실행 전후 SHA가 모두 위 fix1 해시, HTTP 200/42,241 bytes, 실제 exit 0이라고 기록한다. 상세 JSON의 html_sha256과 verdict exit 0도 일치한다. 정상 기록은 1440×900·390×844에서 각 필수 14단계 PASS, 오류 배열 없음, 외부 원문 왕복은 href만 확인한 NOT_RUN이다. **작성자 로그 URL은 8766**이며, 이번에 만든 8765의 별도 파일 복사와 구분한다.

참조 검사기 SHA `5ec3234d306cc7eea16d04779ca4cd0ee3e976ffa61cd5f45c67a97e79c4b108`는 보완 ZIP에서 회수한 검사기 파일의 직접 계산값과 같다. fix1 ZIP 자체에는 검사기가 다시 포함되지 않았다.

이는 작성자 회수 증거이며 수령 담당자의 독립 브라우저 통과 판정은 아니다. 390×664·실제 외부 원문 읽기/왕복·사람 관찰은 확인되지 않았다. PNG 2장은 해시만 대조했고 이번 수령 작업에서 열람하지 않았다. 이후 독립 실행은 이 고정 바이트를 대상으로 별도 기록해야 한다.

구성: HTML, FIX1_REPORT, html_fix1.diff, 기본 화면 PNG 2장, JSON/TXT/stdout/stderr/run_record 5개 로그, manifest. 새 브라우저 검사·환경 변경·원격 쓰기는 하지 않았다.

