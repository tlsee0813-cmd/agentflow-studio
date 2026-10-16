# AgentFlow 현재 진행·배정

2026-10-16 13:40 KST 갱신 · 단일 총괄: 현재 Codex 대화. **현재 진행은 이 파일에서만 갱신한다.** 사이클 문서는 당시 판단 기록이며 제품/공개 기준은 [PROJECT_STATUS](../PROJECT_STATUS.md)를 본다.

## 현재: 제품12 수용·통합 완료, PC 지도 공간13 조사 진행

PC 영역 구상 → 선택한 요청 읽기 → 명시 이어가기·기존 수동 편집 → 출발 지도 복귀를 실제 제품에 반영했다. [PR #3](https://github.com/tlsee0813-cmd/agentflow-studio/pull/3)은 [ecf586c8](https://github.com/tlsee0813-cmd/agentflow-studio/commit/ecf586c8a2235e4f4c570cab13bf0dbdc4004003)로 checkpoint에 병합했다. 최종 제품 소스는 `9613208f40f1f7f8506504ac6025f06e421edd4d`이며 기존 연구 문서와 최종5파일을 모두 보존했다.

[제품12 결과·정정·공유 증거](2026-10-16-product-reading-return-12/RESULT.md) · [구현 계약](2026-10-16-product-reading-return-12/IMPLEMENTATION.md).

긴 수동 전문 접근·펼침 소실·편집 후 호출 위치 이동을 수정했고 고정 구버전 실패→수정본 통과를 확인했다. 독립 PC6장면과 별도 경계·390최소 확인, 두 OS CI(각 PC12 15개)가 통과했다. 작성자·독립·CI 수치는 합산하지 않는다. 총괄도 같은 정적 제품에서 직접 읽기·편집·왕복을 확인했다. 삭제/보관 중 복귀·사람 이해도·큰 지도·실제 AI는 수용 범위가 아니다.

## 다음 범위: PC에서 지도와 한 부분의 이해에 집중

[PC 지도 공간13 범위](2026-10-16-pc-map-space-13/BRIEF.md). 현 제품은 지도 위 설명·상태·보고 영역이 커서 첫 화면에서 지도가 아래로 밀린다. 공간 배분(Opus)과 기본 읽기량(Pro)을 두 관점으로 나눠 기존 기제를 비교한 뒤 하나의 제품 개선으로 좁힌다.

층위·관계·변경이라는 최종 목적을 유지한다. Dify의 목적/업무 모델을 복제하지 않고 지도/선택 상세 배치 기제를 참고한다. 기록에 없는 미결/변화를 만들지 않는다. 현재 평면 저장 구조를 최종 확정으로 보지 않는다. 모바일보다 PC1280×720·1440×900에 집중한다.

| 담당 | 상태 |
|---|---|
| 공간 담당 | Pro A 기존 창은 사람 확인 화면으로 대기. 보조 연결도 해당 브라우저를 볼 수 없어 Opus에 같은 좁은 비교를 배정 |
| Pro B | 기본 읽기·필요한 상세 공개·실제 편집 대상 표현 비교 발송, 응답 중 |
| Opus | 제품12 fix2 완료. PC 지도/선택상세 공간 배치 연구 발송. 새 코드 수정은 아직 배정하지 않음 |
| Cloud | 제품12 독립 실행·부정 증거·B선택 보완·공유 게시 완료 |
| Astra High /6.1 Sol High | 제품12 코드·원시·CI·170파일 감사 완료. Astra는 다음 재배치의 기존 코드 결합 지점 확인 중 |
| 총괄 | 제품12 수용·checkpoint 통합·문서 정리 완료. 다음 제품 범위 통합 담당 |

## 증거 회수와 운영 경계

[제품12 최종 독립170파일/PNG4](https://github.com/tlsee0813-cmd/agentflow-studio/tree/398a91adf918113bd77dfbd3454fc3c85b00cc3d/docs/transfer/pc-reading-return-12/independent-fix2) · [두 OS CI 작은 발췌8파일](https://github.com/tlsee0813-cmd/agentflow-studio/tree/15299701c7e5079242c6146908459a256a29ffc3/docs/transfer/pc-reading-return-12/ci-final) · [작성자 fix2 38파일](https://github.com/tlsee0813-cmd/agentflow-studio/tree/0d6061c511ea42057c329d5a216bb7fa30b49076/docs/transfer/pc-reading-return-12/author-fix2).

GitHub가 공유 원본이며 로컬 ZIP 경로 없이 회수 가능하다. 현재 PC 체험은 기존 로컬 서버에 최소17파일433,933B만 두고 원격 해시와 대조했다. 공개 배포를 뜻하지 않는다. [실행 안내](https://github.com/tlsee0813-cmd/agentflow-studio/blob/398a91adf918113bd77dfbd3454fc3c85b00cc3d/docs/transfer/pc-reading-return-12/independent-fix2/preview/START.md).

main `896dcf3848fec70357d0f9bd4fd6c09cab70db37`·gh-pages `63f5540d062861439f0932cd7311c6c5510e227c` 유지. GUIDE107 HOLD 유지. 사용자 예약을 중복 생성·변경하지 않는다.

직전 [cycle11 결과](2026-10-16-two-change-record-11/RESULT.md)와 [제품 반영 판단](2026-10-16-two-change-record-11/PRODUCT_INTEGRATION.md)은 그대로 보존한다. 같은 화면에 두 수동 구조화 사례를 넣은 검증이며 범용 자동 지도화로 확대하지 않는다.
