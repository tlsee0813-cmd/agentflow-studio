# cycle05 원문 대조

2026-10-16 · Pro의 자료조사 뒤 내부6.1 Sol High가 원문을 좁게 대조했다. 현재 상태는 [ACTIVE](../ACTIVE.md). 실제 서비스 조작·사람 사용성 결과가 아니다.

## 모델과 뷰

관측일: 2026-10-16(KST). 지정된 공식 문서 3개만 읽었고 추가 조사는 하지 않았다. 아래는 **게시 문서와 DSL 예제의 정적 확인**이며 실제 UI 조작·실행·고정 코드 감사·코드 재사용 선언이 아니다.

| Pro 주장 | 직접 근거와 판정 |
|---|---|
| Structurizr는 모델 요소/관계 기반 뷰를 태그로 선별 | **확인.** filtered view는 기존 base view 위의 뷰이며 태그로 요소 및/또는 관계를 include/exclude한다. 예제는 같은 모델·landscape에서 두 filtered view를 정의한다. 태그 선별을 임의 영역 접기나 부모/자식 포함으로 바꿔 말하면 안 된다. 관계도 필터 대상이다. [Filtered view](https://docs.structurizr.com/dsl/cookbook/filtered-view/) |
| IcePanel의 미할당 상자와 모델 그룹 소속을 구별 | **확인.** 객체의 그룹 할당은 모델에 저장되며 한 객체가 여러 그룹에 속할 수 있다. 할당된 그룹은 내용에 맞춰 자동 크기 조정되고, 객체가 없는 미할당 그룹은 수동 크기의 유연한 시각 경계로 쓸 수 있다. 상자 안에 보인다는 사실만으로 모델 소속을 입증하지 않는다. 미할당 그룹 자체가 모델 객체가 전혀 아니라는 뜻도 아니다. [Groups](https://docs.icepanel.io/core-features/modelling/groups) |
| 하위 연결을 상위에서 재사용하며 direct/lower를 구별 | **확인.** 연결은 모델 관계로 저장되어 여러 diagram에서 재사용된다. C4 하위 객체 사이에 이미 만들어진 연결을 상위에서 lower connection으로 사용하며 원본 변경과 동기화한다. 연결 목록은 direct/lower·incoming/outgoing 필터를 구별한다. 근거 없는 두 상위 객체 사이의 직접 관계로 승격하거나, 임의의 가까운 상자에서 관계를 추론한다는 뜻은 아니다. [Diagramming의 Connections 절](https://docs.icepanel.io/core-features/diagramming#connections) |

## 보존·복귀·포함 의미의 제한

Structurizr 문서는 filtered view를 쓰면 원래 base view가 도표 목록에서 보이지 않으며, 전체를 보이려면 모든 요소/관계를 포함한 filtered view를 별도로 정의하라고 설명한다. 따라서 ‘전체와 부분을 언제나 그대로 오가며 돌아온다’는 주장은 이 출처보다 넓다. 선택·초점·배율·pan·읽기 스크롤 복원은 세 문서에서 확인하지 못했다. [해당 제한](https://docs.structurizr.com/dsl/cookbook/filtered-view/)

IcePanel의 **그룹 소속·C4 parent·시각 경계는 같은 의미가 아니다.** 복수 그룹 할당이 가능하고, 같은 Groups 문서에는 별도로 Change Parent를 통한 nested groups 설명도 있다. ‘그룹 할당은 다른 그룹 제외’라는 한 문장을 근거로 모든 그룹 중첩을 불가능하다고 일반화하면 안 된다. [그룹 원문](https://docs.icepanel.io/core-features/modelling/groups)

모델 객체/연결의 변경 동기화는 **데이터 일관성**에 관한 설명이다. 독자가 이전 화면 상태로 정확히 복귀한다는 동작 증거가 아니다. custom zoom landing 설명 역시 목적 diagram 선택이며 진입 전 화면 복원 계약을 증명하지 않는다. [Diagramming](https://docs.icepanel.io/core-features/diagramming)

## 버전·날짜

- 세 URL 모두 고정 commit이나 문서 버전이 아니다. 확인한 본문에 이 주장들의 개별 게시/갱신일 또는 실행 제품 빌드가 표시되지는 않았다.
- Structurizr 탐색 메뉴의 binaries v2026.09.19는 문서 자체의 버전이 아니다. [문서](https://docs.structurizr.com/dsl/cookbook/filtered-view/)
- IcePanel Diagramming은 **상단 탐색이 2026년 3월 변경됐다**고 명시한다. 이를 Groups나 lower connections 절 전체의 갱신일로 쓰지 않는다. [상단 탐색 절](https://docs.icepanel.io/core-features/diagramming#the-top-level-navigation)

우리 시안에는 ‘같은 근거 대상에서 여러 뷰를 만들기’, ‘시각 묶음과 기록된 소속을 구별하기’, ‘직접 관계와 하위에서 온 관계의 출처를 남기기’라는 설계 원칙의 참고로 한정한다. 실제 프로그램의 포함 구조나 새 관계를 발명하거나 복귀 동작이 이미 해결됐다고 간주할 근거는 아니다. 원격 쓰기는 하지 않았다.




## 탐색과 복귀

2026-10-16 · Sol · **고정 코드/공식 라이브 문서의 독립 읽기 감사.** 실제 UI·사람 사용성·복귀 성공을 실행한 결과가 아니다. 구현·라이브러리 도입·원격 변경은 없다.

**판정:** Pro의 상태 구분은 대체로 맞다. 다만 선택 취소를 모든 강조 해제로, 범위 루트 복귀를 과거 화면 복원으로, 그룹 집중을 외부 연결 보존으로 확대하면 틀린다.

## Dify — 지정 SHA의 코드 범위

지정 `1.17.1`의 고정 SHA `8387590ace4a094de812b7847fc6a4c3a27cd52b`에서 두 파일만 읽었다. 아래 코드 판단은 이 SHA 기준이며 라이브 Cloud 문서와 버전이 같다고 가정하지 않는다.

| 주장 | 확인·교정 |
|---|---|
| parentId·크기는 전체 노드 상태 | iteration 훅은 전체 `nodes`에서 `parentId===nodeId`인 자식을 찾고 컨테이너 크기를 계산해 부모의 `data.width/height`와 `width/height`를 함께 갱신한다. 따라서 선택과 별개로 **구조·치수가 노드 컬렉션 안에 있다**는 좁은 주장은 맞다. 계산은 별도 helper에 위임하며 그 내부까지 감사하지 않았다. 저장·동기화·임의 계층 복귀의 완전한 보장은 아니다. [iteration 22–49행](https://github.com/langgenius/dify/blob/8387590ace4a094de812b7847fc6a4c3a27cd52b/web/app/components/workflow/nodes/iteration/use-interactions.ts#L22-L49) |
| 선택·강조는 노드·선 상태 | `handleNodeSelect`는 `node.selected`, `node.data.selected`와 연결 선의 `_connectedNodeIsSelected`를 갱신한다. **같은 노드/선 객체 안의 필드**이지 별도 저장 계층의 입증은 아니다. [443–475행](https://github.com/langgenius/dify/blob/8387590ace4a094de812b7847fc6a4c3a27cd52b/web/app/components/workflow/hooks/use-nodes-interactions.ts#L443-L475) |
| 선택 취소 ≠ 과거 화면 복원 | 맞다. 특히 `handleNodesCancelSelected`는 **`data.selected`만 false**로 하며 이 함수 자체는 `node.selected`나 선 강조를 정리하지 않는다. 위 일반 선택 함수의 `cancelSelection` 경로와 다르다. 이전 선택·viewport·배율·읽기 위치·초점 스냅샷을 복원하지 않는다. 이를 전체 선택 해제 버그로 확정하지도 않는다(호출부/전체 UI 미실행). [1548–1555행](https://github.com/langgenius/dify/blob/8387590ace4a094de812b7847fc6a4c3a27cd52b/web/app/components/workflow/hooks/use-nodes-interactions.ts#L1548-L1555) |
| 다른 parent 직접 연결 거절 | `handleNodeConnect`에서 두 끝점의 `parentId`가 다르면 즉시 반환한다. **이 편집 연결 경로**의 사실이다. 모든 그래프 입력/가져오기/서버 유효성 검사의 보장으로 확대하지 않는다. 둘 다 최상위여서 `undefined`이면 이 조건은 통과한다. [494–502행](https://github.com/langgenius/dify/blob/8387590ace4a094de812b7847fc6a4c3a27cd52b/web/app/components/workflow/hooks/use-nodes-interactions.ts#L494-L502) |

[공식 Iteration 문서](https://docs.dify.ai/en/cloud/use-dify/nodes/iteration)는 배열 원소별 내부 workflow 실행을 설명한다(현재 페이지 수정일 2026-06-25). 이 실행상 하위 workflow를 우리 앱의 프로그램 구성·변경 소유·미결 집계와 동일시할 근거는 없다. 문서는 진입 전 화면 복원을 보장하지 않는다.

## yFiles — 2026-10-16 읽은 라이브 문서

- **master/view 구분은 맞다.** 전체 모델과 접기 가능한 표시 복사본을 매핑하며 접기만으로 master 자식을 삭제하지 않는다. 일반 편집은 master·다른 view로 동기화되므로 표시 복사본을 독립 업무 데이터로 해석하면 안 된다. view별 접힘/펼침은 다를 수 있지만 같은 manager의 접힌 노드 모양·위치 등 folding state는 공유한다. view 노드 참조는 접기/펼침으로 무효가 될 수 있어 보존 참조에는 master 매핑이 필요하다. [Folding: Working with Folding / Advanced Insights / Shared Folding States](https://docs.yworks.com/yfiles-html/dguide/folding/)
- **`localRoot=null`은 전체 계층 범위로 돌아간다.** 과거 viewport·선택·초점 복구 계약은 아니다. 탐색 undo 기록도 `enqueueNavigationalUndoUnits` 기본값은 false다. `getMasterEdges`는 집계 view 선이 대표하는 원래 선 **전부**를 조회한다. `getMasterItem`만 쓰면 복수 선 중 대표 하나이므로 소유·끝점 확인의 대체가 아니다. [IFoldingView: localRoot / enqueueNavigationalUndoUnits / getMasterEdges](https://docs.yworks.com/yfiles-html/api/IFoldingView/)
- **외부 맥락 보존은 별도 문제다.** 공식 그림 설명은 그룹 내부를 별도 그래프로 표시할 때 외부 노드 연결은 그 그래프에 포함되지 않는다고 명시한다. 접힘 선 병합·원래 선 조회가 제공되어도, 집중 화면에 외부 관계·미결 소유가 자동으로 보존되는 것은 아니다. [Folding: Concepts of folding](https://docs.yworks.com/yfiles-html/dguide/folding/)

지정 두 yFiles 문서의 실제 링크에서 **직접 folding demo 링크는 발견하지 못했다**. 일반 Demos 목차만 있어 임의 데모 주소를 반환하지 않는다. yFiles 페이지는 고정 커밋/릴리스 문서로 회수한 것이 아니므로 Dify 고정 SHA와 같은 버전 재현성을 부여하지 않는다.

**cycle05에 가져올 범위(해석):** 업무 대상/구조, 표시 깊이, 선택·가리킴, 진입 전 보기 복귀를 구분하고 stable ID로 연결한다는 설계 원칙까지다. 선택 취소나 범위 루트 설정 한 번으로 다른 깊이·외부 관계·미결 소유·지도 위치·읽기 초점까지 복원된다고 주장할 수 없다. 두 제품의 실제 조작이나 사람 이해 효과는 이번에 검증하지 않았다.


## 이후의 공식 데모 관측 — 원문 감사와 분리

2026-10-16(KST), 총괄은 공식 Demos 목록에서 [Folding 데모](https://www.yfiles.com/demos/application-features/folding/)를 찾아 IAB 1280×720에서 한 경로를 직접 조작했다. 기본 Automatic Group Node Alignment는 off였다. Group1 라벨 선택 후 SVG 라벨에 키를 직접 보내는 첫 시도는 실패했고, 그래프에 페이지 키를 보내 접기(Alt+Left) → 내부(Alt+Down) → 전체 범위(Alt+Up)를 실행했다.

처음 내부3개·외부2개가 보였고, 접은 뒤 내부가 숨겨지고 외부2개와 선이 남았다. 내부 진입에서는 내부3개만 보이고 외부2개/연결은 보이지 않았다. 전체로 나왔을 때 접힌 그룹과 외부2개가 다시 보였다. 이는 집중 보기에서 외부 맥락을 별도로 남길 필요를 보여 주는 좁은 관측이다. 정밀 좌표·임의 배율·pan·모든 관계 매핑·사람 이해도를 확인한 것은 아니다. 화면4개를 도구 출력으로 열람했으나 GitHub에서 회수할 수 있는 이미지 파일은 확보하지 못했다.

별도 Cloud 관측은 **접속 실패로 전 장면 NOT_RUN**이다. 지정 URL에서 `net::ERR_TUNNEL_CONNECTION_FAILED`, HTTP 응답 없음, finalURL=about:blank였고 PNG는 없다. [고정 원본 기록](https://github.com/tlsee0813-cmd/agentflow-studio/tree/bb2bb37b106c0ec1cf4063b27fb1c666229f2f50/docs/transfer/composition-05/reference-folding)의 observer exit0은 접근 오류를 기록하고 끝났다는 뜻으로, UI 검사 통과가 아니다. 총괄 관측과 합쳐 독립 검증 성공으로 세지 않는다.

원본 REPORT의 Playwright1.57.0과 process-exit.json의1.62.0은 불일치한다. 어느 값이 실제 설치값인지 이 패킷만으로 확정하지 않는다. 원문은 보존하며 다음 시안 실행에는 설치 버전의 동적 기록을 요구한다. 접근 우회·TLS 완화·설치·추가 로그인은 하지 않았다.
