# cycle07 시간·출처 공식 문서 감사

관측일 2026-10-16(KST). 지정한 공식 문서 두 개만 정적으로 읽었다. 서비스 UI 조작·설정 확인·코드 실행·추가 조사·원격 변경은 없다. 고정 코드 SHA가 아닌 현재 문서 관측이다.

## Onshape: 과거 상태 읽기와 작업공간 변경

[Versions and History](https://cad.onshape.com/help/Content/Document/versions_and_history.htm)의 Creating a version·Context menu·Terms·Restoring a version을 대조했다. 페이지 표시 갱신일은 **2026-10-09**다.

- **지지:** Version은 특정 시점의 저장된 문서 상태이며 불변·읽기 전용이고 Workspace와 구별된다. Workspace는 모델링·설계 공간이다. 버전에서 분기하면 새 Workspace를 만들 수 있다. 과거 버전의 존재를 현재 Workspace 상태와 동일시하면 안 된다.
- **지지:** Open은 변경·버전·브랜치를 현재 탭에 열고, 별도 새 탭 명령도 있다. Compare는 이력 시점의 버전·Workspace를 비교한다. Merge into current workspace는 소스 변경을 현재 Workspace에 합치며, Restore는 이전 상태를 대상 Workspace에 반영한다. 메뉴 항목은 우클릭 대상에 따라 달라진다.
- **과장 교정:** Open/Compare와 Restore/Merge는 문서에 구별된 명령이다. 과거 상태를 읽었다고 복원·병합이 실행된 것은 아니다. 여기의 Restore를 우리 화면의 초점·선택·배율·읽기 스크롤 복귀와 같은 뜻으로 쓰면 안 된다. 모든 상태가 항상 보존되는 탐색 계약도 입증하지 않는다.

## GitHub: 조건부 승인 해제

[Reviewing proposed changes — Submitting your review](https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/reviewing-proposed-changes-in-a-pull-request#submitting-your-review)의 review 종류와 Tip을 대조했다. 관측 본문에는 별도 갱신일·고정 리비전이 표시되지 않았다.

- **정확한 조건:** 필수 리뷰와 오래된 리뷰 해제 설정이 **둘 다** 활성화된 상태에서, 승인된 PR의 브랜치에 **코드를 수정하는 커밋**이 push되면 그 승인이 해제되고 다시 리뷰·승인이 필요하다고 명시한다. 모든 저장소·모든 새 커밋에서 항상 일어나는 기본 동작으로 일반화하면 안 된다.
- **일반 댓글 무효화가 아님:** 문서는 Comment(명시적 승인/변경 요청 없는 피드백), Approve, Request changes를 구분한다. 위 해제 문장의 대상은 **승인**이다. 새 후속 요청이 생기면 과거의 일반 댓글·기록·관측 전체가 삭제되거나 사실성이 사라진다는 주장은 이 출처가 뒷받침하지 않는다. 반대로 모든 댓글의 의미가 이후에도 그대로 유효하다는 보장도 아니다.
- 승인·변경 요청의 병합 효과에는 설정·권한 조건이 따른다. 우리 시안의 ‘확인됨’을 GitHub 승인 또는 병합 허가로 옮겨 읽으면 안 된다. 이 문서는 일정 경과만으로 과거 기록을 만료시키는 규칙을 설명하지 않는다.

## 우리 시안에 가져올 범위

Pro의 **A: 1/16 확인된 patch 지도 + 1/21 후속 요청·2/1 종료 한 줄, 선택한 부분에서 상세 읽기**, **B: 후속 요청 우선 + 과거 patch 열기** 중 A 추천은 **우리 표시 정책 제안**이다. 이 날짜·사건은 두 공식 문서에서 검증한 데이터가 아니다. 가져올 근거는 ‘시점·대상별 상태 구별’과 ‘읽기·비교와 변경 명령 구별’까지다.

후속 요청만으로 과거 patch를 현재 구현·전체 무효·새 적용 완료로 바꾸지 않는다. 종료 한 줄도 대상 범위를 넘어 프로젝트 전체 종료를 뜻하게 만들면 안 된다. 선택·본문·지도 상태 보존과 상세 왕복 성공은 우리 구현에서 별도로 검증해야 하며, 두 제품의 공식 보장으로 적지 않는다.

