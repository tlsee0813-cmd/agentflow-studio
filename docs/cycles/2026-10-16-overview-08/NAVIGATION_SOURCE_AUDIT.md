# cycle08 탐색 원문 감사

2026-10-16. 보조 정적 감사와 root 직접 관측을 구분한다.

[Node Search](https://reactflow.dev/ui/components/node-search)는 기본 **선택+해당 노드 맞춤**과 재정의 가능성을 명시한다. 배율·선택 보존은 별도다.

[SaveRestore](https://reactflow.dev/examples/interaction/save-and-restore)는 toObject/로컬 nodes·edges 저장과 diagram 복원을 설명한다. 보조 추출은 iframe·CSS뿐이었다.

[고정 helper](https://github.com/xyflow/xyflow/blob/3d35b57317576b0916c0bfeaaedd573aaacc2839/packages/react/src/hooks/useViewportHelper.ts)는 실존한다. setViewport는 x/y/zoom을 전달하며 생략값은 현재값, setCenter는 store 위임이다. **fitView는 이 파일에 없다.**

[Viewport API](https://reactflow.dev/api-reference/types/react-flow-instance#viewport)에서 fitView는 기본 전체 노드 맞춤(nodes 옵션 가능), setCenter는 위치 중심 이동(zoom 옵션), setViewport는 시야 설정이다. 고정 구현 보장은 아니다.

**root 보강:** 같은 SaveRestore에서 save→add→restore로 DOM 노드 2→3→2와 복원 후 두 노드·선1을 확인했다. App.jsx 탭도 직접 읽어 저장 toObject→localStorage, 복원 setNodes·setEdges·setViewport 호출을 확인했다. **내용+시야 복원 예제**이므로 우리 보기 복귀에 통째로 따를 수 없다. camera 수치·재로드 영속·전체 키보드·프로젝트 성공은 미검증, 화면은 root 도구 열람뿐 보관 PNG는 없다.

공식 문서 갱신일은 2026-10-11. 고정 코드·데모 배포 동일성은 미확인, 귀속 불명확 Pro 이미지는 제외한다. A 세 명령 공통/B 전체 맞춤만 공통·선택 위치/출발 보기는 문맥 배치 중 **B 추천은 우리 정책**이다. 보기만 복귀하고 내용은 복원하지 않으며, 선택·초점·읽기 위치 보존도 공식 보장이 아니다.

