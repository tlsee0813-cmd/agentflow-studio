# 정확 결합 SHA의 CI

대상 `c7329aa8b941791633d5f22da4ca105188aab0be`, [PR21](https://github.com/tlsee0813-cmd/agentflow-studio/pull/21), [run39990131583](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/39990131583). Code Review로만 진단을 읽었다. Node22.16.0 / Python3.13.5 / Playwright1.57.0 / Chromium143.0.7499.4.

- 첫 Windows job120539458901: **failure**. root B01 `app/tests/browser.py:130`의 첫 `page.goto`가 load 5000ms 제한 초과. 같은 suite 뒤17개는 성공, 후속 continuity 브라우저 suite는 skipped이며 통과가 아니다. 이 파일과 main app 소스는36fix2 이후 변경 없음. root build/unit·continuity279·정적 두 빌드는 이미 성공했다.
- 첫 Ubuntu job120539459463: **completed/success**. 재실행 조회의 Ubuntu success job은120546548316이다.
- 동일 SHA Windows 한 번 재실행: 처음 요청은 다른OS 실행 중이어서 GitHub가 `workflow run ... already running`으로 미접수. Ubuntu 종료 후 같은 실패 job만 요청해 접수 성공. 최종 job120546483335 **completed/success**. 같은 source SHA를 유지했고 timeout·assertion·workflow를 바꾸지 않았다.

2026-10-24 KST Code Review가 정확 c7329aa의 양OS completed/success를 확인했다. 이 SHA를 checkpoint로 fast-forward해 수용했다. 첫 실패의 원인은 확정하지 않았고, 같은 로컬 Windows의 별도 main app 18/18 성공도 CI143 재현으로 부풀리지 않았다. 문서 후속 커밋은 app tree를 바꾸지 않는다.
