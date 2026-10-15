# cycle04 — 기준 화면 관측과 측정 보완

2026-10-16 · 시안 비교 전 기준 관측. 현재 실행 상태는 [ACTIVE](../ACTIVE.md).

기준은 cycle03의 [동일 HTML](https://github.com/tlsee0813-cmd/agentflow-studio/blob/34b4124098fe6242b34e16e23532ceb3e0fe91ad/docs/cycles/2026-10-16-return-flow-03/author-fix1/return-flow-study.html), SHA256 `af748df1dfacb7ed6b4ae3709d5ced26ef43f96bc45a9e6c2c05cdc02e9cc77e`다. Cloud가 390×844·1280×720·1440×900의 새 초기 화면만 관측했다. 선택·스크롤·이전16단계의 재실행은 하지 않았다.

| 크기 | 완전히 노출된 실제 동작 이름 | 완전히 노출된 실제 영향 영역 이름 |
|---|---:|---:|
| 390×844 | 2/3 | 0/4 |
| 1280×720 | 3/3 | 3/4 |
| 1440×900 | 3/3 | 4/4 |

상단 설명문에 적힌 네 영역 이름은 모든 크기에서 완전히 노출됐다. 따라서 모바일에서 영역 정보가 전혀 없었다고 해석하지 않는다. 실제 지도상의 이름은 아래에 있어 설명과 대상을 다시 연결해야 하는 구조다. 390의 사용자 결정 표시와 1280의 저장 복구는 일부가 뷰포트/스크롤 경계 밖에 있었다. 모든 것을 한 화면에 넣어야 한다는 합격 기준이나 사람의 혼란 측정은 아니다.

## 무엇을 고쳤는가

내부 코드 대조가 원래 측정기에서 대상 자체의 overflow clip을 제외한 조건을 발견했다. 390 프로젝트 목적문은 자체 위쪽 경계36px에 대해 글자 Range 상단이35px여서 원래 FULL 분류가 정확하지 않았다. Cloud가 측정기만 고쳐 대상 자체·조상 clip·표본 hit를 구별했고, 이 항목은 PARTIAL_LAYOUT으로 정정됐다. 실제 글자 잉크의 잘림이나 제품 결함으로 확정하지 않는다. 위 이름 집계와 나머지 실질 분류는 그대로다.

[최초 관측 원본](https://github.com/tlsee0813-cmd/agentflow-studio/tree/62d59d7ed6f4f460831ae88685bde5b7e2dac703/docs/transfer/orientation-04/baseline)과 [정의 보완 원본](https://github.com/tlsee0813-cmd/agentflow-studio/tree/165c15205a2f89d591ab431df47be5b9592676ff/docs/transfer/orientation-04/baseline/definition-addendum)을 함께 보존한다. 이전 보고서를 덮거나 같은 화면 PNG를 다시 만들지 않았다. 새 후보의 비교에는 보완한 정의를 사용한다.

두 실행 모두 세 초기 관측을 완주했고 실제 process exit0와 JSON0, 최초 HTTP 응답 바이트 및 파일 전후 SHA 일치를 기록했다. 이는 실행·정확 원본·관측 완주의 근거이며 사용성 PASS가 아니다. 글자 Range의 경계 및 각 가시 구간의 세 hit 표본으로 판정해, 실제 잉크 외곽·모든 픽셀의 가림·사람의 읽기 성공을 증명하지 않는다. 실제 조작 복귀와 사람 이해는 이번 기준 관측에 포함하지 않았다.

## 회수와 독립 대조

원본 화면3장·스크립트·JSON·로그·실제 종료·manifest는 위 GitHub 고정 경로에서 회수할 수 있다. 로컬 ZIP만이 유일한 증거가 아니다. 내부 보조는 원본 바이트/manifest와 코드·JSON 분류를 대조했으며 별도 브라우저 재실행으로 합산하지 않는다. 기존 결과 보존과 새 후보의 평가를 구별한다.
