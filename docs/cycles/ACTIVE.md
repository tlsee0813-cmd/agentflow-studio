# AgentFlow 활성 연구·검증 배정

2026-10-16 갱신 · 단일 총괄: 현재 Codex 대화. **현재 실행 상태는 이 문서에 모으고, 연구 문서는 당시 판단과 관측을 보존한다.**

## 최근 정리: cycle03 공간 복귀 흐름

과거 FIX058 개발 보고의 ‘목적 정정은 별도로, 작업 지시는 그대로’ 변경으로 **변화 확인 → 한 부분 이해 → 근거/인계 준비 → 전체 복귀**를 연결한 시안을 작성·수정·독립 검토했다. [cycle03 통합 판단](2026-10-16-return-flow-03/RESULT.md)이 최신 진입점이다. 두 화면의 좁은 흐름을 다음 연구의 기반으로 수용하며, 전체 제품 품질·사람 사용성·실제 인계 실행을 완료로 바꾸지 않는다. 다음 초점은 모바일 첫 화면에서 변경·현재 부분·관련 영역을 함께 이해하는 데 필요한 탐색 부담이다.

배정에 사용한 고정 입력은 `16e417af220361bc1926538b729decb3b3008208`의 [작성 범위](2026-10-16-return-flow-03/BRIEF.md)·[사실 경계](2026-10-16-return-flow-03/INPUT.md)·[8단계 동작 계약](2026-10-16-return-flow-03/BROWSER_CONTRACT.md)이다. 이후 운영 문서의 커밋과 시안 입력 버전을 구별한다.

| 담당 | 좁은 배정 | 현재 상태 |
|---|---|---|
| [Opus 공간 시안](https://claude.ai/chat/e062f3d1-6228-4466-9182-deb26ec83e1f) | 단일 HTML과 작성자 확인 | v0·검사기 보완·fix1 원본 회수 완료. fix1은 기본 목적 맥락·식별자 상세 이동·중복 안내 축소 |
| [Pro 공간 의미 조사](https://chatgpt.com/c/6ad0ec53-18e8-83ee-80c6-7b95b2dc8239) | Bloom·Archi의 관련 범위 보기와 시각 묶음 | [원문 대조·총괄 판단](2026-10-16-return-flow-03/MECHANISM_REVIEW.md) 회수. 자동 저장과 출발 보기 복원을 구별 |
| 내부 Astra High | 내용과 실제 PNG 검토 | [fix1 내용·이미지 감사](2026-10-16-return-flow-03/FIX1_CONTENT_VISUAL_AUDIT.md) 완료. 사람 관찰 아님 |
| 내부 6.1 Sol High | 코드·검사·수령·해시 감사 | [fix1 변경 감사](2026-10-16-return-flow-03/FIX1_CODE_AUDIT.md), [검사기 감사](2026-10-16-return-flow-03/CHECKER_AUDIT.md) 완료. 별도 실행 기록기 사본은 정적 보완이며 새 브라우저 실행 아님 |
| [기존 Cloud 검증 세션](https://chatgpt.com/local/01a13fcb-e7e5-73b9-b4a3-cf9a2b95b0bb?hostId=local) | 정확 fix1의 두 화면·8단계 독립 HTTP 브라우저 확인 | 원본16파일 회수·manifest15/15 대조 완료. 16단계 PASS/실제exit0. 읽기 위치0의 관측·준비 재열기57 유지 등 [범위 감사](2026-10-16-return-flow-03/CLOUD_CODE_AUDIT.md) 유지 |
| 총괄 | 범위 선택·원본 회수·독립 검토와 통합 | 기본 화면 세 보완과 좁은 복귀 흐름 수용. 모바일 첫 화면의 영향 영역은 아래에 있어 전체 위치 이해를 입증하지 않았으며 다음 연구로 남김 |

FIX058은 문서가 보고한 실제 개발 변경이며, 사용자 원발화·실제 인계 수신/수락은 미확인이다. 영향 영역은 실제 모듈 포함 구조를 입증하지 않는다. 방문 이력을 만들어 ‘지난 방문 이후’로 연출하지 않고, 인계는 준비 제안까지만 둔다. 실제 결정 요청이 없는 기록을 승인 숙제함으로 바꾸지 않는다. [제품 관점 사전 점검](2026-10-16-return-flow-03/PRODUCT_PRECHECK.md)은 관측 기준이며 구현 합격이나 사람 사용성 결과가 아니다.

실행 대상으로 전달한 fix1은 `34b4124098fe6242b34e16e23532ceb3e0fe91ad`의 [원본 묶음](https://github.com/tlsee0813-cmd/agentflow-studio/tree/34b4124098fe6242b34e16e23532ceb3e0fe91ad/docs/cycles/2026-10-16-return-flow-03/author-fix1), HTML SHA256 `af748df1dfacb7ed6b4ae3709d5ced26ef43f96bc45a9e6c2c05cdc02e9cc77e`다. 모바일 기본 화면의 영향 영역은 첫 화면 아래에 있어 추가 스크롤이 필요하며 이를 사람 이해 성공으로 바꾸지 않는다.

## 완료한 좁은 결과와 근거

- **cycle01:** 접힌 영역·연결 목록의 미결 표시, 공유 가능한 화면 근거, 평가표 상태를 보완했다. [사이클 판단](2026-10-15-mixed-depth-01/RESULT.md) · [UI02 결과](2026-10-15-mixed-depth-01/UI02_RESULT.md) · [평가표](2026-10-15-mixed-depth-01/UI_QUALITY.md) · [실행 환경](2026-10-15-mixed-depth-01/ENVIRONMENT.md).
- **cycle02 읽기 시안 fix1:** 작성자 원본과 내용·코드·Cloud 감사를 회수했다. 기존54개 확인과 내부 읽기 연속성6개 추가 관측으로 지정 로컬60개 동작의 증거를 수용했으며, 최종60개를 한 번에 다시 실행했다는 뜻은 아니다. 실제 GitHub 원문 읽기·왕복2개는 인증서 신뢰 오류로 차단되어 미실행이다. [통합 판단](2026-10-15-real-record-02/READING_FIX1_RESULT.md) · [v0 결함과 수정 경위](2026-10-15-real-record-02/READING_V0_RESULT.md). 감사의 v0 시각 불일치 주장은 감사 도구의 날짜 재출력 오류여서 철회·정정했다.
- **읽기 표현 판단:** [역할별 AI 사전 평가](2026-10-15-real-record-02/READING_ROLE_PRECHECK.md)는 자료를 아는 평가자의 비평이다. 기본 공간에는 짧은 맥락과 중요한 변화, 한 부분에는 짧은 설명, 필요할 때 정밀 근거·범위 대조를 둔다. 모바일 B의 비교 상대 맥락 미보존은 한계로 남는다. [사람 읽기 관찰표](2026-10-15-real-record-02/READING_TRIAL.md)는 미실행이다.
- **기존 메커니즘 조사:** [공간·근거 읽기 비교](2026-10-15-real-record-02/MECHANISM_REVIEW.md)와 [사용자 조정 뒤 갱신 비교](2026-10-15-real-record-02/UPDATE_MECHANISM_REVIEW.md)를 회수하고 고정 원문을 대조했다. Dify·Cytoscape·VS Code·Hypothesis·Zotero·Langfuse·Home Assistant·Penpot의 일부 원리를 비교한 것이며 도구 전체 채택이나 실제 서비스 조작 완료가 아니다.

[전체 제품 목적 대조](2026-10-15-real-record-02/PRODUCT_LENS.md)는 연구가 검사 보고서 열람기로 축소될 위험을 짚는다. 일곱 축과 방향 문서의 질문은 일괄 구현 목록이 아니다. cycle03은 다른 성격의 [FIX058 후보](2026-10-15-real-record-02/REAL_CHANGE_CANDIDATE.md)와 [입력 경계](2026-10-15-real-record-02/NEXT_UPDATE_SCOPE.md)를 사용하지만 완성된 요청→인계 사례를 확보했다고 주장하지 않는다.

## 공유와 운영 원칙

원본·대표 화면·해시·실행 범위는 GitHub 고정 커밋 링크로 인계하고 로컬은 필요한 임시 처리에 한정한다. [공유 자료 진입점](https://github.com/tlsee0813-cmd/agentflow-studio/blob/delivery/ui02-fix3-evidence/docs/transfer/README.md)은 cycle01~03의 고정 원본과 판단 링크를 모은다. Cloud는 `delivery/ui02-fix3-evidence`의 지정 전달 경로에만 원본 증거·검증기 보완을 맡고, 연구 브랜치 `checkpoint/2026-10-15` 통합은 총괄이 담당한다. 계정 차이 때문에 새 저장소의 접근성을 가정하지 않고 기존 연결 저장소의 전달 브랜치를 사용했다. 작은 결과의 ZIP과 개별 파일을 불필요하게 중복 보관하지 않는다.

사용자는 여러 Pro·Opus·Cloud 세션과 좁은 병렬 배정을 허용했다. 내부 기능 보조는 판단·반박에 Astra High, 범위가 정해진 수정·검사·환경에 6.1 Sol High를 쓴다. 브라우저 모델을 일괄 바꾸라는 지시는 아니다. 맡긴 범위의 장애는 보조 담당에게 해결시키고 확인 질문을 반복하지 않는다. 사용자의 시간당 예약 메시지는 작업 중복 시작으로 해석하지 않으며 이 대화에서 예약을 새로 만들거나 바꾸지 않았다.

## 변경하지 않은 경계와 미실행

제품 소스 기준 `618d9bd2b99ad433df35107d8902b15f45e30000`, main `896dcf3848fec70357d0f9bd4fd6c09cab70db37`, 공개 배포 `63f5540d062861439f0932cd7311c6c5510e227c`를 연구 때문에 변경하지 않았다. GUIDE107 HOLD 유지. 배포·전체 수집기·DB·연결기·유료 AI 실행·실제 인계는 이번 범위 밖이다.

사람 사용성, 새 Cloud 작업 환경 복원, Dify 추가 실제 동작 관측은 미실행이다. 내부 보조의 브라우저 표면 미노출은 Dify 결함 판정이 아니다. 검증 수·정적 이미지·공식 문서 대조를 사람 이해나 Dify 대비 품질 우위로 바꾸지 않는다. 선택은 다음 관측에서 수정할 수 있다.
