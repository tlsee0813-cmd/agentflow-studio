# cycle07 — 공간 비교 공식 원문 감사

2026-10-16 · Sol. 지정 공식 문서 **두 개만** 읽었다. 라이브 문서의 설명을 대조한 것이며 Onshape/GitHub 서비스를 직접 조작하거나 사람 이해를 관측한 결과가 아니다. 추가 후보 탐색·구현·원격 쓰기는 없다.

| 원문과 위치 | 실제 지지 | 과장·적용 경계 |
|---|---|---|
| [Onshape Comparing](https://cad.onshape.com/help/Content/Document/compare.htm) — **What you see / What you can do / Interpreting the lists** | 선택한 두 history entry의 feature 목록과 시각적 차이를 비교한다. Base/Target을 색으로 구별하고 슬라이더로 어느 쪽을 더 많이/적게 표시한다. 차이만/전체 목록을 전환하며 동일·서로 다름·Base에만/Target에만 존재·목록 위치 차이를 구별한다. 문서 하단 **Last Updated: October 09, 2026** 표기도 확인했다. | 슬라이더를 정확한 투명도 비율/인과 기여도로 해석할 근거는 없다. 이력 형상 비교의 설명이지 코드 책임 이동을 자동 판별하는 기능이 아니다. 적용 범위는 Part Studio/Feature Studio이며 후자는 별도로 줄별 코드 추가/삭제 비교를 설명한다. 모든 비교가 같은 형상 겹침 방식이라고 묶지 않는다. |
| [GitHub Reviewing proposed changes](https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/reviewing-proposed-changes-in-a-pull-request) — **Understanding the purpose… / Using the pull request sidebar for context / Starting a review** | 관련 issue/discussion으로 목적·배경을 확인하고 Files changed에서 unified/split을 선택하며 파일 필터/트리로 범위를 좁힐 수 있다. | 코드 diff와 목적 맥락을 함께 읽는 절차다. UI가 요구 인과·제품 계층·기능 영향·실행 성공을 자동 확정하지 않는다. 파일 필터로 숨긴 부분을 미변경/무영향으로 판단할 근거도 아니다. |

## 이번 A/B에 적용하는 해석

**A의 조건부 추천은 우리 판단이다.** 같은3대상/기존2선을 유지하면서 ‘두 메뉴에 있던 진행 정보 누락 검사·경과 시간 계산이 기존 공통 함수 안으로 모였다’를 비교하는 것은, 공통 대상을 남겨 두고 차이와 불변을 구별한다는 참고 원칙에 맞는다. Onshape가 이 코드 표현이나 모바일 이해 효과를 검증한 것은 아니다. 기능 카드가 옮겨지거나 없어졌다는 의미, 실제 코드 모듈의 이동/신설, 실행 순서로 읽히면 이 표현의 전제가 깨진다.

**B는 전달 인자 차이에 한정한 대안이다.** 기존 두 호출은 `downloadedBytes, totalBytes, elapsedMs`, 변경 후 호출은 `Downloading state`다. helper는 그 상태의 `startTime`에서 elapsed를 계산한다. 따라서 ‘같은 세 수를 객체로 포장’만 한 변경이 아니며 입력 확인/경과 계산의 책임 이동도 있다. `state`를 새 기능 노드나 두 UI가 공유하는 동일 객체 인스턴스로 만들지 않는다. 이 구별은 공식 비교 문서가 아닌 앞선 **고정 patch 감사**에 근거한다.

공식 문서에서 가져올 수 있는 것은 **비교 기준 두 개를 명확히 하고, 같은 대상의 차이·불변·한쪽만 존재를 구별하며, 선택한 범위와 목적 맥락을 연결하는 원칙**까지다. A에서 새 계산 기능 추가·메뉴 삭제로 읽히면 B로 전환한다는 것은 후속 시안의 읽기 관찰 기준이며 이미 관측한 결과가 아니다. 기존 helper·두 호출이 부모에도 있었다는 사실, 실제 동작/CI/최종 수용 미확인은 계속 유지한다.

