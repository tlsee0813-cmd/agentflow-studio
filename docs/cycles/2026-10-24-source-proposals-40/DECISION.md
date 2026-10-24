# 출처 있는 연결 대기 제안40 — 총괄 판단

2026-10-24 KST. 대상 source `44cfc9ade567b3b7cfe66af57d9762d5bf1ead39`, app tree `c6172dd71c592ae331931b5d9e5ca5b60b0e77d0`, [PR22](https://github.com/tlsee0813-cmd/agentflow-studio/pull/22). 독립 최종 delta 검증·양OS CI 성공을 확인해 수용했고 기존 공개 Pages에 게시했다.

## 선택한 사용자 흐름

프로젝트 홈의 작은 ‘기록 제안 검토’ 진입 → 명시 예제/작은 JSON 가져오기 → 연결 대기 제안 → 특정 원문 → 같은 제안 → 제외/되돌림·근거별 분리·다시 검토 → 원래 홈으로 복귀한다. 검토할 때만 별도 읽기 화면을 열어 홈이나 지도를 긴 보고서로 만들지 않는다. 이전38의 프로젝트 홈→예제 지도→부분/작업→이어가기→지도 복귀→예제 닫기→내 프로젝트 시작은 보존한다.

[관측39](../2026-10-24-organizer-observation-39/RESULT.md)의 실제 기록8발췌·독립 보정3후보만 명시 예제로 연결했다. 새 DeepSeek 호출·일반 수집기·AI 추출기는 추가하지 않았다. 원문/역할/잘림·빠진 연결을 보면서 제안을 정리할 수 있지만 실제 project와 연결·적용할 수는 없다. 기존 수신 계약에 가짜 handoff/anchor를 넣지 않았고 수신 dry-run은 **NOT_RUN**이다.

Q06은 이 검토 흐름까지 좁게 전진한다. Q02는 이름이 기존 작업과 같다는 근거가 없음을 보존하며 자동 동일성 병합·개명·별칭 판정은 하지 않는다. 다음 범위 판단에는 실제 project/task/export와 원문 사이의 연결 근거가 필요하다. 사용자의 사용 기록 제출을 관문으로 만들거나 질문 목록 전체를 일괄 구현하지 않는다.

## 증거를 구별한 판단

- **작성자**: Claude session_014rmcC4wWchSKoq5jwVkZtF, Opus5.5 High. 248320d 구현 후 44cfc9a에서 한국어 조사·복귀 버튼 문구와 AUTHOR 문서만 수정했다. [AUTHOR](AUTHOR.md)의 Linux/Node22.22 결과는 작성자 주장이다. root test는 버전 고정 검사1건 실패(278/279)로 기록했고 성공으로 세지 않는다.
- **독립 실행**: Sol6.1 High가 같은 제품 checkout과 이미 있던 TS5.8.3·Windows Chrome155·Node24로 실행했다. 설치·의존성 사본·새 worktree 없음. 248320d에서 root type/boundary/build, continuity287/287, SOURCE40 6/6·ENTRY37 10/10·MAP36 12/12·HOME15 21/21·static4/4와 별도 반례가 통과했다. 최종44cfc9a에서도 check/build·SOURCE40 6/6·static4/4·양PC5반례가 재통과했다. 정확 실행 결과는 [independent40/REPORT.md](independent40/REPORT.md)에 따로 둔다. Cloud 실행으로 표기하지 않는다.
- **총괄 직접 화면 검토**: 248320d의 실제 로컬 브라우저에서 홈→검토→예제→E01 원문→C1→닫기와 진입 버튼 초점 복귀를 확인했다. 독립1280 긴 원문 끝과1440 후보 화면을 직접 읽었다. 최종1280 원문끝·1440 E07분리 화면도 직접 읽어 문구 수정과 원래 해석의 접힘을 확인했다. 원문16px·배율1·가로 넘침0의 단일 읽기 영역을 수용 기준으로 삼는다. 긴 본문은 내부 세로 스크롤하며 전체를 한 화면에 보여준다는 뜻은 아니다.
- **CI**: [최종 SHA CI](CI.md). Code Review 인증 오류와 GitHub 원격 Git 접근을 구별한다. 초기 조회 실패 때 공개 Actions 웹 UI에서 정확 SHA의 진행 상태를 확인했다. 이후 GitHub connector 재노출과 함께 Code Review 조회가 정상화되어 최종 결론은 이 도구로 회수한다. 계정 전환·재설치·CLI CI 조회는 하지 않았다.
- **미실행**: 사람 사용성, 실제 AI 의미 정확성, 125%/IME/스크린리더 낭독/다른 탭 동시성은 검증하지 않았다. 기존 지도78%의 작은 글자 문제까지 해결했다고 하지 않는다.

## 통과해야 하는 반례와 경계

같은 입력의 순서 변경은 검토를 중복하지 않는다. 같은 ID라도 원문·근거·해석이 바뀌면 새 검토를 만들고 기존 제외 판단을 상속하지 않는다. quote SHA는 실제 문자열로 다시 계산하며 원본 파일/행 SHA는 미검증 기록값으로 표시한다. 변조 quote·없는/중복 ref·과대/잘못된 형식은 현재 검토를 훼손하지 않고 거절한다. HTML은 글자로 읽는다.

근거 분리는 원래 refs를 나누며 원래 종합 해석을 각 발췌의 사실로 복제하지 않는다. E07 잘림과 실제 실행 관측0을 유지한다. 제외 취소는 검토 상태만 되돌린다. project bytes·초안·지도 memo는 검토 전후 동일하다. 검토는 탭 메모리에만 있어 새로고침하면 사라진다고 상시 알린다.

## 접수·범위·보관

Claude 구현 메시지1, 반례 후속2, PR 후속3(화면 메시지5)만 사용했다. 후속3은 이미 생성된 PR22를 재사용한다. Pro Oracle `af-source-review-40-20261024`/exec3771은 completed·exit0, [공식 패턴2개와 채택 판단](REVIEW_DECISION.md)을 남겼다. 같은 결과를 다시 제출하지 않았다. DeepSeek39는 기존 결과 재사용이며40에 새 분류를 제출하지 않았다.

코드와 최소 증거는 이 cycle 한곳, 공개 runtime은 기존 gh-pages에 둔다. ZIP·원본JSONL·의존성을 저장소에 추가하지 않는다. 실제 키와 배포 파일/이번 변경 blob을 메모리에서 대조하며 키 값은 출력·문서·브라우저로 전송하지 않는다. 최종 게시와 HTTP 바이트 확인은 [DEPLOYMENT.json](DEPLOYMENT.json)에 기록한다. 이전38 정리 차단 잔여물은 별도이며 이번 작업으로 지워졌다고 하지 않는다.

## 최종 게시

[기존 PC 체험본](https://tlsee0813-cmd.github.io/agentflow-studio/)의 배포는 `d2ecd38141384ce54b69563f2512a15beb4a53f8`, rollback은 `4ebf8fa39df1353f9853aa3819c6917a609aa74b`다. runtime20개는 preview target이며 서버/키/원본JSONL 없이 MOCK으로 실행된다. HTTP19개(.nojekyll 제외)의 길이·SHA256이 모두 일치했다. [배포](DEPLOYMENT.json) · [HTTP 확인](HTTP_VERIFICATION.json) · [공개 화면 왕복](PUBLIC_UI.md). 새 사이트·새 저장소·ZIP을 만들지 않았다.
