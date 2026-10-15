# AgentFlow 연구 증거 전달

이 브랜치는 세션 간 원본 파일을 전달하는 공간이다. 제품 배포나 현재 연구 상태의 별도 사본이 아니다.

- [현재 상태와 다음 범위](https://github.com/tlsee0813-cmd/agentflow-studio/blob/checkpoint/2026-10-15/docs/cycles/ACTIVE.md)
- [읽기 fix1 통합 판단 — 고정 연구판](https://github.com/tlsee0813-cmd/agentflow-studio/blob/3751b32928ea5f6b8df2ce892b33d4cb9bd62c85/docs/cycles/2026-10-15-real-record-02/READING_FIX1_RESULT.md)

| 묶음 | 고정 원본 | 읽는 순서와 범위 |
|---|---|---|
| UI02 fix3 | [원본·별도 검증기 보완](https://github.com/tlsee0813-cmd/agentflow-studio/tree/4f4dfe5adec05b849753391d6a8932ec0377966c/docs/transfer/ui02-fix3) | 첫 사이클의 합격 기준9와 실제 화면 증거. 작성자·독립 검사를 구별 |
| 읽기 v0 결함 재현 | [v0-preflight](https://github.com/tlsee0813-cmd/agentflow-studio/tree/7e79392080157be693429da40d54c2a206b8aa7b/docs/transfer/real-record-02/v0-preflight) | 수정 전 닫힘 결함. 6통과·4실패·exit1을 그대로 보존 |
| 읽기 fix1 독립 검증 | [fix1 전체](https://github.com/tlsee0813-cmd/agentflow-studio/tree/ce91a08fe8ff641a491d34bf35de732f85816792/docs/transfer/real-record-02/fix1) | REPORT의 당시 미검증6건은 아래 continuity-addendum과 함께 읽음 |
| 같은 근거의 읽기 연속성 | [추가6전환](https://github.com/tlsee0813-cmd/agentflow-studio/tree/ce91a08fe8ff641a491d34bf35de732f85816792/docs/transfer/real-record-02/fix1/continuity-addendum) | 실제 텍스트·줄·가시범위 관측6/6. 기존54확인과 함께 지정 로컬 계약 증거 확보. 외부 원문2건은 차단·미실행 |
| 작성자 원본 | [v0](https://github.com/tlsee0813-cmd/agentflow-studio/tree/4b396e8da9e01e3f9e3b2068c6d76d17848ffb3a/docs/cycles/2026-10-15-real-record-02/reading-v0) / [fix1](https://github.com/tlsee0813-cmd/agentflow-studio/tree/4971cb51965a7c40b374ddf0210f51c8609ed20e/docs/cycles/2026-10-15-real-record-02/reading-fix1) | 연구 브랜치의 정확 바이트. 작성자 수치와 독립 수치를 합산하지 않음 |

원본의 첫 실패·재실행·미실행 기록을 덮어쓰지 않는다. v0 시각 불일치 주장은 내부 감사의 날짜 표시 변환 오류로 철회됐으며 정정은 fix1/continuity-addendum/V0_TIME_ADDENDUM.md에 있다. 대표 PNG와 코드·JSON·로그·파일 해시를 직접 회수할 수 있으므로 사용자 로컬 ZIP 경로가 필요하지 않다. 사람 사용성·B 모바일 나란히 대조·전체 제품 품질을 이 실행 결과로 통과 처리하지 않는다.
