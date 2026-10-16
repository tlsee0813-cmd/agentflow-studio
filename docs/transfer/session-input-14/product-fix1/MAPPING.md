# session14 두 번째 표본 — v0에서 fix1으로 한 번 갱신

**기존 v1로 표현 가능하다.** `session14-product-map.json`은 보존하고 `session14-product-map-fix1.json`을 별도로 만들었다. 같은 caseId, 다섯 노드의 ID·이름·parent·역할·짧은 설명, 한 관계와 initialView를 유지했다. 새 기능·노드·관계·미결을 만들지 않았다. 제품/렌더러 실행이나 자동 추출·갱신 검증은 아니다.

| 대응 | 이번 판단 |
|---|---|
| 동일 부분 유지 | [고정 fix1 diff](https://github.com/tlsee0813-cmd/agentflow-studio/blob/827f029e0dab79b48ebe8818fb15d32db7ed8d06/docs/transfer/pc-map-space-13/author-fix1/v0-9aeb459-to-fix1.diff)를 직접 읽었다. 제품 변경은 PC `.map-controls` 위치를 위 오른쪽으로 옮기는 CSS 4줄이며 나머지는 검사 파일이다. app.ts와 기존 동작 연결이 바뀌지 않아 이름 유사성만으로 동일성을 추정할 필요가 없다. |
| 변경 소유 | MAP의 change만 v0→fix1 구간으로 바꿨다. PURPOSE/RECORDS/ADD는 이번 구간 변경이 없어 change를 제거했다. 기능 제거·이전 변경 취소·전체 이력상 무변경이 아니다. 이전 변경의 근거와 v0 표본은 남는다. 루트에 변경을 복제하지 않았다. |
| 주장과 관측 | [작성자 fix1 REPORT](https://github.com/tlsee0813-cmd/agentflow-studio/blob/827f029e0dab79b48ebe8818fb15d32db7ed8d06/docs/transfer/pc-map-space-13/author-fix1/REPORT.md)는 동일 최종 검사에서 v0 3개 테스트 실패·52 soft 조건 false와 fix1 최종 14/15/18 및 child 0을 보고한다. 여기서는 REPORT 독해이며 raw 수치 재집계가 아니다. 테스트 수·조건 수를 합산하거나 모든 condition을 명시 pass로 세지 않았다. |
| 과거 독립 결과 | [709dab v0 독립 보고](https://github.com/tlsee0813-cmd/agentflow-studio/blob/709dab4d730c87b44e1a08a1cddd0cb9832b807a/docs/transfer/pc-map-space-13/independent-v0/REPORT.md)는 v0 과거 관측으로만 유지했다. fix1 통과나 실패로 전이하지 않는다. 작성자는 선택 카드 완전 가림의 기존 제한이 남았다고 밝히며, fix1 독립 결과는 작성 시점 대기다. |

고정 제품 비교는 `9aeb4599aa0060e2d43143c4f1150884d7bcc7b3` → `606120500eeea50a20f00fb4678bced7a7d93d98`이다. 전달 원본의 REPORT와 diff를 읽었으며 새 제품 전체 소스·원시 실행 전수를 감사한 것은 아니다. 첫 QA 비연속 8사건은 이 갱신에 섞지 않았다.

caseId는 같은 제품13 제한 사례의 다음 판본이라는 자료 대응을 위해 유지했다. 판본은 파일·basisTime·고정 source로 구분한다. **같은 caseId라는 사실도 런타임 동일 지도 갱신·선택 유지·자동 merge·상태 복원을 증명하지 않는다.** 렌더러가 caseId로 상태를 공유한다면 두 판본을 비교할 때 그 영향도 별도 관측해야 하며, 이번 JSON 정적 대응 결과로 성공을 선언하지 않는다.

기존 schemaVersion 1의 change는 한 비교 구간을 표현하므로 **누적 변경 이력은 이전 JSON과 고정 근거로 보존**한다. evidence type/summary/limits와 basisTime으로 과거 관측·새 주장·독립 대기를 구분할 수 있지만, 사건 순서나 자동 충돌 해결을 전용 구조로 검증하는 형식은 아니다. parent는 기존 AI 보기 제안일 뿐 제품 소속 확정으로 승격하지 않았다.

정적 JSON 확인: 5노드·1관계·9근거, 변경 노드는 MAP 하나, caseId/노드 ID·이름·parent·역할·짧은 설명 및 관계 내용 동일, 누락 근거 참조 없음. 이 결과는 이번 제한 표본에서 손으로 동일성과 변경 범위를 보존할 수 있음을 보여준다. 자동 갱신 완료, 모든 확대·이동에서의 접근성, 사람 이해를 입증하지 않는다.
