# AgentFlow 활성 연구·검증 배정
2026-10-16 갱신 · 단일 총괄: 현재 Codex 대화. **현재 상태는 여기만 갱신하고 각 연구 문서는 당시 판단을 보존한다.**

## 현재: cycle05 시안 수령·읽기 감사 완료, 독립 브라우저 검증 중
[작업 계약](2026-10-16-composition-05/BRIEF.md) · [입력 사실/경계](2026-10-16-composition-05/INPUT.md)

질문: 프로그램 구성을 먼저 보고 변경된 한 부분을 이해한 뒤, 상위/외부 맥락과 보존 조건을 유지하며 조정·인계 준비와 전체 복귀로 이어갈 수 있는가? 입력은 과거 FLOW091-C 계약/MOCK 보고이며 실제 사용자 원대화가 아니다. 명시 관계와 AI의 구성 해석 제안을 구별한다.

| 담당 | 배정/상태 | 기준·회수 |
|---|---|---|
| [Pro 구성 해석](https://chatgpt.com/c/6ad11f6e-f728-83e8-9d0a-55ba32028487) | 새 Pro 표시 확인, 작은 자료 조사·구성 후보2개 완료 | 입력571e7a7…; Structurizr/C4·IcePanel 등 모델/뷰 관계 조사. 구현/원격쓰기 없음 |
| [Pro 혼합 깊이 탐색](https://chatgpt.com/c/6ad11f92-7fd0-83ec-b658-da441d3df6b5) | 새 Pro 표시 확인, 접힘/집중/복귀 조사 완료 | 같은 입력; Dify와 yFiles/Blender 등 비교. 구성 단위 결정은 별도 |
| 내부 Astra High | 입력·반례 및 작성자 HTML/PNG5개 의미 검토 완료 | 중요한 의미 뒤집힘 미발견, 모바일 시야 한계와 README 정정 분리 |
| 내부6.1 Sol High — 코드 | 재사용/원문 감사·작성자 최초 실패와 최종 코드/로그 감사 완료 | 중요한 기능 결함 미확정. 실제 transform/복수 rect/clip·hit·그룹→세부 독립 관측에 반영 |
| 내부6.1 Sol High — 전달 | 원본 ZIP 안전수령·두 manifest 각22/22 확인, 업로드 준비 완료 | 총괄이 원격24/24 bytes 재확인. 로컬은 임시 수령용 |
| 총괄 | 기능별 구성+보존 조건·제자리 선택+선택적 집중 선택, 시안 회수·정적감사 통합 | 미세분화 기능 준비 설명만 정정, 불필요한 버튼/구조 변경 안 함 |
| [Opus 5.5 High](https://claude.ai/chat/c4b2aa44-1b79-4f2a-9a5a-1d412872b647) | author-v0 완료, ZIP 수령·GitHub 보관 | [고정 원본](https://github.com/tlsee0813-cmd/agentflow-studio/tree/10d1f03f6944a2787079cdb49cf009c6b1fbd302/docs/transfer/composition-05/author-v0). HTML 5e937f9e…831d6 / 46,924bytes. 작성자 검사와 독립 검증 구분 |
| [기존 Cloud](https://chatgpt.com/local/01a13fcb-e7e5-73b9-b4a3-cf9a2b95b0bb?hostId=local) | 시안 independent-v0 실제 검증 진행 중 | 정확 author10d1f03…;1440×900/390×844, 지정 delivery 경로만. 공식 참고 데모는 접속 실패로 NOT_RUN 종료 |

[선택 기록](2026-10-16-composition-05/DECISION.md) · [시안 계약](2026-10-16-composition-05/IMPLEMENTATION.md) · [원문 대조](2026-10-16-composition-05/SOURCE_AUDIT.md) · [재사용/검증 경계](2026-10-16-composition-05/REUSE_AUDIT.md)

[작성자 수령·독립 읽기 감사](2026-10-16-composition-05/AUTHOR_AUDIT.md). 공식 참고 데모는 총괄의 한 경로 직접 관측과 Cloud의 접속 실패를 분리해 SOURCE_AUDIT에 남겼다. 참고 데모 실패를 우리 시안 검증 결과로 쓰지 않는다.

## 직전 판단과 공유
- [cycle04 통합 결과](https://github.com/tlsee0813-cmd/agentflow-studio/blob/571e7a7030039b4d4354757949cdabc8533c70aa/docs/cycles/2026-10-16-orientation-04/RESULT.md): A 관계 개요 조건부 유지, B 긴 설명 배치 보류·동일대상 참조 보존. 독립17장면과 한계를 분리. 같은 FIX058의 장식 수정은 정리.
- [공유 원본·대표 화면 목록](https://github.com/tlsee0813-cmd/agentflow-studio/blob/f674fd7a75b5a10f840b8bee81b65b9b26aaf040/docs/transfer/README.md): cycle01~04 원본·독립 증거를 고정 링크로 회수 가능.
- [전체 제품 관점](2026-10-15-real-record-02/PRODUCT_LENS.md): 검토보고서 읽기가 아니라 구상·관계·변경과 행동을 중심으로.

## 운영 경계
연구 `checkpoint/2026-10-15` 통합은 총괄만, Cloud는 지정 delivery 경로만 쓴다. 내부 판단 보조는 Astra High, 코드·환경·검사 보조는6.1 Sol High. 브라우저 모델의 일괄 변경 지시는 아니다. 사용자 예약은 새로 만들거나 변경하지 않는다. 진행 중 heartbeat는 중복 착수로 읽지 않는다.

제품 소스 기준 `618d9bd2b99ad433df35107d8902b15f45e30000`, main `896dcf3848fec70357d0f9bd4fd6c09cab70db37`, 공개 배포 `63f5540d062861439f0932cd7311c6c5510e227c`, GUIDE107 HOLD 유지. 사람 사용성·실제 AI 준수·실제 전달/수락·전체 제품 완성은 미확인이다.
