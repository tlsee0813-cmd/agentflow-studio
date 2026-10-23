# 35 PR19 CI 결과

고정 head `81f8a32dcd12a6004274d38bb6edf1ff9a5cdafb`, run `39880425557`의 [Ubuntu job120176226148](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/39880425557/job/120176226148)와 [Windows job120176225980](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/39880425557/job/120176225980)는 모두 completed/success입니다. 체크 상태와 실제 job 로그 결론이 일치합니다. 조회는 Code Review pull_requests_checks만 사용했으며 계정은 생략, head는 모든 요청에서 동일하게 유지했습니다.

각 OS 로그에서 브라우저 26묶음·258개 전부 OK입니다. 마지막 static_browser.py의 세 검사는 개별 출력과 최종 합계를 확인했습니다.

| 항목 | Ubuntu | Windows |
|---|---|---|
| demo↔preview 동일 origin 저장 격리 | OK | OK |
| 표적 쓰기 실패의 기존 값 보존 | OK · 명시 fault injection | OK · 명시 fault injection |
| 기존 static 하위 경로 교환·복구 | OK | OK |
| 위 3개 합계 | 3개 · 6.552초 | 3개 · 7.528초 |

Windows는 기본 static-dist와 --preview static-preview-dist의 완료 문구·서로 다른 static-target.js 해시를 모두 읽었습니다. Ubuntu는 기본 빌드 해시 목록의 중간에서 로그가 시작해 기본 완료 문구는 잘렸고, preview 완료·target 해시는 보입니다. 양쪽 preview target 해시는 `0d847d744ce6dd680cf0d601faf77789973907e89c288cbbe85f8061056ddac9`로 같습니다.

**회수 한계:** 양쪽 로그는 120,000자 tail이며 logTruncated=true입니다. Windows에는 단위 TAP tests275/pass275/fail0 요약이 보이고 Ubuntu는 그 요약도 잘렸습니다. 부모 단위 총수, type·일반 build 명령별 exit, 실제 Node 버전 출력 및 root I6-R 개별 항목은 두 로그 앞부분이라 미회수입니다. 따라서 작성자 Node22.22의 baseline 실패 원인이 Node22.16에서 해결됐다고 개별 원문으로 확정하지 않습니다. 정확 head의 전체 CI 성공과 해당 세부 근거의 미회수를 구분합니다. Playwright1.57.0/Chromium143 설치 기록과 Python3.13.5 경로는 확인 가능하나 실제 browser.version JSON은 회수하지 않았습니다. 전체 artifact를 다운로드하지 않았습니다.

각 check annotation1건은 upload-artifact 액션의 Node20 폐기·Node24 강제 실행 안내로, 제품 Node 실패나 제품의 Node24 검증을 뜻하지 않습니다. 타입/단위를 미실행으로 분류하지 않았으며, 직접 보인 모든 26 browser groups는 실패·미실행 없이 완료됐습니다.

원시 도구 응답은 각 JSON 및 RAW_TOOL_RESPONSES.json의 gzip+base64로 보존하고 원본/공개 SHA와 무손실 해제를 확인합니다. 개인 로컬 경로가 있으면 압축 전에 공개 사본에서만 치환하며 원본은 유지합니다. 이 자료는 로컬 직렬화된 도구 응답으로 전송 원본 바이트나 전체 artifact가 아닙니다. 제품·GitHub 변경, 재실행·취소, Actions API/CLI/다운로드 대체는 하지 않았습니다. Sites 배포 및 Cloud 화면 검증과 별도인 CI 결과입니다.
