# AgentFlow 활성 연구·검증 배정
2026-10-16 갱신 · 단일 총괄: 현재 Codex 대화. 현재 상태는 여기만 갱신한다.

## 현재: cycle07 통합 완료 · cycle08 v0 수령·의미 정정 진행
[cycle07 결과](2026-10-16-change-record-07/RESULT.md): 실제 공개 사람–Copilot 기록에서 세 역할과 두 기존 호출의 책임 변화를 표현했다. 준비문이 과거 요청을 지금의 수정 방향으로 선결정하던 문제는 fix1의3문구로 정정했다. 독립 최신 단일6장면·60 PASS, 실제 child/collector0. 원시 기록·PNG·원격 회수 감사까지 완료했다. 사람 이해나 원 프로젝트 성공을 뜻하지 않는다.

[cycle08 범위](2026-10-16-overview-08/BRIEF.md)는 같은 입력의 **첫 전체 조망→한 부분 상세→전체 맥락 복귀**다. 1280에서 카드 일부가 잘리고 반복된 책임 설명이 기본을 무겁게 하는 문제를 다룬다. 기존 기능·증거를 다시 만드는 범위가 아니다.

| 담당 | 현재 상태 |
|---|---|
| [Pro 정보량](https://chatgpt.com/c/6ad11f6e-f728-83e8-9d0a-55ba32028487) | 연구 완료. 명시 상세와 배율 자동 내용 변경을 비교, 명시 상세 추천. Bforartists PDF 그림·React Flow 코드 근거 |
| [Pro 탐색](https://chatgpt.com/c/6ad11f92-7fd0-83ec-b658-da441d3df6b5) | 연구 완료. 전체맞춤은 공통, 위치 찾기/복귀는 문맥 배치 추천. 문서·원본 코드와 직접 조작 범위 구별 |
| Astra High | 세 역할·두 기존 호출과 이동 사실이 축약에서 사라지는 반례 검토 완료 |
| 6.1 Sol High | 원문 감사 완료. BFA5판 노드 표시 접기·React Flow 배율 조건/시야 API와 고정 코드 귀속을 구별. 총괄의 공식 복원 실제 조작·코드탭 관측을 별도 보강 |
| 총괄 | [선택](2026-10-16-overview-08/DECISION.md)·[계약](2026-10-16-overview-08/IMPLEMENTATION.md) 고정. 간결한 기본 지도＋명시 상세·문맥별 위치/복귀 선택 |
| [Opus](https://claude.ai/chat/c4b2aa44-1b79-4f2a-9a5a-1d412872b647) | v0 27파일 원격 보존 완료. ‘진행 정보 확인’을 정확한 ‘누락 확인’으로 되돌리는 fix1 배정. 배치·동작 재설계 아님 |
| Cloud | cycle07 종료. cycle08 fix1 고정 후 3폭×2흐름 독립 관측 예정; 아직 실행하지 않음 |

## cycle08 작성자 원본과 감사
[고정 v0 27파일](https://github.com/tlsee0813-cmd/agentflow-studio/tree/bbdf2234c6523de86b64510843282ac1003124bd/docs/transfer/overview-08/author-v0) · [의미 감사](2026-10-16-overview-08/AUTHOR_SEMANTIC_AUDIT.md) · [코드·기록 감사](2026-10-16-overview-08/AUTHOR_CODE_AUDIT.md).
HTML41,912B/SHA624a6e70…2154b. 작성자 마지막 한 실행78 PASS/0 FAIL·child/collector0; 최초 실패도 보존. 원시 전후 좌표의 저장 누락, 실제 상세 열기 전후 장면 누락, 맞춤 뒤 내용 hit 누락은 독립 흐름 안에서 보완한다. 초기1280/390 PNG에서 세 역할·두 호출이 보이나 사람 이해 결과는 아니다. ‘누락’이 상세에서도 사라진 의미 문제는 정정 후 검증한다.

## 공유 결과와 근거
[cycle07 고정 작성자 fix1](https://github.com/tlsee0813-cmd/agentflow-studio/tree/0dfadba788e0f2f035bbe51b899b9c02e4260e45/docs/transfer/change-record-07/author-fix1) · [독립 원본 35파일](https://github.com/tlsee0813-cmd/agentflow-studio/tree/72f923ef9da6ab222427792959d17a9a4a74510d/docs/transfer/change-record-07/independent-v0).
HTML42,420B/SHA d10e7dca…이며 별도 환경 HTTP·파일 전후 해시가 일치했다. 원격 tree/manifest/payload34 전부 byte·SHA 대조 완료. PNG4장과 최초 실패도 다른 세션이 회수할 수 있다. 작성자75와 독립60을 합산하지 않는다. 정확한 종료·가시성 한계는 결과 문서에서 읽는다.

[cycle06 통합 판단](https://github.com/tlsee0813-cmd/agentflow-studio/blob/d17667c1c519492f6edf8ea064a9f87b5d51fc12/docs/cycles/2026-10-16-purpose-06/RESULT.md) · [공유 증거 목록](https://github.com/tlsee0813-cmd/agentflow-studio/blob/delivery/ui02-fix3-evidence/docs/transfer/README.md).

## 운영 경계
연구 checkpoint/2026-10-15 통합은 총괄만, Cloud는 지정 delivery 경로만 사용한다. 내부 보조는 Astra High/6.1 Sol High이며 브라우저 모델 일괄 변경 지시가 아니다. 사용자 예약을 중복 생성하거나 변경하지 않았다.

GitHub가 공유 원본이다. 로컬은 수령·감사·미리보기용 임시 자료다. cycle06 작성자 임시 복사본 삭제는 자동 승인 심사가 실행 전에 차단해0건이며 구체적 이유는 제공되지 않았다. 우회 삭제하지 않았고 미리보기를 보존했다. 연구 결과 회수에는 영향이 없다.

제품 소스618d9bd2b99ad433df35107d8902b15f45e30000, main896dcf3848fec70357d0f9bd4fd6c09cab70db37, 공개 배포63f5540d062861439f0932cd7311c6c5510e227c, GUIDE107 HOLD 유지. 사람 사용성·큰 지도 조망·실제 AI 송신/수락·전체 제품 완성은 미확인이다.
