# af-map-readable-delta-20261024

## 결론

**다음 기본 보기의 실험 후보는 B를 권합니다.** 사용자가 펼쳐 둔 혼합 깊이·배치·관계를 유지하면서, 저배율에서는 **이름과 읽을 이유를 별도 크기로 표시**하는 방향입니다. 확대율에 따라 카드의 표현만 바꾸고, 하위 구조를 자동으로 접거나 펼치지는 않습니다.

이 선택은 **가독성이 개선됐다는 판정이 아니라, 다음에 검증할 가설**입니다. 읽을 크기로 보정한 라벨이 겹치거나 긴 이름의 구별 부분을 가리면 B는 실패입니다. 그때의 대안은 **기억된 시야가 없는 첫 진입에 한정한 A, 최상위 접힘+100%**입니다.

**확인일: 2026-10-24 KST. 공개 문서·코드 조사이며, 이번에 실제 화면 조작·사람시험은 하지 않았습니다.**

## 현재 제약 확인

지정 checkpoint의 [인계 문서](https://github.com/tlsee0813-cmd/agentflow-studio/blob/4a9873a5a78fe1cfe48646fc912796025b639440/docs/COORDINATOR_HANDOFF_2026-10-24_KO.md)와 두 후보의 관련 코드를 확인했습니다.

36fix2에서 **180px은 카드 높이이며 폭은 240px**입니다. 이름은 15px, 읽을 이유는 11px이고, 지도 평면 전체에 `scale()`이 적용됩니다. 따라서 줄바꿈을 고쳐도 축소에 따른 글자 크기 문제는 남습니다. [카드 CSS](https://github.com/tlsee0813-cmd/agentflow-studio/blob/38beb55922e3e982f0f32fddacd5e18a5e157a15/app/continuity/public/styles.css#L2577-L2599) · [지도 배율 적용](https://github.com/tlsee0813-cmd/agentflow-studio/blob/38beb55922e3e982f0f32fddacd5e18a5e157a15/app/continuity/src/client/app.ts#L1337-L1372)

37 [작성자 보고](https://github.com/tlsee0813-cmd/agentflow-studio/blob/20bffe5fe33f11b29870a9025d2ac0089837abfb/docs/cycles/2026-10-23-project-entry-37/AUTHOR.md)는 1280에서 기본 맞춤 78%를 기록했습니다. 이를 위 글자 크기에 적용하면 이름은 **11.7px**, 이유는 **약 8.6px**가 됩니다. 이는 코드와 작성자 기록을 이용한 계산이며, 이번 세션의 실측은 아닙니다.

또한 [맞춤 함수](https://github.com/tlsee0813-cmd/agentflow-studio/blob/38beb55922e3e982f0f32fddacd5e18a5e157a15/app/continuity/src/client/presentation.ts#L100-L108)는 필요한 만큼 배율을 낮춥니다. **유한한 화면에서 임의 규모의 전체 구조와 모든 이름을 동시에 읽게 하는 것은 보장할 수 없습니다.** B에도 적용 범위와 실패 기준이 필요합니다.

## 공식 메커니즘 비교와 출처

Dify와 추가 공개 프로젝트 두 개, React Flow·tldraw로 한정했습니다. 아래 코드 링크는 확인한 SHA에 고정되어 있습니다.

| 대상 | 확인한 작동 원리 | 이번 판단에 주는 근거와 한계 |
|---|---|---|
| **Dify** — `2b35144b2098f8f6ad6af31bf72356a42f813d58` | [캔버스](https://github.com/langgenius/dify/blob/2b35144b2098f8f6ad6af31bf72356a42f813d58/web/app/components/workflow/index.tsx#L780-L797)는 전달된 viewport를 사용하고, viewport가 없을 때만 초기 fit을 수행합니다. [배율 훅](https://github.com/langgenius/dify/blob/2b35144b2098f8f6ad6af31bf72356a42f813d58/web/app/components/workflow/hooks/use-workflow-control-scale.ts#L5-L26)은 `max(1,1/zoom)`을 계산하여 [노드 조작부](https://github.com/langgenius/dify/blob/2b35144b2098f8f6ad6af31bf72356a42f813d58/web/app/components/workflow/nodes/_base/components/node-control.tsx#L26-L40)에 적용합니다. | **전체맞춤과 제공된 시야를 분리**하고, 필요한 조작부는 축소와 별도로 크기를 보전합니다. 다만 [기본 제목](https://github.com/langgenius/dify/blob/2b35144b2098f8f6ad6af31bf72356a42f813d58/web/app/components/workflow/nodes/_base/node.tsx#L244-L253)은 여전히 `truncate`입니다. 이름·이유 가독성까지 해결한 사례로 확대할 수 없습니다. |
| **React Flow** — 현행 공식 문서, 표시 갱신일 2026-10-11 | [Contextual Zoom](https://reactflow.dev/examples/interaction/contextual-zoom)은 `useStore`로 확대율을 읽어 사용자 정의 노드의 표시 내용을 바꿉니다. [Viewport 설정](https://reactflow.dev/api-reference/react-flow#viewport-props)은 초기 `fitView`를 켜면 `defaultViewport`가 무시된다고 명시합니다. | **구조의 접힘과 표시 내용 전환을 분리**하는 B의 근거입니다. 내용 몇 줄을 없애는 것만으로 화면 글자 크기가 커지지는 않습니다. A 역시 자동 fit을 켠 채 100%만 지정해서 구현되는 정책은 아닙니다. [React Flow](https://reactflow.dev/examples/interaction/contextual-zoom?utm_source=chatgpt.com) |
| **tldraw** — `12921f6d3996b4330688113371cd88890b673ab5` | [FrameHeading](https://github.com/tldraw/tldraw/blob/12921f6d3996b4330688113371cd88890b673ab5/packages/tldraw/src/lib/shapes/frame/components/FrameHeading.tsx#L60-L70)은 이름 라벨에 역배율을 적용합니다. [CSS](https://github.com/tldraw/tldraw/blob/12921f6d3996b4330688113371cd88890b673ab5/packages/editor/editor.css#L138)의 `1/zoom`을 쓰되 보정은 3.5배까지입니다. | **구조는 축소하면서 이름의 화면 크기를 유지하는 직접적인 B 근거**입니다. 그러나 보정 상한 때문에 약 28.6% 아래에서는 이름도 다시 작아지고, 라벨 폭 제한·잘림도 있습니다. 긴 이름과 라벨 충돌까지 해결해 주지는 않습니다. |

Dify 공식 문서도 [전체맞춤·100%·노드 정리](https://docs.dify.ai/en/cloud/use-dify/build/shortcut-key#zoom-and-layout)를 별도 동작으로 둡니다. 따라서 읽기 배율, 전체 조망, 배치 변경을 한 동작으로 묶을 필요는 없습니다. [Dify Docs](https://docs.dify.ai/en/cloud/use-dify/build/shortcut-key?utm_source=chatgpt.com)

**목적 차이:** Dify의 실행 노드 상태를 AgentFlow의 ‘읽을 이유’로 가져오면 안 됩니다. 여기서 옮길 근거는 시야 정책과 표현 방식입니다. AgentFlow에서는 구성부분의 이름·포함 관계·실제 질문이나 설명 보류가 중심이며, 구성부분·작업·세션의 종류 구분은 그대로 유지합니다.

## 두 후보의 반례

다음은 코드에서 확인한 기능을 바탕으로 한 **설계 반례**입니다.

| 조건 | A: 최상위 접힘+100% | B: 구조 유지+저배율 표현 전환 |
|---|---|---|
| **혼합 깊이** | A만 여섯 하위와 손자가 있고 B는 미분화라면, 일괄 접힘은 두 영역의 상세화 차이를 감춥니다. 최상위가 많거나 멀리 떨어져 있으면 100%에서도 모두 들어오지 않습니다. | 모든 노드를 비슷한 이름 표지로 바꾸면 부모·자식이 동급으로 보일 수 있습니다. 포함 경계나 소속 단서가 계속 보여야 합니다. |
| **긴 같은 접두어 이름** | 100%여도 고정 폭과 줄 제한 때문에 끝의 ‘고객 취소/운영자 취소’만 잘릴 수 있습니다. 배율 변경만으로 해결되지 않습니다. | 역배율로 커진 글자가 좁아진 화면상 카드 폭을 넘거나 이웃 이름과 겹칠 수 있습니다. 공통 접두어만 남기는 말줄임은 실패입니다. |
| **접힌 하위 미결** | 부모 이름만 보여 주면 안쪽의 현재 질문을 놓칩니다. 하위에 읽을 이유가 있다는 단서와 실제 소유 부분 접근이 필요합니다. | ‘이번 탭 설명 갱신’ 하나만 남기고 현재 질문을 숨기면 중요성이 뒤집힙니다. **후속 작업문 없는 보고를 미답 질문으로 바꾸어 보충해서도 안 됩니다.** |
| **관계 끝점** | 접힌 부모 사이의 선을 실제 부모 관계로 오해할 수 있고, 같은 부모 내부 관계는 사라져 보일 수 있습니다. | 커진 라벨이 선의 끝을 덮거나 축소된 연결 지점을 잘못 누르게 할 수 있습니다. 선과 라벨 모두 실제 대상에 도달해야 합니다. |
| **기억한 시야 복귀** | 재진입마다 접힘·100%를 적용하면 사용자가 펼친 깊이와 시야가 지워집니다. | 표현 전환으로 카드 경계를 다시 측정하고 자동 fit을 반복하면 위치·배율이 튈 수 있습니다. 카메라 값이 같아도 지도 가용 높이가 달라져 카드가 가리면 복귀 실패입니다. |

현재 코드는 이미 [접힌 관계의 실제 끝점](https://github.com/tlsee0813-cmd/agentflow-studio/blob/38beb55922e3e982f0f32fddacd5e18a5e157a15/app/continuity/src/shared/hierarchy.ts#L15-L29)과 [하위의 질문·설명 신호](https://github.com/tlsee0813-cmd/agentflow-studio/blob/38beb55922e3e982f0f32fddacd5e18a5e157a15/app/continuity/src/shared/attention.ts#L66-L100)를 구분합니다. 다음 후보는 이 의미를 표시 단계에서 유지해야 합니다.

## 추천하는 실제 화면 실험 한 건

**36/37 통합 완료 후 고정된 SHA에서, 1280×720의 같은 혼합 깊이 장면을 현행과 B로 비교하는 실험**을 권합니다.

장면에는 한쪽만 깊게 펼친 구조, 긴 공통 접두어 이름 두 개, 접힌 하위의 실제 현재 질문, 그 하위를 끝점으로 갖는 관계, 별도 미전송 초안을 함께 둡니다. 추가 데이터가 필요하면 합성 검증값임을 표시합니다.

B는 저배율에서 이름·짧은 읽을 이유 중심으로 표시하고, 통상 배율에서는 기존 카드 내용을 보여 줍니다. **구조 깊이와 저장 위치는 확대율 때문에 바뀌지 않습니다.** 시작값으로 화면상 이름 15px·이유 13px를 시험할 수 있지만, 이는 이번 후보의 설정값이며 검증된 사용성 기준은 아닙니다.

한 장면에서 **첫 보기 → 실제 관계 끝점 열기 → 출발 보기 복귀**를 확인합니다.

- **첫 보기:** 확대·호버 없이 긴 이름 두 개의 구별 부분과 읽을 이유가 보이고, 이름·이유가 잘리거나 다른 대상의 이름·끝점을 가리지 않는가.
- **읽기와 복귀:** 접힌 하위 질문의 소유 부분과 실제 관계 끝점에 도달하며, 복귀 후 접힘·선택·시야와 실제 카드 노출이 유지되는가.
- **보존:** 사용자 초안이 그대로인가. 화면이 더 읽혀도 이 조건이 깨지면 탈락입니다.

## 미확인과 총괄 결정안

**미확인:** 최종 36/37 통합 화면, B의 실제 충돌 밀도, 운영체제별 글꼴 차이, 사람의 식별 속도는 확인하지 않았습니다. Dify·tldraw는 확인한 공개 main 소스이며 서비스 배포 상태까지 판정하지 않았습니다. React Flow는 공식 문서를 확인했고 해당 예제의 고정 소스 SHA는 확보하지 않았습니다.

**총괄 결정안은 ‘B 단일 화면 실험 우선, 기본값 확정은 보류’입니다.** B가 위 장면에서 읽을 크기와 공간을 함께 확보하지 못하면, **A를 기억된 시야가 없는 첫 진입의 대안**으로 선택합니다. A에서도 하위의 읽을 이유와 실제 관계 끝점 접근을 남기고, 재방문에는 사용자가 기억한 접힘과 시야를 우선합니다.

7m27s · GPT-6[browser] · ↑551 ↓1.61k ↻0 Δ2.16k