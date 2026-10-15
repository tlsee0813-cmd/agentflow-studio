# AgentFlow 연구 증거 전달

이 브랜치는 세션 간 원본 파일을 전달하는 공간이다. 제품 배포나 현재 연구 상태의 별도 사본이 아니다.

- [목적·역할 cycle06 통합 판단 — 고정 연구판](https://github.com/tlsee0813-cmd/agentflow-studio/blob/d17667c1c519492f6edf8ea064a9f87b5d51fc12/docs/cycles/2026-10-16-purpose-06/RESULT.md)
- [구성 지도 cycle05 통합 판단 — 고정 연구판](https://github.com/tlsee0813-cmd/agentflow-studio/blob/9b4a422f4e46085acb0841e9d9201c7ff86d6b81/docs/cycles/2026-10-16-composition-05/RESULT.md)
- [현재 상태와 다음 범위](https://github.com/tlsee0813-cmd/agentflow-studio/blob/checkpoint/2026-10-15/docs/cycles/ACTIVE.md)
- [첫 진입 A/B cycle04 통합 판단 — 고정 연구판](https://github.com/tlsee0813-cmd/agentflow-studio/blob/571e7a7030039b4d4354757949cdabc8533c70aa/docs/cycles/2026-10-16-orientation-04/RESULT.md)
- [공간 복귀 cycle03 통합 판단 — 고정 연구판](https://github.com/tlsee0813-cmd/agentflow-studio/blob/35b064841e3649378c4e11c019625e569a2fc7c6/docs/cycles/2026-10-16-return-flow-03/RESULT.md)
- [읽기 fix1 통합 판단 — 고정 연구판](https://github.com/tlsee0813-cmd/agentflow-studio/blob/3751b32928ea5f6b8df2ce892b33d4cb9bd62c85/docs/cycles/2026-10-15-real-record-02/READING_FIX1_RESULT.md)

| 묶음 | 고정 원본 | 읽는 순서와 범위 |
|---|---|---|
| cycle06 목적·역할 작성자 v0 | [원본 45파일](https://github.com/tlsee0813-cmd/agentflow-studio/tree/d16e66742fd487ef11a776fedb5b76fd35e964ea/docs/transfer/purpose-06/author-v0) | 첫 검사 오류·실제 비초기 행높이 결함·수정 후 실행을 모두 보존. 원격45/45 바이트 일치 |
| cycle06 목적·역할 작성자 fix1 | [HTML·기본문·PNG·검사 원본 13파일](https://github.com/tlsee0813-cmd/agentflow-studio/tree/fbea41f245c4020bc044c7e0c7502d106fc900ae/docs/transfer/purpose-06/author-fix1) | ‘정보 없음’을 ‘미결정’으로 단정한 네 문구만 수정. 원격13/13 바이트 일치. 배율/중심 측정의 한계는 통합 결과 참조 |
| cycle06 fix1 독립 관측 | [원본 24파일](https://github.com/tlsee0813-cmd/agentflow-studio/tree/68d357d0805c8d27833ee49f5137c22fbc148c68/docs/transfer/purpose-06/independent-fix1) | 최신 run02 단일 6장면·39단언, 실제 child/collector 0. computed 배율·세 대상 좌표·근거 닫힘·기본 준비문과 요청 칸 편집. 측정기 첫 실패·합성 해시 probe 보존. 원격 payload23/23 bytes/SHA 일치 |
| cycle06 비초기 맥락 복귀 보완 | [별도 16파일](https://github.com/tlsee0813-cmd/agentflow-studio/tree/11016a2be174c4b6dd9543d14bc201207eabac73/docs/transfer/purpose-06/independent-fix1/context-return-addendum) | X2 위치 확인→읽기 복귀 2경로·16단언, 두 폭 reader100→100·행 좌표 변화0. 별도 실행이며 기존39에 합산하지 않음. 실제 child/wrapper0·payload15/15 bytes/SHA 일치 |
| cycle05 구성 작성자 원본 | [HTML·코드·첫 실패·PNG5·manifest 24파일](https://github.com/tlsee0813-cmd/agentflow-studio/tree/10d1f03f6944a2787079cdb49cf009c6b1fbd302/docs/transfer/composition-05/author-v0) | 원격24/24 bytes대조. README의 모든묶음 준비불가 주장은 통합결과에서 미세분화기능 예외로 정정 |
| cycle05 구성 독립 관측 | [원본34파일](https://github.com/tlsee0813-cmd/agentflow-studio/tree/2f80732664686669f623d3f32238c39807c1112d/docs/transfer/composition-05/independent-v0) | 390의8장면(run02 전체child1) +1440의6장면(run04 child0),14는오프라인집계. 최초검사오류3회와합성probe보존. aria상태 미측정·상위수집기exit0 경계는 통합결과 참조. 원격payload33/33 bytesSHA일치 |
| cycle05 공식 참고 관측 접근 실패 | [접속실패 원본6파일](https://github.com/tlsee0813-cmd/agentflow-studio/tree/bb2bb37b106c0ec1cf4063b27fb1c666229f2f50/docs/transfer/composition-05/reference-folding) | ERR_TUNNEL_CONNECTION_FAILED·전장면NOT_RUN·PNG없음. 우리시안검증이나 총괄 IAB관측과 합산하지 않음. 버전기록불일치 주석은 연구SOURCE_AUDIT |
| UI02 fix3 | [원본·별도 검증기 보완](https://github.com/tlsee0813-cmd/agentflow-studio/tree/4f4dfe5adec05b849753391d6a8932ec0377966c/docs/transfer/ui02-fix3) | 첫 사이클의 합격 기준9와 실제 화면 증거. 작성자·독립 검사를 구별 |
| 읽기 v0 결함 재현 | [v0-preflight](https://github.com/tlsee0813-cmd/agentflow-studio/tree/7e79392080157be693429da40d54c2a206b8aa7b/docs/transfer/real-record-02/v0-preflight) | 수정 전 닫힘 결함. 6통과·4실패·exit1을 그대로 보존 |
| 읽기 fix1 독립 검증 | [fix1 전체](https://github.com/tlsee0813-cmd/agentflow-studio/tree/ce91a08fe8ff641a491d34bf35de732f85816792/docs/transfer/real-record-02/fix1) | REPORT의 당시 미검증6건은 아래 continuity-addendum과 함께 읽음 |
| 같은 근거의 읽기 연속성 | [추가6전환](https://github.com/tlsee0813-cmd/agentflow-studio/tree/ce91a08fe8ff641a491d34bf35de732f85816792/docs/transfer/real-record-02/fix1/continuity-addendum) | 실제 텍스트·줄·가시범위 관측6/6. 기존54확인과 함께 지정 로컬 계약 증거 확보. 외부 원문2건은 차단·미실행 |
| cycle02 작성자 원본 | [v0](https://github.com/tlsee0813-cmd/agentflow-studio/tree/4b396e8da9e01e3f9e3b2068c6d76d17848ffb3a/docs/cycles/2026-10-15-real-record-02/reading-v0) / [fix1](https://github.com/tlsee0813-cmd/agentflow-studio/tree/4971cb51965a7c40b374ddf0210f51c8609ed20e/docs/cycles/2026-10-15-real-record-02/reading-fix1) | 연구 브랜치의 정확 바이트. 작성자 수치와 독립 수치를 합산하지 않음 |
| cycle03 공간 복귀 작성자 fix1 | [HTML·대표 화면·작성자 검사](https://github.com/tlsee0813-cmd/agentflow-studio/tree/34b4124098fe6242b34e16e23532ceb3e0fe91ad/docs/cycles/2026-10-16-return-flow-03/author-fix1) | 기본 목적 맥락·식별자 상세 이동·중복 안내 축소. 작성자 결과와 독립 검증을 구별 |
| cycle03 공간 복귀 독립 검증 | [16파일 원본](https://github.com/tlsee0813-cmd/agentflow-studio/tree/0201912a2e05ae920337bf25c9e2d116142c94d7/docs/transfer/return-flow-03/fix1) | 두 화면×8단계 PASS, 실제 exit0와 HTTP 응답 원본 대조. 읽기 위치0·준비 재열기 스크롤 유지·모바일 첫 화면 한계는 통합 판단에서 구별 |
| cycle04 이전 화면 기준 | [기준 원본](https://github.com/tlsee0813-cmd/agentflow-studio/tree/62d59d7ed6f4f460831ae88685bde5b7e2dac703/docs/transfer/orientation-04/baseline) / [측정 정의 보완](https://github.com/tlsee0813-cmd/agentflow-studio/tree/165c15205a2f89d591ab431df47be5b9592676ff/docs/transfer/orientation-04/baseline/definition-addendum) | 세 크기의 초기 화면 관측. 대상 자체 경계를 반영한 문자 Range 정의 보완은 UI 수정이나 사람 이해 검사가 아님 |
| cycle04 A/B 작성자 원본 | [v0 29파일](https://github.com/tlsee0813-cmd/agentflow-studio/tree/35fdcd822b2ef5472a2079556103b65dd1f845ea/docs/cycles/2026-10-16-orientation-04/author-v0) / [fix1 18파일](https://github.com/tlsee0813-cmd/agentflow-studio/tree/fb87a21aed0ada58c637c7be7e878e6b459d70f6/docs/cycles/2026-10-16-orientation-04/author-fix1) | v0 전체 실행과 첫 실패를 보존. fix1은 B 한 문장·종료 집계 래퍼 수정이며 작성자 전체 재실행으로 주장하지 않음 |
| cycle04 fix1 독립 검증 | [21파일 원본](https://github.com/tlsee0813-cmd/agentflow-studio/tree/1202cea9e5b97a79b3a55e268e6040b67a16aa9e/docs/transfer/orientation-04/fix1) | 초기6화면을 포함한17장면, 실제 자식 exit0·최초 HTTP6개 원본 일치. 별도 사전 해시 합성 probe exit1은 브라우저 실행 전 실패. 비초기 읽기·정확7대상 복귀·B 선택/가리킴 혼재를 좁게 검증 |

원본의 첫 실패·재실행·미실행 기록을 덮어쓰지 않는다. v0 시각 불일치 주장은 내부 감사의 날짜 표시 변환 오류로 철회됐으며 정정은 fix1/continuity-addendum/V0_TIME_ADDENDUM.md에 있다. 대표 PNG와 코드·JSON·로그·파일 해시를 직접 회수할 수 있으므로 사용자 로컬 ZIP 경로가 필요하지 않다. 사람 사용성·B 모바일 나란히 대조·전체 제품 품질을 이 실행 결과로 통과 처리하지 않는다.


cycle04 대표 첫 화면: [A · 1440×900](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1202cea9e5b97a79b3a55e268e6040b67a16aa9e/docs/transfer/orientation-04/fix1/output/a-1440x900-initial.png) · [B · 1440×900](https://github.com/tlsee0813-cmd/agentflow-studio/blob/1202cea9e5b97a79b3a55e268e6040b67a16aa9e/docs/transfer/orientation-04/fix1/output/b-1440x900-initial.png). 나머지 네 초기 PNG와 실제 실행 기록은 위 독립 검증 원본에서 직접 회수한다. A 관계 개요의 조건부 유지와 B 긴 설명 배치 보류는 총괄 판단이며, 사람 사용성·최종 제품 문법의 확정이 아니다.


cycle05 대표 첫 화면: [1440×900](https://github.com/tlsee0813-cmd/agentflow-studio/blob/2f80732664686669f623d3f32238c39807c1112d/docs/transfer/composition-05/independent-v0/png/1440-initial.png) · [390×844](https://github.com/tlsee0813-cmd/agentflow-studio/blob/2f80732664686669f623d3f32238c39807c1112d/docs/transfer/composition-05/independent-v0/png/390-initial.png). 독립PNG 나머지3개는 검사기 오류 진단 화면이며 성공 대표 화면으로 바꾸어 부르지 않는다. 작성자 집중·준비 PNG5개와 구분한다. 입력은 과거 개발계약/MOCK보고이며 실제 사용자 원대화가 아니다. 위치 복원·국소관계 접근을 전체 프로그램 이해로 확대하지 않는다.


cycle06 대표 화면: [첫 화면1440](https://github.com/tlsee0813-cmd/agentflow-studio/blob/68d357d0805c8d27833ee49f5137c22fbc148c68/docs/transfer/purpose-06/independent-fix1/initial-1440.png) · [첫 화면390](https://github.com/tlsee0813-cmd/agentflow-studio/blob/68d357d0805c8d27833ee49f5137c22fbc148c68/docs/transfer/purpose-06/independent-fix1/initial-390.png) · [390 역할·조건 읽기](https://github.com/tlsee0813-cmd/agentflow-studio/blob/68d357d0805c8d27833ee49f5137c22fbc148c68/docs/transfer/purpose-06/independent-fix1/role-condition-390.png) · [편집 전 준비문](https://github.com/tlsee0813-cmd/agentflow-studio/blob/68d357d0805c8d27833ee49f5137c22fbc148c68/docs/transfer/purpose-06/independent-fix1/prep-default-1440.png). N01은 개발자 합성 초기 구상이다. 외부 실제 작업 기록 후보는 통합 판단의 다음 입력으로 구별하며, 이 시안에서 실제 요구 변경이나 AI 수행을 검증했다고 쓰지 않는다.
