# AgentFlow 활성 연구·검증 배정

2026-10-16 갱신 · 단일 총괄: 현재 Codex 대화. **현재 상태는 이 파일에서만 갱신한다.** 각 사이클의 연구·결과는 당시 판단 기록이다.

## 현재: cycle09 통합 완료 · cycle10 관계 읽기 구현 진행

[cycle09 결과](2026-10-16-mixed-reading-09/RESULT.md) · [회수·작성자·독립 감사](2026-10-16-mixed-reading-09/AUDIT.md).

다섯 역할과 여섯 실제 전달 관계의 공간 지도를 유지하면서 G3만 펼치고 C32의 변경을 먼저 읽도록 했다. 390에서도 다섯 역할과 변경된 세부가 첫 화면에 함께 보인다. 문자 목차로 지도를 대체하는 초기 제안은 거절했고, 참고하는 상대와 지도 선택·준비 대상을 분리했다. 묶음까지 준비 대상으로 부르던 안내는 fix1 한 줄로 정정했다.

고정 fix1은 54,524B / SHA256 `90141c4c5cfc509cafef3c038a9c1c14f0062f7e009e4359f5f97bd5541e3173`. 독립 최신 run02는 1280/390 A/B/C 여섯 흐름과 1440 초기 관측, 91 PASS다. 실제 child·외부 collector 종료0, launcher 외부 도구 관측 전사본을 구분했다. 원격 24파일/4,119,361B·payload23/23 bytes/SHA·정확 파일 집합을 감사했다. 작성자 v0 299와 fix1 각50은 별도 실행이며 합산하지 않는다. 선 복귀는 최대0.162 world/허용0.5이며 정확 동일 주장이 아니다.

이번 범위에서 중요한 추가 기능 결함은 발견하지 않았다. **남은 읽기 부담은 같은 출발점의 다른 수신부가 열기 전 구별되지 않는 목록, 참고 설명의 반복, 짧은 선의 약한 방향 단서다.** 사람 이해·터치·큰 지도·실제 AI 송신/수락은 미검증이다.

## cycle10 배정

[범위](2026-10-16-relation-reading-10/BRIEF.md): 같은 출발점의 다른 전달을 열기 전에 구별하고, 필요한 조건을 읽은 뒤 같은 부분으로 돌아올 수 있는가?

| 담당 | 진행 범위 |
|---|---|
| Pro A | 목록 식별값과 숨긴 필드만 상세에 더하는 DataTables 메커니즘 조사 완료. 버전/예외 대조 완료 |
| Pro B | JointJS 선상 방향촉/React Flow 클릭 영역 분리 조사 완료. 우리 코드의 기존 기능·화살촉 생략 확인 |
| 총괄 | DataTables 공식 예제 실제 펼침·폭 변경을 관측. 수신부가 구별되는 목록+간결한 참고를 선택. 선 기하/방향촉 변경은 보류. 고정 계약0f46935로 Opus 구현 배정 완료 |
| Opus | 고정09 fix1에서 목록/참고만 구현·실제 작성자 검사 진행. 결과는 아직 미수령 |
| Cloud | 독립 검사 계획만 준비. 새 HTML/SHA 배정 전 실행하지 않음 |
| Astra High / 6.1 Sol High | 입력·의미·원시/전달 감사 보조. 브라우저 모델 일괄 변경 지시가 아님 |

[연구 A 세션](https://chatgpt.com/c/6ad14ec4-7c30-83ee-88ed-494c789fb0a1) · [연구 B 세션](https://chatgpt.com/c/6ad14ee9-98ac-83ee-a198-6c86d267b78f) · [cycle09 Opus 구현 세션](https://claude.ai/chat/f4a50f7c-1576-4298-99ae-0fb2862adce0).

[선택 근거·좁은 구현 계약](2026-10-16-relation-reading-10/DECISION.md). 공식 메커니즘 세 가지를 대조했다. DataTables 현행 데모4.1.1과 고정 코드3.0.3을 구분하며, JointJS/React Flow의 실제 조작은 미실행이다. 보조 세션에는 브라우저 표면이 없었고 총괄이 DataTables만 직접 관측했다. 선의 약한 방향은 일부 끝의 화살촉 생략에 의한 것으로 원인 설명을 바로잡았다. 문서·고정 코드·정적 이미지·실제 사이트 조작·사람 평가를 구분한다. 새 관계/미결/계층 엔진/실행 단계/송신 기능을 만들지 않는다. FLOW091 과거 계약/MOCK 기록과 cycle07의 실제 사람–Copilot 기록을 섞지 않는다. 다음 표현은 확정된 제품 문법이 아니다.

## 공유 원본과 이전 판단

[cycle09 작성자 v0](https://github.com/tlsee0813-cmd/agentflow-studio/tree/017dec57df289cc9c4cbff7344ec7fdb71ab734d/docs/transfer/mixed-reading-09/author-v0) · [fix1](https://github.com/tlsee0813-cmd/agentflow-studio/tree/08a04afb7515efc5f4007b5d9bf5bb787c908c20/docs/transfer/mixed-reading-09/author-fix1) · [독립24파일](https://github.com/tlsee0813-cmd/agentflow-studio/tree/be2d6a2b1a28922138610d562da98a4375fef891/docs/transfer/mixed-reading-09/independent-v0) · [공유 증거 목록](https://github.com/tlsee0813-cmd/agentflow-studio/blob/delivery/ui02-fix3-evidence/docs/transfer/README.md). 원본 코드·첫 실패·원시 결과·PNG를 다음 세션에서 직접 회수할 수 있다.

[cycle08 전체 조망](2026-10-16-overview-08/RESULT.md) · [cycle07 실제 책임 변화·후속 요청](2026-10-16-change-record-07/RESULT.md) · [cycle06 목적·역할](2026-10-16-purpose-06/RESULT.md) · [cycle05 혼합 깊이](2026-10-16-composition-05/RESULT.md). 이전 실행과 이번 수치를 합산하지 않는다.

## 운영 경계

연구 checkpoint/2026-10-15 통합은 총괄만 한다. Cloud는 지정 delivery 하위 경로만 사용하며, 현재 cycle09 배정은 완료됐다. 사용자 예약을 중복 생성하거나 변경하지 않았다.

GitHub가 공유 원본이다. 로컬은 수령·감사·미리보기용 임시 자료다. cycle06 작성자 임시 복사본 삭제는 자동 승인 심사가 실행 전에 차단해0건이며 구체적 이유는 제공되지 않았다. 우회 삭제하지 않았다. 공유 연구 결과 회수에는 영향이 없다.

2026-10-15 23:13 UTC 원격 확인: main `896dcf3848fec70357d0f9bd4fd6c09cab70db37`, 공개 배포 `63f5540d062861439f0932cd7311c6c5510e227c` 유지. cycle08 이후 연구 변경9파일은 docs/cycles/, 전달 변경229파일은 docs/transfer/ 안이다. 이후 총괄 통합도 이 문서 경로만 사용한다. 제품 기준 `618d9bd2b99ad433df35107d8902b15f45e30000`과 GUIDE107 HOLD 유지. 전체 제품 완성·실제 AI 송신/수락은 미확인이다.
