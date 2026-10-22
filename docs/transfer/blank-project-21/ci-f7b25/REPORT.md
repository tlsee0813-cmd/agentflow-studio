# f7b25 CI 관측 — 미수용
2026-10-23 KST. 정확 head f7b25a586dca42466f07c7db2bedb9c59703deda, PR12, run39815440492.
Code Review 제공자의 원응답만 사용했다. GitHub CI API나 CLI로 우회하지 않았다.

- Windows119953002489: completed/success. BLANK21 두 PC 메서드도 성공했다.
- Ubuntu119953002268: completed/failure. BLANK21 두 메서드가 같은 line111의 펼친 파일 전문→Control+End→Shift+Tab→접기 준비에서 실패했다.
- summary 초점 단언은 통과했고 R20.visible의 자체 clip/hit 단언도 통과한 뒤 Playwright to_be_in_viewport가 ratio0으로 실패했다. 현재 이 차이를 제품 결함 또는 검사 시점 오류로 확정하지 않았다.
- 앞선 기존 회귀 단계와 인프라 실패로 분류하지 않는다. 해당 새 검사 실패 뒤의 단언은 미실행이다.
- 원검사를 유지한 좁은 실제 브라우저 계측을 기존 Cloud에 후속 배정했다. 22 정상 UI 관측을 먼저 완료하며, 임의 sleep/DOM 스크롤 수리/단언 완화 없이 원인을 가른다.

006은 상태 원응답,007·008 JSON은 제공자가 돌려준 job 로그 원응답이다. 두 로그 모두 logTruncated=true이며 반환된 후미120000문자만 포함한다. 전체 CI artifact를 회수했다고 쓰지 않는다. 실패 부분 발췌는 원로그와 함께 제공한다.
Ubuntu artifact12441584319는 로그에 업로드 성공으로 남았지만 파일 내부를 이 기록에서 회수·검토한 것은 아니다.
