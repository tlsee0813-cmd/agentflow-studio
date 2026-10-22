# 재개17 — 최신 메커니즘 조사와 총괄 선택

2026-10-22 조사 시점의 판단이다. 현재 진행 상태는 [ACTIVE](../ACTIVE.md)에만 갱신한다. 제품 소스 기준은 a0f0ae786c580a8919cede07db48d4397b58b114이며, checkpoint e2bfbe206e2ee20a8c5a6cee0e9fcffb182c1dc4까지 제품 소스 차이는 없다. 이 문서는 구현 완료나 자동 의미 정리의 품질 수용이 아니다.

## 전체 흐름에 대한 판단

다음 경험을 한 단위로 삼는다: **새 정보가 같은 구성부분에 도착 → 현재 이해가 발전 → 전체에서 변화 위치 확인 → 한 부분 이해·조정·다음 요청 → 원래 전체로 복귀**.

웹 Pro A는 사용자 구상과 분리된 파생 현재 설명을 먼저, Pro B는 혼합 깊이와 접힌 경계 관계를 먼저 권했다. 총괄은 A를 이번 핵심으로 선택했다. 현재 보고 읽기는 사용자가 새 기록과 기존 구상을 직접 조합해야 하는 상태다. 이 접점을 먼저 연결해야 지도가 자라나는 경험을 확인할 수 있다. B의 부분별 펼침·실제 관계 끝점·줌과 상세 수준 분리는 유지할 후속 과제다. 현재 평면 Area를 최종 구성 모델로 확정하지 않는다.

Astra High의 독립 비판은 전체 흐름을 실험의 틀로 삼되, 이번 신규 변화는 같은 부분 갱신으로 좁히라는 것이었다. Sol High 감사에서도 Area.note의 유일한 갱신은 수동 editArea이며 Task.parentTaskId는 구성 포함이 아닌 작업 연속성임을 확인했다. 기존 홈·지도·영역 ID·원문·명시 보고 읽기·입력 보호·복귀는 재사용한다.

## 조사 역할과 관측 수준

- [웹 Pro A — 갱신 메커니즘](https://chatgpt.com/c/6ad9c309-fda4-83e8-926f-4dc46764478f): 새 세션, 공식 문서·공개 소스 비교. 외부 제품 실제 조작은 수행하지 않았다고 명시.
- [웹 Pro B — 구성 지도](https://chatgpt.com/c/6ad9c351-fcc0-83ec-85df-2c05238dc84e): 별도 새 세션, 공식 문서·공개 소스 비교. 이번 동적 데모 직접 조작 없음.
- 총괄은 아래 Aider·Notion·Dolt·React Flow·Cytoscape 원문을 다시 확인했다. Pro가 제시한 릴리스 번호는 이번 도입 판단에 필요하지 않아 최신 버전 확정값으로 옮기지 않았다.
- 총괄의 10월22일 Dify 실제 조작: 기존 workflow에서 User Input 선택 → Output 선택 → 닫기. 400px 단일 패널이 교체되고 배율 표시는 64%로 유지됐다. 버전 기록은 보기 전용/복원 비활성/해당 기록 없음 상태를 확인하고 종료했다. 실제 버전 복원·비교는 시험하지 않았다. 자동 저장 시각이 바뀌었으므로 모델 전체 불변을 입증했다고 쓰지 않는다.
- Dify 비교와 AI 역할 평가는 사람 대상 사용성 연구가 아니다. 사용자의 현재 평가 기준을 따른 사전 제품 비교다.

## 가져올 메커니즘과 제외할 것

| 참고 | 확인한 메커니즘 | AgentFlow에 적용할 판단 | 이번에 제외 |
|---|---|---|---|
| [Aider Git integration](https://aider.chat/docs/git.html) | 기존 사용자 변경과 AI 변경을 분리해 남기고 차이·되돌리기 제공 | 사용자 구상과 파생 설명을 같은 마지막 문자열로 합치지 않음 | 문장마다 Git 커밋, 개발 도구 용어 노출 |
| [Notion Autofill](https://www.notion.com/help/autofill) | 페이지 내용에서 별도 속성을 정리하며 생성·수정 시 실행 가능 | 원문과 현재 읽기용 설명을 분리, 입력 범위를 명시 | 요약을 사용자 결정으로 취급, 모든 부분에 재검증 업무 부과 |
| [Dolt JSON merge, 2024년 글](https://www.dolthub.com/blog/2024-01-16-announcing-json-merge/) | 다른 key의 변경과 같은 key의 충돌을 구별하며 rename은 삭제·추가로 해석 | 하나의 상충 내용 때문에 무관한 구체화까지 모두 승인 대기로 보내지 않음 | JSON 병합이 자연어 의미 충돌을 해결한다는 가정, DB 도입 |
| [React Flow Sub Flows](https://reactflow.dev/learn/layouting/sub-flows) | parentId는 상대 좌표·그룹 이동과 외부 연결을 지원 | 포함 관계·보기 상태·관계 끝점을 분리할 참고 | 라이브러리 parent가 제품 의미 모델의 정답이라는 가정, 즉시 엔진 교체 |
| [Cytoscape expand-collapse](https://github.com/iVis-at-Bilkent/cytoscape.js-expand-collapse) | compound graph의 부분 접기·펼침. README에 유지보수 중단 명시 | 동작 아이디어 참고, 신규 의존성 채택 후보에서 제외 | 유지 상태 확인 없이 확장을 바로 도입 |
| [yFiles folding 예시](https://www.yfiles.com/demos/application-features/folding-with-merged-edges/) | Pro B의 문서 관측: 접힌 그룹의 관계 집약 | 후속 계층에서 집약선과 실제 끝점 구별 | 상용 엔진 도입 결정, 직접 조작/성능 검증 주장 |
| [Dify 버전 관리](https://docs.dify.ai/en/cloud/use-dify/build/version-control) | 초안·게시·과거 버전을 분리한 작업 흐름 | 기본 화면은 현재, 이력은 필요할 때 읽기 | AgentFlow의 모든 자동 정리에 게시/승인 관문 적용 |

OpenRefine의 이름과 대상 분리, Wikibase의 출처 있는 복수 주장 보존도 Pro A의 보조 비교다. 이번에는 기존 stable Area ID와 보고 소속을 사용할 수 있으므로 별칭·범용 엔터티 판별이나 지식베이스 엔진을 개발하지 않는다.

## Pro 답변에서 수정한 판단

1. **evidence 타입은 앱의 직접 검증이 아니다.** 현재 SOURCE_LABEL은 사용자가 가져온 검사 자료도 앱 미검증이라고 규정한다. 입력 성격과 사실 검증 권위를 합치지 않는다.
2. **자동 해석에 일괄 채택을 요구하지 않는다.** 사용자 목적을 바꾸자는 추천과, 전달 기록을 현재 이해로 설명하는 자동 해석을 나눈다. 후자는 정리 전제 아래 자동 반영할 수 있다.
3. **배지 숫자·식별자·검사 수를 기본 정보로 늘리지 않는다.** 짧은 현재 설명·중요한 변화·필요한 판단을 먼저, 원문·이전 상태·출처는 펼쳐 읽게 한다.
4. **지난 방문 이후라고 부르지 않는다.** 열람 추적 없이 실험 전후 또는 직전 정리 대비 변화만 설명한다.
5. **의미 충돌 검출과 저장 보호는 다르다.** 이번에는 소속과 의미가 정리된 입력을 받는 전제다. 제품이 대상·기준 상태·중복·사용자 값 보존을 보장하는 것과 정리 담당이 문맥을 올바르게 해석하는 것은 별도로 평가한다.

## 표본과 한계

두 기존 기록을 재사용하되 원문 성격을 보존한다.

- PowerToys 공개 리뷰 → 고정 수정: [검색 요구](https://github.com/microsoft/PowerToys/pull/51150#discussion_r4255501266), [녹화 요구](https://github.com/microsoft/PowerToys/pull/51150#discussion_r4255501287), [a964 수정](https://github.com/microsoft/PowerToys/commit/a964f08cc6fbecb3b9f9d4fe6c1d7481330c7938), [이미 고정한 입력](https://github.com/tlsee0813-cmd/agentflow-studio/blob/6643323316daefbe10625484bb1727a2c6a54716/docs/transfer/shared-map-11/author-v0/app/fixtures/powertoys.json). 검색·선택과 녹화 종료 판정은 다른 부분이며 공통 훅은 공유 부분이다. 작성자 회신/코드 수정은 독립 실행 완료의 증거가 아니다.
- 제품13 총괄 AI 배정 → v0 → fix1: [배정](https://github.com/tlsee0813-cmd/agentflow-studio/blob/dbd034e05e9679f588a7170eed230299ea216dd8/docs/cycles/2026-10-16-pc-map-space-13/IMPLEMENTATION.md#L22), [v0 입력](https://github.com/tlsee0813-cmd/agentflow-studio/blob/e8b28f5e85ae8319f4a4689678110c28e224bcfd/docs/transfer/session-input-14/product-v0/session14-product-map.json), [fix1 입력](https://github.com/tlsee0813-cmd/agentflow-studio/blob/c562d86769fcf4ac3652e8a6b876c07a554a96be/docs/transfer/session-input-14/product-fix1/session14-product-map-fix1.json). 사람 원발화가 아닌 AI 배정이며 내부 제품 개발 표본이라는 편향을 남긴다.

두 자료에는 사용자 의도와 반대인 실제 외부 주장이 확보되지 않았다. “정상 key-up까지 모두 무시한다”, “목적과 안내를 숨긴다” 같은 반례는 **명시적인 합성 경계**로만 사용한다. 실제 기록의 조건과 양립하는 구체화, 별도 합성 충돌을 섞어 실제 발언으로 귀속하지 않는다. 코드 이전의 짧은 구상으로 재서술하더라도 이는 분석자의 표본 구성이지 실제 최초 사용자 대화가 아니다.

## 다음 구현 판단의 경계

기존 보고 수신 한 번에 대응된 정리 정보를 연결할 수 있는 최소 확장을 Opus에 설계 요청했다. 별도 수동 관리 화면이나 두 번 가져오기를 기본 절차로 추가하지 않는다. 저장 필드가 필요하면 이전 자료를 소급 생성하지 않는 명시적 migration을 검토한다. 새 AI/provider, 연결기, 범용 충돌 엔진, 계층 제품화, 실시간 다중 탭 갱신은 이번 범위에 묶지 않는다.

제품 반영 여부는 실제 입력 경로·저장/복구·사용자 정정·지도 복귀를 독립 실행한 뒤 판단한다. 화면이 새 보고를 나열하는 데 그치거나 사용자가 현재 설명을 다시 작성해야 끝난다면 이번 가설을 통과한 것으로 보지 않는다.
