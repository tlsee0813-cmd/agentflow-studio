# cycle11 — 같은 PC 화면에 두 입력

최종 판단: [cycle11 결과](https://github.com/tlsee0813-cmd/agentflow-studio/blob/526a371627b4299db3d88f997348d11df7379990/docs/cycles/2026-10-16-two-change-record-11/RESULT.md) · [첫 제품 연결 범위](https://github.com/tlsee0813-cmd/agentflow-studio/blob/526a371627b4299db3d88f997348d11df7379990/docs/cycles/2026-10-16-two-change-record-11/PRODUCT_INTEGRATION.md). 현재 진행은 [ACTIVE](https://github.com/tlsee0813-cmd/agentflow-studio/blob/checkpoint/2026-10-15/docs/cycles/ACTIVE.md)에만 갱신한다.

## 정확한 시안 구성

1. [작성자 v0](https://github.com/tlsee0813-cmd/agentflow-studio/tree/6643323316daefbe10625484bb1727a2c6a54716/docs/transfer/shared-map-11/author-v0)의 **app/**에서 index.html, style.css, engine.js, fixtures/flow091.json, fixtures/powertoys.json을 사용한다. schema.md는 구조 설명이다.
2. engine.js만 [fix1](https://github.com/tlsee0813-cmd/agentflow-studio/blob/c4354dccc6f693bf33d5157e7e8da566d152d9a1/docs/transfer/shared-map-11/author-fix1/app/engine.js)로 교체한다. 34,004B/SHA256 `d3699ac75671b000cb4561ae137073aa73a18c74fefe6fbaa0bd3489c438ff8f`. 나머지4파일은 v0 그대로다.
3. 같은 디렉터리 구조를 HTTP 정적 미리보기로 연다. 브라우저에서 JSON을 읽기 때문에 GitHub의 코드 보기나 파일 직접 열기 자체가 실행 미리보기는 아니다. 공개 제품 배포가 아니다.

원본은 불변이고 수정분은22파일 overlay다. v0116파일·2,905,674B 및 fix1 22파일·534,719B의 원격 정확 집합/크기/Git blob/manifest를 감사했다. 원본 ZIP은 임시 수령 수단이며 이 GitHub 파일들만으로 소스·실패·raw·PNG를 다시 회수할 수 있다.

| 증거 | 읽는 곳 |
|---|---|
| 작성자 전체와 첫 실패 | [v0 REPORT](https://github.com/tlsee0813-cmd/agentflow-studio/blob/6643323316daefbe10625484bb1727a2c6a54716/docs/transfer/shared-map-11/author-v0/REPORT.md) · 같은 묶음 runs/r01–r05, snapshots, MANIFEST.tsv |
| 좁은 미리보기 수정 | [fix1 REPORT](https://github.com/tlsee0813-cmd/agentflow-studio/blob/c4354dccc6f693bf33d5157e7e8da566d152d9a1/docs/transfer/shared-map-11/author-fix1/REPORT-fix1.md) · diff·tests-fix1·runs/f01·MANIFEST.tsv |
| 독립 PC 관측 | [60파일·대표PNG4](https://github.com/tlsee0813-cmd/agentflow-studio/tree/519a57c00062c142548b0a1d9a270949aacf3bd4/docs/transfer/shared-map-11/independent-v0) · [독립 감사](https://github.com/tlsee0813-cmd/agentflow-studio/blob/526a371627b4299db3d88f997348d11df7379990/docs/cycles/2026-10-16-two-change-record-11/INDEPENDENT_AUDIT.md) |

PC1280/1440이 주 범위다.390은 최소 확인이며 사람 사용성·임의 기록 자동 해석·실제 제품 통합·AI 송신의 증거가 아니다. 작성자와 독립 검사 수를 합산하지 않는다. 작성자 fix1의 ‘사례 왕복’은 최종 문장이 양사례 동일해 값 보존 이상의 강한 격리 판정으로 쓰지 않는다. 총괄 감사와 독립의 서로 다른 문장 검사를 함께 읽는다.
