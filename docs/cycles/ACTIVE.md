# AgentFlow 활성 연구·검증 배정
2026-10-16 갱신 · 단일 총괄: 현재 Codex 대화. **현재 상태는 여기만 갱신하고 각 연구 문서는 당시 판단을 보존한다.**

## 현재: cycle05 구성 선택 완료, Opus 시안 작성 중
[작업 계약](2026-10-16-composition-05/BRIEF.md) · [입력 사실/경계](2026-10-16-composition-05/INPUT.md)

질문: 프로그램 구성을 먼저 보고 변경된 한 부분을 이해한 뒤, 상위/외부 맥락과 보존 조건을 유지하며 조정·인계 준비와 전체 복귀로 이어갈 수 있는가? 입력은 과거 FLOW091-C 계약/MOCK 보고이며 실제 사용자 원대화가 아니다. 명시 관계와 AI의 구성 해석 제안을 구별한다.

| 담당 | 배정/상태 | 기준·회수 |
|---|---|---|
| [Pro 구성 해석](https://chatgpt.com/c/6ad11f6e-f728-83e8-9d0a-55ba32028487) | 새 Pro 표시 확인, 작은 자료 조사·구성 후보2개 완료 | 입력571e7a7…; Structurizr/C4·IcePanel 등 모델/뷰 관계 조사. 구현/원격쓰기 없음 |
| [Pro 혼합 깊이 탐색](https://chatgpt.com/c/6ad11f92-7fd0-83ec-b658-da441d3df6b5) | 새 Pro 표시 확인, 접힘/집중/복귀 조사 완료 | 같은 입력; Dify와 yFiles/Blender 등 비교. 구성 단위 결정은 별도 |
| 내부 Astra High | 입력 사실11개·제안 경계·반례3개 완료 | INPUT에 통합. 확정 포함트리를 요구하지 않음 |
| 내부6.1 Sol High — 코드 | 이전 혼합 깊이/미결/외부관계/읽기/준비/복귀 재사용 계약·Dify/yFiles 원문 감사 완료 | 코드 대조이며 새 브라우저 검사 아님 |
| 내부6.1 Sol High — 전달 | 기존 Cloud 직접git 전송 확인, Opus 직접쓰기 미확인으로 분리 완료 | 기존 연결이 없으면 작은 원본ZIP1회 임시 수령. 새 인증/환경으로 본 연구를 막지 않음 |
| 총괄 | 기능별 구성+보존 조건, 제자리 선택+필요시 집중 읽기 선택. 시안 계약 확정·Opus 전달, 공식 접힘 데모 직접 관측 | Pro 답 전달만으로 완료하지 않음 |
| [새 Opus 5.5 High](https://claude.ai/chat/c4b2aa44-1b79-4f2a-9a5a-1d412872b647) | 고정 계약 전달, 연구용 클릭 시안 작성 중 | 입력/계약 ddad7014…; composition-study.html·작성자 실행·최소 PNG·manifest. 기존 쓰기 연결이 있을 때만 delivery의 docs/transfer/composition-05/author-v0/ 추가 허용. 없으면 원본 ZIP1개 |
| [기존 Cloud](https://chatgpt.com/local/01a13fcb-e7e5-73b9-b4a3-cf9a2b95b0bb?hostId=local) | 공식 yFiles Folding 데모의 한 경로 독립 관측 진행 중 | 공개 데모1280 한 크기, 접기→내부→전체. delivery의 docs/transfer/composition-05/reference-folding/만 허용. **우리 시안 독립 검증은 아직 미배정** |

[선택 기록](2026-10-16-composition-05/DECISION.md) · [시안 계약](2026-10-16-composition-05/IMPLEMENTATION.md) · [원문 대조](2026-10-16-composition-05/SOURCE_AUDIT.md) · [재사용/검증 경계](2026-10-16-composition-05/REUSE_AUDIT.md)

총괄의 공식 데모 관측은 선택→접기→내부→전체 한 경로다. 내부에서 외부 노드/연결이 사라지고 나올 때 접힌 상태가 보이는 것을 확인했다. 정밀 좌표/임의 배율·사람 사용성을 검증한 것은 아니다. Cloud는 이 결과를 정답으로 가정하지 않고 별도 화면·실행 기록을 남긴다.

## 직전 판단과 공유
- [cycle04 통합 결과](https://github.com/tlsee0813-cmd/agentflow-studio/blob/571e7a7030039b4d4354757949cdabc8533c70aa/docs/cycles/2026-10-16-orientation-04/RESULT.md): A 관계 개요 조건부 유지, B 긴 설명 배치 보류·동일대상 참조 보존. 독립17장면과 한계를 분리. 같은 FIX058의 장식 수정은 정리.
- [공유 원본·대표 화면 목록](https://github.com/tlsee0813-cmd/agentflow-studio/blob/f674fd7a75b5a10f840b8bee81b65b9b26aaf040/docs/transfer/README.md): cycle01~04 원본·독립 증거를 고정 링크로 회수 가능.
- [전체 제품 관점](2026-10-15-real-record-02/PRODUCT_LENS.md): 검토보고서 읽기가 아니라 구상·관계·변경과 행동을 중심으로.

## 운영 경계
연구 `checkpoint/2026-10-15` 통합은 총괄만, Cloud는 지정 delivery 경로만 쓴다. 내부 판단 보조는 Astra High, 코드·환경·검사 보조는6.1 Sol High. 브라우저 모델의 일괄 변경 지시는 아니다. 사용자 예약은 새로 만들거나 변경하지 않는다. 진행 중 heartbeat는 중복 착수로 읽지 않는다.

제품 소스 기준 `618d9bd2b99ad433df35107d8902b15f45e30000`, main `896dcf3848fec70357d0f9bd4fd6c09cab70db37`, 공개 배포 `63f5540d062861439f0932cd7311c6c5510e227c`, GUIDE107 HOLD 유지. 사람 사용성·실제 AI 준수·실제 전달/수락·전체 제품 완성은 미확인이다.
