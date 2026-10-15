# AgentFlow 활성 연구·검증 배정

2026-10-16 갱신 · 단일 총괄: 현재 Codex 대화. **현재 실행 상태는 이 문서에 모으고, 연구 문서는 당시 판단과 관측을 보존한다.**

## 진행: cycle04 첫 화면의 변화·부분·관련 영역 이해

cycle03은 작은 복귀 흐름의 근거를 확보해 정리했다. 다음 질문은 **처음 들어왔을 때 변경과 관련 부분을 함께 이해하고, 상세를 읽은 뒤 그 맥락을 이어갈 수 있는가**다. 390 화면에서 상단 설명 약524px 아래에 영향 영역이 있다는 관측에서 출발했지만, 단순 모바일 압축으로 한정하지 않는다. 총괄이 본 1280×720 초기 화면도 선택 전 관계가 드러나지 않고 일부 영역을 스크롤해야 하므로 넓고 좁은 화면의 같은 대상·의미를 함께 본다. 이것은 사람 이해도 측정이 아니다.

고정 입력은 연구 `c0328dcacf4f50541814d7c18801a45ae8a20cb0`의 [cycle03 결과](2026-10-16-return-flow-03/RESULT.md)·[내용 계약](2026-10-16-return-flow-03/INPUT.md)·[제품 관점](2026-10-15-real-record-02/PRODUCT_LENS.md), 시안 원본 `34b4124098fe6242b34e16e23532ceb3e0fe91ad`의 [author-fix1](https://github.com/tlsee0813-cmd/agentflow-studio/tree/34b4124098fe6242b34e16e23532ceb3e0fe91ad/docs/cycles/2026-10-16-return-flow-03/author-fix1)이다. [cycle04 고정 배정](2026-10-16-orientation-04/BRIEF.md)은 `1bba6f339acf5874ceb81874c4c8b70e37fbc8c0`이다. **A 관련 범위 먼저 / B 짧은 설명에서 같은 대상 참조 직행**의 fix1 원본을 회수했고 독립 브라우저 검증 중이다. [조사 대조와 선택 이유](2026-10-16-orientation-04/MECHANISM_REVIEW.md)를 보존한다.

| 담당 | 이번 좁은 배정 | 현재 상태 |
|---|---|---|
| [Pro 공간·탐색](https://chatgpt.com/c/6ad0ec2b-71b8-83ec-8e3a-798f622b57dc) | 좁은 화면에서도 선택·관련 영역을 유지하는 기존 메커니즘 최대3개 | 완료·원문 대조. OsmAnd/ArcGIS/Power BI의 조건을 좁힘. 직접 데모 조작·PNG 열람은 미완료 |
| [Pro 요약·근거](https://chatgpt.com/c/6ad0ec53-18e8-83ee-80c6-7b95b2dc8239) | 중요한 사실 경계를 유지하면서 기본 설명 부담을 줄이는 메커니즘2개 | 완료·원문 대조. Grafana/Terraform의 같은 대상 상세와 실제 적용 구분만 참고 |
| 내부 Astra High | 전체 목적 대조, 비교 후보 최대2개와 나빠지는 장면 | 완료. A/B 관계 정보량을 같게 유지하도록 반박. 사람 사용성 아님 |
| 내부 6.1 Sol High | 기존 동작 보존과 위험에 맞는 4~6개 관측 장면 | 완료. 위험 중심5장면·코드 결합·공식 원문 대조. 실행 결과 아님 |
| [Opus 5.5 High](https://claude.ai/chat/e062f3d1-6228-4466-9182-deb26ec83e1f) | 고정 배정의 두 비교 표현과 작성자 검사 | fix1 완료·[최소 변경 감사](2026-10-16-orientation-04/FIX1_AUDIT.md) 수용. 원본 fb87a21a·HTML889317d5… 보존, 추가 구현 없음 |
| [기존 Cloud 세션](https://chatgpt.com/local/01a13fcb-e7e5-73b9-b4a3-cf9a2b95b0bb?hostId=local) | cycle04 정확 fix1의 초기6화면·위험 중심5장면 독립 관측 | 진행 중. fb87a21a/HTML889317d5… 대상. [보완한 기준 정의](2026-10-16-orientation-04/BASELINE.md)를 재사용하며 작성자 결과와 구분 |
| 총괄 | 조사 대조·범위 선택·원본 회수·독립 검토·통합 | v0·fix1 원본 GitHub 보존·원격 바이트 재확인. 내용/코드 감사 수용. A 관계 개요 조건부 유지·B 배치 보류/참조 원리 보존의 잠정 판단, Cloud 반환 후 통합 예정 |

최종 목표는 프로그램 구상·변화의 이해와 필요한 조정·인계다. 검사 보고서 열람기로 축소하지 않고, 그렇다고 실제 모듈 포함·사용자 승인·AI 준수·인계 수락이 없는 입력에 그런 사실을 채우지 않는다. 질문 목록은 일괄 개발 목록이 아니다. 이전 성공 장면의 검사 수를 늘리기보다 이번 표현이 바꾸는 위험을 관측한다.

## 정리된 결과

- **cycle03 공간 복귀:** [통합 판단](2026-10-16-return-flow-03/RESULT.md). 기본 목적 맥락·기술 식별자의 상세 이동·중복 안내를 보완했다. 독립 HTTP 브라우저의 두 화면×8단계 PASS와 실제 exit0, 정확 원본·좌표 복귀 근거를 수용했다. 독립 읽기 위치는0, 준비 재열기는57 유지, 모바일 표시4개 존재는 동시 가시성 증거가 아님을 구별한다. [Cloud 범위 감사](2026-10-16-return-flow-03/CLOUD_CODE_AUDIT.md)·[공유 원본](https://github.com/tlsee0813-cmd/agentflow-studio/tree/0201912a2e05ae920337bf25c9e2d116142c94d7/docs/transfer/return-flow-03/fix1).
- **cycle02 읽기:** [통합 판단](2026-10-15-real-record-02/READING_FIX1_RESULT.md). 지정 로컬60개 동작의 근거는 기존54+추가6이며 한 번의 최종60개 재실행이 아니다. 외부 GitHub 원문 왕복2개는 인증서 신뢰 오류로 미실행. [v0 결함·수정](2026-10-15-real-record-02/READING_V0_RESULT.md). v0 시각 불일치 주장은 감사 도구의 날짜 표시 변환 오류로 철회·정정했다.
- **cycle01 혼합 깊이:** [결과](2026-10-15-mixed-depth-01/RESULT.md)·[UI02 결과](2026-10-15-mixed-depth-01/UI02_RESULT.md). 접힌 영역·연결 목록의 미결 표시, 공유 화면 근거, 평가표 상태를 보완했다.
- **기존 조사·판단:** [전체 제품 목적](2026-10-15-real-record-02/PRODUCT_LENS.md), [공간·근거](2026-10-15-real-record-02/MECHANISM_REVIEW.md), [사용자 조정 뒤 갱신](2026-10-15-real-record-02/UPDATE_MECHANISM_REVIEW.md), [Bloom·Archi 대조](2026-10-16-return-flow-03/MECHANISM_REVIEW.md). 원문·코드 비교와 실제 서비스 조작을 구별한다. [역할별 AI 평가](2026-10-15-real-record-02/READING_ROLE_PRECHECK.md)는 사람 관찰이 아니며 [사람 관찰표](2026-10-15-real-record-02/READING_TRIAL.md)는 미실행이다.

## 공유·운영과 경계

[공유 자료 진입점](https://github.com/tlsee0813-cmd/agentflow-studio/blob/delivery/ui02-fix3-evidence/docs/transfer/README.md)에서 고정 원본·대표 화면·검증 범위를 회수할 수 있다. 로컬은 필요한 임시 처리만 사용한다. 연구 브랜치 `checkpoint/2026-10-15`는 총괄만 통합하고, Cloud는 지정된 `delivery/ui02-fix3-evidence` 경로에만 쓴다. cycle03 실행은 종료됐으며 같은 Opus/Cloud 세션에 위 cycle04의 좁은 배정을 새로 전달했다. Cloud 현재 출력 경로는 `docs/transfer/orientation-04/fix1/` (기존 baseline과 definition-addendum 보존)이며 공유 README는 총괄이 갱신한다.

내부 보조는 판단·반박에 Astra High, 범위가 정해진 코드·검사·환경에 6.1 Sol High를 사용한다. 브라우저 모델을 일괄 변경하라는 지시는 아니다. 사용자 예약 메시지는 중복 착수 지시로 해석하지 않으며 예약을 새로 만들거나 바꾸지 않았다. 장애는 보조에게 좁게 분리하고 일상적인 확인 질문을 반복하지 않는다.

제품 소스 기준 `618d9bd2b99ad433df35107d8902b15f45e30000`, main `896dcf3848fec70357d0f9bd4fd6c09cab70db37`, 공개 배포 `63f5540d062861439f0932cd7311c6c5510e227c`는 연구 때문에 변경하지 않았다. GUIDE107 HOLD 유지. 사람 사용성·실제 손가락 조작·실제 AI/인계 실행·새 Cloud 환경 복원·Dify 대비 품질 우위는 완료로 주장하지 않는다. 선택은 다음 관측에서 수정할 수 있다.
