# 33 · 이어가기 안내의 이전 작업 00 — 좁은 수정 후보

기준 제품은 `72940a043d7a7fdc225a9582ce48831fa0418cc0`이다. 고정 원본 app의 Git blob `8ee7ce15373ca309364e87a6277a59cddebd3e39`와 PC12 원본 blob `13939131fbd5be750fbacacf13d4c514daec4757`를 원격 tree 및 로컬 원문으로 대조했다. 원문 before와 최종 파일의 bytes/SHA/Git blob은 SOURCE_BINDING.json에 있다.

32 관측은 작업04에서 작업02를 명시적으로 이어간 뒤 이전 작업을00으로 안내한 실제 표시 오류다. `continueTask`가 commit 전 current 객체를 보관하는데, focusTask의 복제 뒤 새 tasks 배열에서 그 객체를 indexOf로 찾으면 -1이 된다. 이번 수정은 이 함수의 지역 no helper만 안정 task ID의 findIndex로 바꾼다. 다른 지역 번호 조회·current 정책·작업 네 값·도메인·스키마·행동 배치·출발점은 수정하지 않았다. 직접 관측이 아니라 기존 원자료 감사 `work/reentry32-notice-review/ROOT_FINDING.md`와 ACTION_EXCERPTS를 읽고 작성한 후보다.

기존 PC12 test02의 다른 작업04→01 전환에서 클릭 직후·편집 전에 대상01/이전04/00 부재를 확인하는 세 줄만 추가했다. 같은 그룹의 현재 보고02를 유지하는 기존 양성 단언과 비대상 보존·복귀·reload 검사는 그대로다. 세 줄 제거 시 검사 파일 전체가 원본 바이트로 복원된다. 제품도 lookup 한 곳을 되돌리면 app 전체가 원본 바이트로 복원된다. UI 결과를 실행했다고 주장하지 않는다.

Node24 작성자 보조와 기존 TypeScript5.8.3을 직접 재사용해 최종 타입·컴파일 빌드 exit0이다. 기존 CSS/HTML을 빌드 출력에 복사했고, Python AST와 정확 before에 대한 patch apply 확인도 exit0이다. 서버·브라우저·실제 AI·CI·원격 쓰기는 하지 않았다. 의존성 설치나 새 junction도 만들지 않았다. 실제 notice의 양 PC 검증은 Cloud/CI에서 별도로 해야 한다.

최초 최소 작업공간 준비에서 continuity/tsconfig가 상속하는 app/tsconfig가 누락돼 type-v0/build-v0가 실패했다. 원 exit/stdout/stderr는 보존했다. exact729의 parent config를 추가한 뒤 type-final/build-final을 별도 실행했으며 제품 오류로 분류하지 않는다. 공개 사본의 절대 workspace/runtime 경로만 표시 치환하고 원 로컬 로그를 보존한다. 소스·dist·dependencies는 근거 payload에 중복 포함하지 않는다.
