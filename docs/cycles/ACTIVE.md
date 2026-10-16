# AgentFlow 활성 연구·검증 배정

2026-10-16 11:56 KST 갱신 · 단일 총괄: 현재 Codex 대화. **현재 상태는 이 파일에서만 갱신한다.** 사이클 문서는 당시 판단 기록이다.

## 현재: 첫 제품 PC 연결12 구현 착수

[구현 계약](2026-10-16-product-reading-return-12/IMPLEMENTATION.md). USE106 고정 소스에서 `product/pc-reading-return-12` 후보 브랜치를 만들었다. 영역 읽기→선택 작업 맥락→명시 이어가기/기존 편집→지도 복귀 한 흐름을 구현·검증한다. Opus 구현, Sol 코드 경계, Astra 읽기 경험, Cloud 환경 준비를 나눠 배정했다. 구현 완료·후보 수용·공개 배포는 아직 아니다.

## 닫힌 이전 단계: cycle11 비교·수정·독립 검증

[cycle11 결과](2026-10-16-two-change-record-11/RESULT.md) · [v0 감사](2026-10-16-two-change-record-11/AUTHOR_AUDIT.md) · [fix1 감사](2026-10-16-two-change-record-11/FIX1_AUDIT.md) · [독립 감사](2026-10-16-two-change-record-11/INDEPENDENT_AUDIT.md).

같은 index/engine/style에 FLOW091과 PowerToys 두 JSON을 넣어 비교했다. PC1280×720·1440×900이 주 환경이며390은 최소 확인이다. 새 사례마다 화면을 다시 만드는 방식에서 작은 공통 입력 구조로 옮겼다. 수동 구조화한 두 표본의 성공이며 범용 자동 지도화가 아니다.

미리보기 후 문장을 고치면 이전 문장이 남던 P2를 코드 감사·총괄 실제 PC·독립 실행에서 재현하고 한 줄 수정했다. 같은 독립 검사로 v0 네 실패/child1→fix1 네 경로/child0을 확인했다. 전체 고정 계획20/20은 main16(PC본4/사례왕복2/별도시험8/390최소2)+별도 P2회귀4다. main223과P2 56의 수치는 별개이며 사람 성공률로 합산하지 않는다. 중요한 추가 기능 결함은 확인하지 못했다.

독립은 실제 관계 href, 서로 다른 사례·대상 초안, 근거 닫힘, 초안 닫기 직후 지도 복귀를 확인했다. FLOW 비초기 지도 휠 이동을 관측했고 PowerToys는 이동 여지0이라는 한계를 유지했다. 이번 복귀는 모달 아래 지도이며 제품 work 화면을 거친 복귀를 검증한 것은 아니다. 연구용 상단 설명과 긴 상세의 부담, 사람 이해·큰 지도·실제 AI 송신/수락·세션 간 보존은 남는다.

## 다음 범위: 첫 제품 연결 한 흐름

[PRODUCT_INTEGRATION](2026-10-16-two-change-record-11/PRODUCT_INTEGRATION.md)에 공통 흐름·보류 표현/위험·기존 재사용·최소 체험 연결과 완료선을 구체화했다.

영역의 짧은 현재 구상 → 사용자가 고른 관련 작업의 맥락/필요한 원문 → 기존 명시 이어가기·수동 편집 → 출발 지도 보기 복귀다. 원문을 기본 나열하거나 작업 선택을 강요하지 않는다. 읽는 요청 A와 실제 이어갈 직접 보고 R이 다를 수 있으므로 둘을 표시·검증한다. 복귀는 시야를 돌려주되 명시적으로 이어갈 기록과 해당 manual4필드 수정값을 되돌리지 않는다.

연구 엔진/자유문 저장형식을 제품에 통째로 이식하지 않는다. 현재 평면 데이터는 첫 연결의 저장 경계이며 층위 있는 지도의 최종 포기가 아니다. 근거 없는 기능 변경/지난방문 변화/미결을 만들지 않는다. 유사 시안을 계속 추가하는 것을 자동 다음 단계로 삼지 않는다. **범위 결정 완료와 제품 구현·반영 완료는 다르다.**

| 담당 | 현재 상태 |
|---|---|
| Pro A/B | 공간·변경 읽기 연구, 고정 원문 대조 완료. 새 광범위 조사 미배정 |
| Opus | cycle11 완료, 제품 PC 연결12 구현 배정 준비 |
| Cloud | cycle11 완료, 제품 후보 독립 검증 환경 확인 중 |
| Astra High /6.1 Sol High | 제품 읽기 경험·코드 경계·환경 준비 병렬 검토 중 |
| 총괄 | 제품 구현 계약·배정·독립 검증·결과 통합 담당 |

## 공유 원본과 운영 경계

[v0 116파일](https://github.com/tlsee0813-cmd/agentflow-studio/tree/6643323316daefbe10625484bb1727a2c6a54716/docs/transfer/shared-map-11/author-v0) · [fix1 overlay22파일](https://github.com/tlsee0813-cmd/agentflow-studio/tree/c4354dccc6f693bf33d5157e7e8da566d152d9a1/docs/transfer/shared-map-11/author-fix1) · [독립60파일/대표PNG4](https://github.com/tlsee0813-cmd/agentflow-studio/tree/519a57c00062c142548b0a1d9a270949aacf3bd4/docs/transfer/shared-map-11/independent-v0). GitHub가 공유 원본이며 로컬 ZIP 경로가 없어도 회수 가능하다. 로컬은 수령·감사·미리보기 임시 자료다.

[cycle10 결과](2026-10-16-relation-reading-10/RESULT.md)와 이전 판단을 다시 열지 않았다. 연구 결과는 checkpoint의 docs/cycles/, 증거 전달은 지정 delivery의 docs/transfer/에 정리했다. 상위 안내3개는 제품 사실 기준과 현재 연구 진입점을 구분하도록 링크·시점 표현만 보완했다. 사용자 예약은 중복 생성·변경하지 않았다.

2026-10-16 11:18 KST 원격 확인: main `896dcf3848fec70357d0f9bd4fd6c09cab70db37`, gh-pages `63f5540d062861439f0932cd7311c6c5510e227c` 유지. 제품 기준 USE106 `618d9bd2b99ad433df35107d8902b15f45e30000`, GUIDE107 HOLD 유지. 제품 소스·공개 체험판 적용은 아직 아니다.
