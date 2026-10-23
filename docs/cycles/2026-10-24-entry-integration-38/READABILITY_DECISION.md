# 기본 지도 가독성 — 조사 결과의 적용 경계

2026-10-24 KST. [Pro 원문](PRO_READABILITY.md). Oracle `af-map-readable-delta-20261024` completed, submit/result exit0, 7분27초. 실제UI GPT-6·Pro 선택 증거. 공개 문서/소스 조사이며 실제 서비스 조작·사람 관측 아님.

총괄은 **구조와 접힘 기억을 유지하고 저배율 이름/이유 표현만 분리하는 B를 다음 단일 장면 실험 후보로 채택**한다. 제품 기본값 채택은 보류한다. 커진 글자가 이웃 이름·관계 끝점과 겹치면 실패이며, 이름 끝의 구별 부분을 지워 해결하지 않는다. 실패하면 기억된 시야 없는 첫 진입에만 최상위 접힘+1배율 A를 비교한다. 재방문 시야를 자동 초기화하지 않는다.

총괄의 원문 표본 대조:
- [Dify 배율 훅](https://github.com/langgenius/dify/blob/2b35144b2098f8f6ad6af31bf72356a42f813d58/web/app/components/workflow/hooks/use-workflow-control-scale.ts): max(1,1/zoom)으로 조작부 배율을 보전하는 코드 확인. 이름·이유까지 해결했다는 증거로 사용하지 않는다.
- [tldraw FrameHeading](https://github.com/tldraw/tldraw/blob/12921f6d3996b4330688113371cd88890b673ab5/packages/tldraw/src/lib/shapes/frame/components/FrameHeading.tsx): scale(min(var(--tl-scale),3.5))와 maxWidth/overflow 확인. 제한 없는 이름 보장 아님.
- [React Flow Contextual Zoom](https://reactflow.dev/examples/interaction/contextual-zoom): 확대율에 따른 표현 전환의 공식 사례. 구조 깊이와 줌을 같은 조작으로 만들지 않는 후보 근거.

180px은 카드 높이이고 폭은240px이라는 Pro의 정정을 반영한다. 기존36 실제1280 기본56% 작은 글씨와37 작성자78% 화면을 같은 배율로 혼동하지 않는다. 36/37의 복귀 결함 수정 및 정리v0의 좁은 관측을 먼저 끝내며 이 조사로 별도 큰 구현을 자동 개시하지 않는다. Q13 다음 실험 근거로만 축적한다.
