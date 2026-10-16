# session14 두 번째 제한 표본 — 실제 제품 배정·반환·코드 대응

**기존 C11 v1로 작은 손변환 fixture를 만들 수 있다.** `session14-product-map.json`은 5노드·기존 동작 연결 1개다. 새 렌더러·추출기·schema·제품 데이터 변경은 하지 않았다. 첫 QA 8사건을 덮거나 연속 사건으로 합치지 않는다.

## 자료와 대응

| 구분 | 확보 범위 | 이 입력에서의 취급 |
|---|---|---|
| 총괄 AI 배정 | [dbd034e 계약](https://github.com/tlsee0813-cmd/agentflow-studio/blob/dbd034e05e9679f588a7170eed230299ea216dd8/docs/cycles/2026-10-16-pc-map-space-13/IMPLEMENTATION.md). 동일 요구의 브라우저 전달은 총괄 확인 | 요청된 목적·범위. 나는 브라우저 원문을 재열람하지 않았으며 사람 원발화로 분류하지 않음 |
| 외부 작성자 반환 | [cc5a54ae REPORT](https://github.com/tlsee0813-cmd/agentflow-studio/blob/cc5a54ae067217c3abd1c8ef81b5b3034412e63b/docs/transfer/pc-map-space-13/author-v0/REPORT.md), 같은 위치의 6파일 diff | 작성자 실행·완료 주장과 고정 코드 차이의 출처를 분리 |
| 실제 코드 | 후보 `9aeb4599aa0060e2d43143c4f1150884d7bcc7b3` app.ts, 반환 diff의 styles.css | 사용자 대면 역할이 코드에 존재함을 정적으로 확인. 전체 도구 전사는 아님 |
| 독립 관측 | [709dab 독립 REPORT](https://github.com/tlsee0813-cmd/agentflow-studio/blob/709dab4d730c87b44e1a08a1cddd0cb9832b807a/docs/transfer/pc-map-space-13/independent-v0/REPORT.md) | 별도 근거로 연결. 이번 작업은 REPORT 독해이며 원시 전수 감사·재실행 아님 |

## 노드·관계의 의미

‘전체 공간 읽기’ 아래 **프로그램 목적 읽기 / 영역 지도와 선택상세 / 질문·보고 기록 읽기 / 영역 추가**를 두었다. 계약과 renderOverview/renderMap/checkSection/areaPanel에 실제 사용자 대면 기능이 있다. 따라서 첫 QA 표본의 검사 fixture·checker와 달리 프로그램의 일부를 설명할 수 있다. 다만 이 1+4 이름과 parent는 **AI가 제안한 보기 묶음**이다. 각 노드가 EV_GROUPING과 코드 근거를 갖고, 제품 Area.parent·확정 모듈 소속·유일한 정답 분할을 뜻하지 않음을 명시했다.

관계는 `영역 추가 → 영역 지도와 선택상세` 한 개다. 후보 app.ts 1103–1110행에서 명시 제출·addArea·새 영역 선택·렌더링이 연결됨을 확인했다. **기준 제품에도 있던 표시 연결**이며 새 변경이나 작업 실행 순서로 칠하지 않는다. 목적→지도·기록→지도 같은 추상 영향선을 추가하지 않았고, 파일·검사기·CI·세션은 노드에서 제외했다.

네 자식의 change는 고정 diff가 지지하는 표현 변경만 담는다. 루트에 변경을 복제하지 않는다. ‘코드가 바뀜’을 ‘완료’로 쓰지 않는다. 독립 보고의 지도 최소면적 PASS, 선택 카드 strict FAIL, 안내 있는1280의 확대·맞춤 첫화면 접근 실패를 각각 남겼다. 작성자 통과 수와 독립 관측을 합산하지 않는다.

## Q06/Q07의 얻은 것과 한계

- **실제 얻음:** 한정된 구현 배정에서 사용자 대면 역할을 찾아 고정 코드 변화 및 작성자/독립 보고로 연결할 수 있다.
- **없음:** 전체 외부 AI 도구 전사, 실제 사람 원발화, 기록 자동 추출, 이 입력 작성 시점의 후보 수용·병합·공개 완료. 자기 프로젝트 표본 편향이 있다.
- **해석 제안:** 역할 이름·보기 포함·한 관계의 읽기용 명칭. 각 해석에 고정 근거와 limits를 붙였다.
- **형식에 담기 어려움:** 기존 v1은 요청→작성자 주장→독립 관측의 사건 순서와 판정 변경을 전용 필드로 보존하지 않는다. evidence type/summary/limits로 구분했지만 정식 사건 모델로 일반화하지 않는다. 실제 CODE/REPORT와 연구 fixture의 시점을 혼합하지 않도록 basisTime을 고정했다.

[기존 schema.md v1](https://github.com/tlsee0813-cmd/agentflow-studio/blob/6643323316daefbe10625484bb1727a2c6a54716/docs/transfer/shared-map-11/author-v0/app/schema.md)만 사용했다. 원문에 맞추는 데 필요한 설명을 기록했을 뿐 v1을 정리 담당의 강제 출력 규격으로 승격하지 않았다. 렌더러 실행·화면 검증은 총괄의 다음 단계다. 이 한 표본은 제한된 보기 분할의 가능성을 지지하지만 제품 parent 모델 결정의 충분조건은 아니다.
