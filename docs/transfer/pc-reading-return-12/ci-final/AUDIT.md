# 제품12 최종 fix2 CI 감사

2026-10-16. [PR #3](https://github.com/tlsee0813-cmd/agentflow-studio/pull/3)의 최종 제품 head **`9613208f40f1f7f8506504ac6025f06e421edd4d`**, [run 38849696070](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/38849696070)를 읽기 전용으로 확인했다. 재실행·원격 수정·댓글·제품/검사 실행은 하지 않았다. artifact 전체를 다운로드하지 않았다.

**두 OS job과 실제 PC12 step26 모두 completed/success다.** Code Review headRevision, 각 job.head_sha, 각 로그의 `git rev-parse HEAD` 출력이 모두 위 SHA와 정확히 일치한다. 서로 다른 커밋의 이전 실행 결과를 섞지 않았다.

| OS / 출처 | PC12 실제 실행 구간(UTC) | 확인 |
|---|---|---|
| [Ubuntu 24.04 job116807946213](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/38849696070/job/116807946213) | 04:21:29.2825421 단계 시작 → 04:21:59.9663428 OK | 15개 이름별 ok, `Ran 15 tests in 30.562s`, step26 success |
| [Windows 2022 job116807946571](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/38849696070/job/116807946571) | 04:22:25.6904197 단계 시작 → 04:22:53.2895737 OK | 15개 이름별 ok, `Ran 15 tests in 27.449s`, step26 success |

실제 명령은 두 OS 모두 `python continuity/tests/pc12_browser.py 2>&1 | tee test-results/pc12-browser.log`다. shell에 `-e -o pipefail`, 환경에 직접 HTTP/MOCK·유료 AI 비활성·UTF-8이 남는다. 15개는 기존 13개와 영역 화면 출발 왕복 두 폭을 포함한다. 두 OS를 30개의 서로 다른 사용자 장면이나 단일 합격 수로 합산하지 않는다.

## 보존 파일과 추출 기준

- `ubuntu.pc12-step.log`, `windows.pc12-step.log`: 원본 decoded job log에서 PC12 명령 앞의 `##[group]`부터 다음 `##[group]` 직전까지의 **연속 구간 전체**. 명령·shell/env·15개 테스트·Ran/OK를 포함한다. 다음 static 단계는 넣지 않았다.
- `ubuntu.runtime.log`, `windows.runtime.log`: `git rev-parse HEAD | tee test-results/commit.txt`가 있는 단계의 연속 구간 전체와, 같은 로그에서 `Successfully set up CPython`, `Successfully installed .*playwright`, `Chromium .*downloaded`에 맞는 설치 줄만 추가했다. 연결된 여러 구간임을 이 기준으로 밝힌다.
- `ubuntu.source.json`, `windows.source.json`: 정확한 head/job/step26 상태, job·API URL, 사용 도구, 원본 decoded log 내 추출 줄 위치와 조건을 기록한다. step 상태는 job 성공으로 추정하지 않고 GitHub step API에서 별도로 확인했다.
- `MANIFEST.sha256`: 이 작은 묶음의 파일 bytes/SHA. 전체 job 로그나 artifact의 bytes 전수 감사라는 뜻은 아니다.

Code Review `pull_requests_checks`의 providerGuidance를 따라 같은 headRevision과 runId/jobId를 유지하고, 상태 조회는 60초를 넘겨 간격을 두었다. 완료 job의 Code Review 로그는 `logTruncated=true`라 앞부분이 잘린다. 정확한 환경·커밋 출력을 보완하기 위해 같은 job의 GitHub 읽기 전용 step/log 도구를 사용해 decoded job log를 메모리에서 읽고 위 작은 구간만 저장했다. PC12 전체 구간이 Code Review tail과도 동일함을 CR/LF 차이를 제외하고 대조했다. 로그의 시각 문자열·내용·ANSI는 유지하며 발췌 저장에서 줄바꿈은 LF로 정규화될 수 있다. 전체 로그·artifact는 로컬에 보관하지 않았다.

두 OS 로그에서 실제 Node 출력 **v22.16.0**, npm **10.9.2**, CPython 설정 **3.13.5**, Playwright 설치 **1.57.0**, Chromium/Headless Shell 다운로드 **143.0.7499.4 / build1200**를 확인했다. 마지막 항목은 설치/다운로드 로그이며, artifact의 `browser.version()` 환경 파일을 별도로 회수한 결과는 아니다.

원본 artifact는 [Ubuntu12024926316](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/38849696070/artifacts/12024926316), [Windows12024079538](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/38849696070/artifacts/12024079538)다. 업로드 완료 URL만 로그에서 확인했고 내용 전체를 감사하지 않았다. 최종 CI에 실패한 job/PC12 단계는 없으므로 환경 실패나 코드 실패로 새로 분류할 사건은 없다.

이 결과는 최종 SHA의 CI 실행과 Windows 연결을 확인한 근거다. 별도 Cloud 고정 검사·실제 UX 관측과 구분하며, 병합·배포·실제 AI 의미 품질·사람 이해도 성공을 뜻하지 않는다. GUIDE107 HOLD를 변경하는 근거도 아니다.
