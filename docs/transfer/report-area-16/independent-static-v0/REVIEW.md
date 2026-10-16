# 보고·현재 구상 연결16 — 독립 정적 화면·의미 검토

2026-10-16. 대상은 [제품 후보 c7fa5b0](https://github.com/tlsee0813-cmd/agentflow-studio/tree/c7fa5b0740b8de562119fbcd4f90410815d6f7df), [PR #7](https://github.com/tlsee0813-cmd/agentflow-studio/pull/7)이다. Astra가 작성자 PNG 네 장을 실제 열람하고 REPORT·변경 코드를 읽었으며 Sol의 정적 P2 발견을 함께 기록한다. **Cloud 독립 실행은 진행 중이다.** 작성자 검사 통과와 이 검토를 독립 실행·사람 이해 검증으로 합산하지 않는다.

## 수정이 필요한 정적 발견

**P2 — 다른 보고로 전환해도 연결 경로의 펼침 상태가 넘어갈 수 있다.** Sol이 발견했고 Astra가 고정 후보의 해당 행을 대조했다. `pickReport`는 보고별 펼침 메모를 제거하지만([1598행](https://github.com/tlsee0813-cmd/agentflow-studio/blob/c7fa5b0740b8de562119fbcd4f90410815d6f7df/app/continuity/src/client/app.ts#L1598)), `render()`가 이전 DOM의 details 상태를 ID로 수집한 뒤 새 DOM에 다시 덮는다([1788행](https://github.com/tlsee0813-cmd/agentflow-studio/blob/c7fa5b0740b8de562119fbcd4f90410815d6f7df/app/continuity/src/client/app.ts#L1788), [1807행](https://github.com/tlsee0813-cmd/agentflow-studio/blob/c7fa5b0740b8de562119fbcd4f90410815d6f7df/app/continuity/src/client/app.ts#L1807)). 모든 보고가 공유하는 `task-report-path`([1749행](https://github.com/tlsee0813-cmd/agentflow-studio/blob/c7fa5b0740b8de562119fbcd4f90410815d6f7df/app/continuity/src/client/app.ts#L1749)) 때문에 보고 A에서 연 연결 경로가 B에도 열린 채 적용될 수 있다. 같은 보고를 다시 누를 때의 유지 역시 전용 메모만의 보장으로 볼 수 없고 공통 DOM 복원에 의존한다. 다른 보고 전환과 같은 보고 재그리기를 구별하는 좁은 수정·실행 확인이 필요하다. 이 문서는 브라우저 재현을 했다고 주장하지 않는다.

## 실제 PNG에서 확인한 제품 경험

- [1280 비교 화면](https://github.com/tlsee0813-cmd/agentflow-studio/blob/d207f8ce7faca4573a2c5f6c4cb9eddf399e29ed/docs/transfer/report-area-16/author-v0/screens/1-pc1280-f10-idea-beside-picked-report.png)과 [1440 비교 화면](https://github.com/tlsee0813-cmd/agentflow-studio/blob/d207f8ce7faca4573a2c5f6c4cb9eddf399e29ed/docs/transfer/report-area-16/author-v0/screens/2-pc1440-f10-idea-beside-picked-report.png)에서 현재 구상의 ‘바로 확정하지 않음’과 보고의 ‘Enter로 F10 선택’을 함께 읽을 수 있다. 큰 세로 공백은 남아 있지 않다. 현재 구상은 합성, 보고는 PowerToys 실제 댓글의 한국어 재서술·작성자 주장, 관찰 문장은 합성이라는 구분이 화면에 있다. 이를 실제 사용자 요구 충돌이나 앱의 자동 판정으로 해석하지 않는다.
- [긴 후속 보고 화면](https://github.com/tlsee0813-cmd/agentflow-studio/blob/d207f8ce7faca4573a2c5f6c4cb9eddf399e29ed/docs/transfer/report-area-16/author-v0/screens/3-pc1440-long-nested-report-opening.png)은 앞부분을 요약과 구별하고 전문·중간 보고 연결 경로 접근을 보인다. 코드도 모든 sourceIds를 순회한다([1731행](https://github.com/tlsee0813-cmd/agentflow-studio/blob/c7fa5b0740b8de562119fbcd4f90410815d6f7df/app/continuity/src/client/app.ts#L1731)). 이 PNG는 전문을 펼친 상태나 실제 클릭 성공의 증거는 아니다.
- 비교 화면의 버튼 옆에 다른 영역 미전송 요청이라는 안내가 있고, [입력 열림 화면](https://github.com/tlsee0813-cmd/agentflow-studio/blob/d207f8ce7faca4573a2c5f6c4cb9eddf399e29ed/docs/transfer/report-area-16/author-v0/screens/4-pc1280-other-area-unsent-request-opened-as-is.png)에는 해당 영역과 문장이 보인다. 새 요청 준비·기존 작업 편집은 시각적으로 분리됐다. 이미지 간 비교만으로 저장 불변·원점 복귀 성공을 증명하지 않는다.

## 후속 개선과 판정 한계

긴 요청 제목의 breadcrumb/제목 반복, 선택 보고 앞부분과 목록 제목의 반복은 읽기 부담이다. 1280에서는 두 번째 보고 선택지가 화면 아래에 있고, 선택 후 목록이 본문 아래로 이동한다. 키보드 초점의 실제 가시성·다른 보고로 바꾸는 부담은 독립 조작에서 판단할 사항이다. **이 두 관찰을 현재 통합 차단 결함으로 격상하지 않는다.** 현재 구상과 보고를 가까이 둔 개선은 실제 화면에서 확인된다.

Dify의 단일 선택 패널 관측은 총괄의 별도 비교 자료다. 이 검토는 Dify 조작을 수행하지 않았고, 두 번째 패널이나 동일 사용성의 근거로 사용하지 않는다. 작성자가 밝힌 source 누락 경로 미실행, 다른 탭 재렌더 미시험, 출발 영역 소실 fallback 검사 분기 미실행도 남긴다. 정적 P2 외 새 중대한 의미 왜곡은 이 범위에서 발견하지 못했으나, 최종 통합 판단은 수정과 Cloud 독립 결과를 별도로 반영해야 한다.
