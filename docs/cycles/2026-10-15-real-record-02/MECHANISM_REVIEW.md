# 기존 메커니즘 비교 — 두 Pro 연구와 총괄 후보

2026-10-16 · 연구 회수 · 공식 원문 독립 대조 후 비교 시안 범위 결정

## 무엇을 찾았는가

현재 시안의 모양이나 검사 기록에 맞춰 좋은 해결책의 범위를 줄이지 않기 위해 공간·탐색과 기록·근거 읽기를 별도 Pro 세션에 배정했다. 두 세션은 제품 방향과 같은 동결 입력을 읽고 공식 문서·고정 공개 코드를 비교했다. 실제 사이트 조작이나 사람 사용성 검증은 수행하지 않았다. 조사 도중 검토하다 최종 비교에서 제외한 서비스까지 확인 사례로 세지 않는다.

- [공간·탐색 Pro](https://chatgpt.com/c/6ad0ec2b-71b8-83ec-8e3a-798f622b57dc): Dify·Cytoscape 확장·VS Code 3사례, 전체 지도와 옆 읽기 / 분리 집중의 경쟁 후보.
- [기록·근거 Pro](https://chatgpt.com/c/6ad0ec53-18e8-83ee-80c6-7b95b2dc8239): Hypothesis·Zotero·Langfuse·Dify 4사례, 판단 본문과 인용 / 중립 대조면의 경쟁 후보.

| 원래 해결한 문제 | 확인한 메커니즘과 AgentFlow에 가져올 가설 | 가져오면 의미가 달라지는 부분 |
|---|---|---|
| Dify의 워크플로 선택·실행 상세 | 선택한 대상과 관련 연결을 강조하고 요약·입력·실행 근거를 나누어 읽기 | 실행 성공은 구성 완성·주장 검증이 아님. 실행 컨테이너의 의미와 서로 다른 부모 사이 연결 제한을 프로그램 구성에 이식하지 않음 |
| Cytoscape 확장의 compound graph 접기 | 접힌 화면의 대표 끝점과 원래 실제 끝점을 구분해 보관·복원. 영역별 펼침 상태 유지 | 화면상 집약된 A–B를 새 실제 관계로 보거나, 상위 관계를 모든 자식에 복제하지 않음. 선택·좌표·배율 보존은 별도 검증 |
| VS Code의 Peek·References | 현재 위치에서 잠깐 읽기와 그 대상으로 실제 이동을 구분. 같은 원본 URI를 참조 | 초점이 돌아오는 것과 지도 선택·펼침·위치가 복원되는 것은 다름. 파일·함수 트리를 프로그램 목적의 정답으로 삼지 않음 |
| Zotero의 메모 속 인용 | 판단 문장에 연결된 근거를 해당 위치에서 읽고 원문 위치 열기와 자료 항목 열기를 구분 | 인용 존재가 해석의 독립 검증은 아님. 정확한 출발 문장·위치로 돌아오는 계약은 AgentFlow에서 별도로 검증 |
| Hypothesis의 원문·주석 연결 | 어떤 문장에 어떤 설명이 연결됐는지 드러내고 불필요한 원문 이동을 줄이기 | 원문 연결 상실을 주장의 철회로 표현하지 않음. 작성자 설명과 독립 관측을 같은 증거 수준으로 평탄화하지 않음 |
| Langfuse의 대응 항목 비교·Peek | 비교 대상을 맞춘 행에서 근거를 읽고 항목 이동 중 필요한 맥락을 보존 | baseline/candidate를 자료별 이름의 이전/현재로 바꾸지 않음. 다른 검사 범위를 동등한 측정으로 맞추거나 실행 없음을 실패로 처리하지 않음 |

이 표는 제품 또는 라이브러리 채택표가 아니다. Cytoscape 확장의 지정 README에는 유지보수 중단이 명시돼 있다. 코드 사용 조건·의존성·통합 비용은 메커니즘 참고와 다른 판단이다. Dify·Zotero·Hypothesis·Langfuse의 모든 코드를 같은 사용 조건으로 취급하지 않는다.

독립 대조에서 해석 범위를 좁혔다. Dify 패널의 Escape는 초점을 돌린 뒤 선택과 관련 간선 강조를 해제하므로 선택 보존의 근거가 아니다. Cytoscape는 원래 끝점 정보를 남기면서 현재 간선 끝점을 옮기며, 중첩 접힘에서는 보이는 조상까지 조건부 복구한다. VS Code의 초점 복귀도 지도 전체 상태 복원과 다르다. Langfuse에서 닫을 때 초기화하는 범위는 내부 표의 필터·정렬·페이지·검색 문맥이며 모든 보기 상태가 아니다. Hypothesis 내부 링크·버튼 처리는 카드의 추가 이동을 막을 뿐 해당 링크 자체의 이동까지 금지하지 않는다. Zotero의 원문 위치 전달은 정확한 출발 스크롤 복귀를 증명하지 않는다.

## 총괄의 조건부 선택

이전의 ‘확인할 부분 목록＋선택 근거’는 개입 지점을 드러내는 가설이었지만, 목록이 모두 사용자의 숙제나 배정으로 읽힐 수 있다. 새 연구는 이 후보를 고수할 이유를 약하게 했다. 다음 작은 비교는 아래 **두 읽기 표현**으로 좁힌다. 기존 목록안은 기록으로 보존하고 세 안을 동시에 개발하지 않는다.

- **가: 판단 본문과 문장별 근거.** 프로젝트·선택 대상의 짧은 맥락 다음에 확인된 내용과 아직 모르는 내용을 함께 서술한다. 근거를 열어도 출발 문장과 그 문장이 말하는 범위가 남는다. 유창한 요약이 원자료보다 더 확실한 사실처럼 읽히거나 반대 자료가 묻히면 실패다.
- **나: 자료·관측 범위를 맞춘 중립 대조.** 자료 이름과 검사 범위를 주어로 두고 같은 범위만 비교한다. 셀의 근거를 읽어도 행의 질문·비교 상대가 남는다. 열의 순서를 시간 순서로 읽거나 빈칸을 실패로 읽고, 다른 범위를 같은 측정으로 착각하면 실패다.

공간 배치는 처음에는 두 안에서 같게 둔다. 전체 맥락을 유지한 읽기 공간에서 제자리 근거 미리보기와 실제 대상 이동을 구분한다. 이름·소유·실제 관계·반영 범위·출발 위치를 보존한다. 화면이 좁거나 긴 기록에서 본문과 관계가 서로를 가려 반복 왕복을 요구하면 전용 집중 공간을 후속 후보로 다시 비교한다. 두 축을 한꺼번에 바꾸어 정보 표현과 공간 배치 중 무엇이 영향을 주었는지 알 수 없게 만들지 않는다.

[전체 제품 목적 대조](PRODUCT_LENS.md)의 대상 이해·불필요한 사용자 개입 방지·판단과 복귀를 함께 평가한다. 제품이 검사 보고서 열람기로 좁아지지 않도록 구성부분·작업·세션·근거를 구분하며, 표본에 없는 프로젝트 목적이나 실제 인계 성공을 채우지 않는다.

Pro가 제안한 세 안·6명·고정 중단 횟수는 이번 실행 조건으로 채택하지 않았다. 실제 표본에 양립 불가능한 주장이 확인되지 않았으므로 이름 차이와 검사 범위 차이를 억지로 ‘상충’으로 만들지 않는다. 별도 합성 충돌 표본은 이후 그 질문이 필요할 때 명시적으로 추가할 수 있다. [읽기 관찰표](READING_TRIAL.md)는 사전 설계이며 아직 실행 결과가 아니다.

## 고정 근거와 독립 대조

공간·탐색은 [독립 코드 대조](SPATIAL_SOURCE_REVIEW.md), 근거 읽기와 후보 반박은 [독립 원문 대조](EVIDENCE_SOURCE_REVIEW.md)를 함께 읽는다. 원문에 있는 동작, 총괄의 적용 가설, 아직 확인하지 않은 복귀·사용성 보장은 구별한다.

- Dify `f7840ab2134bbc0b34ca4a58a47381fbbf2d1e35`: [선택·연결](https://github.com/langgenius/dify/blob/f7840ab2134bbc0b34ca4a58a47381fbbf2d1e35/web/app/components/workflow/hooks/use-nodes-interactions.ts), [패널](https://github.com/langgenius/dify/blob/f7840ab2134bbc0b34ca4a58a47381fbbf2d1e35/web/app/components/workflow/nodes/_base/components/workflow-panel/index.tsx), [Run History](https://docs.dify.ai/en/cloud/use-dify/debug/history-and-logs).
- Cytoscape 확장 `e01588bec1f31c76046faa6fb681eee37b78334e`: [README](https://github.com/iVis-at-Bilkent/cytoscape.js-expand-collapse/blob/e01588bec1f31c76046faa6fb681eee37b78334e/README.md), [접기·복원 코드](https://github.com/iVis-at-Bilkent/cytoscape.js-expand-collapse/blob/e01588bec1f31c76046faa6fb681eee37b78334e/src/expandCollapseUtilities.js).
- VS Code `f20a64b96be4f2b10d7cd2703efb2fc85afaac18`: [Peek 컨트롤러](https://github.com/microsoft/vscode/blob/f20a64b96be4f2b10d7cd2703efb2fc85afaac18/src/vs/editor/contrib/gotoSymbol/browser/peek/referencesController.ts), [참조 위젯](https://github.com/microsoft/vscode/blob/f20a64b96be4f2b10d7cd2703efb2fc85afaac18/src/vs/editor/contrib/gotoSymbol/browser/peek/referencesWidget.ts).
- Hypothesis `57a5dc18712922cc08a1cfa5aa146b6c88d7f8df`: [ThreadCard](https://github.com/hypothesis/client/blob/57a5dc18712922cc08a1cfa5aa146b6c88d7f8df/src/sidebar/components/ThreadCard.tsx), [Annotation Basics](https://web.hypothes.is/help/annotation-basics/), [연결 상실](https://web.hypothes.is/help/what-are-unanchored-annotations/).
- Zotero note-editor `7439a18414ffa6e90918283da9e4dbd35fce1a97`: [원문 열기](https://github.com/zotero/note-editor/blob/7439a18414ffa6e90918283da9e4dbd35fce1a97/src/index.web.js), [Reader/Notes 설명](https://www.zotero.org/support/pdf_reader).
- Langfuse `abc652fcfb7ff55fe4bc696292db157182819e19`: [Peek 상태 계약](https://github.com/langfuse/langfuse/blob/abc652fcfb7ff55fe4bc696292db157182819e19/web/src/components/table/peek/README.md), [실행 항목 상세](https://github.com/langfuse/langfuse/blob/abc652fcfb7ff55fe4bc696292db157182819e19/web/src/components/table/peek/peek-experiment-item-detail.tsx), [Compare View](https://langfuse.com/changelog/2025-11-06-compare-view-baseline-support).
