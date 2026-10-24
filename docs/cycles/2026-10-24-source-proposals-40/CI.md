# 최종40 정확 SHA CI

대상 `44cfc9ade567b3b7cfe66af57d9762d5bf1ead39`, app tree `c6172dd71c592ae331931b5d9e5ca5b60b0e77d0`. [PR22](https://github.com/tlsee0813-cmd/agentflow-studio/pull/22) · [run40047073004](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/40047073004). Code Review가 양OS completed/success를 직접 반환했다. [원본 응답의 상태/ID](CI.json).

- Ubuntu24.04 job120731146343: completed/success.
- Windows2022 job120731146341: completed/success.
- workflow는 PR head를 직접 checkout하며 Node22.16.0/Python3.13.5를 고정한다. 작성자 Node22.22의 root 버전 검사 실패와 독립 Windows Node24 실행은 이 CI와 별도로 기록한다.

초기 Code Review는 GitHub 연결 오류를 반환해 공개 Actions UI로 정확44cfc9a의 진행을 읽었다. 사용자 다음 메시지와 도구 갱신 뒤 connector/Code Review 조회가 정상화됐다. 실행 중 job 로그 조회2회는 provider HTTP502여서 로그를 읽었다고 주장하지 않는다. 완료된 Ubuntu job 로그는 이후 정상 회수했고 브라우저군의 OK와 SOURCE40 정적 검사를 읽었다. 로그는 도구에서 잘린 tail이므로 전체 원문을 읽었다고 하지 않는다. 최종 결론은 정상 응답한 checks/jobs로 확인했다. 계정 전환·재설치·검사 완화·CI 재실행은 하지 않았다.

정확 검증SHA 자체를 checkpoint에 fast-forward한다. 그 뒤 배포/근거 문서만 추가하며 app tree는 그대로 유지한다.
