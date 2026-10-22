# 31 · 접힌 부분에서 하위 기록 읽기 — 기록 진입과 위치 보존의 한정 수용

접힌 부분의 질문·설명 집계에서 해당 부분과 하위 기록을 바로 열어 읽고, 정확한 보고를 확인한 뒤 원래 호출행으로 돌아오도록 했다. 정보 패널을 다시 찾아 펼치는 단계를 줄이면서 지도 카메라·가지 접힘·현재 작업·미전송 입력은 유지한다. 질문 수는 답변 기록이 있는 질문도 포함하며, 미답 수나 새 소식 수가 아니다. 최종 후보는 `72940a043d7a7fdc225a9582ce48831fa0418cc0`이고 제품 app은 `7c63a494…`, 회귀 검사는 `17fc22a3…`이다.

최초 좁은 독립 관측은 양 PC에서 키보드 진입, 첫 소유 기록 글줄, 두 단계 아래의 현재·이전 기준·보류, 동명인 다른 부모의 기록 구분과 정확 보고 왕복을 확인했다. 다만 이후 통합본에서 실제 page wheel로 Y120에 둔 뒤 신호를 누르면 **1280은116, 1440은0으로 페이지가 이동하는 반례**가 나왔다. 클릭 전 신호의 전체 clip/hit는 유효했고, 보고 왕복이 성공해도 신호 진입 자체의 위치 보존 실패는 남았다. [최초 관측](https://github.com/tlsee0813-cmd/agentflow-studio/blob/c6fb8b0980a3c9f19646286fb20645e50be2dc6a/docs/transfer/branch-records-31/independent-a/v0/REPORT.md), [원본 반례](https://github.com/tlsee0813-cmd/agentflow-studio/blob/84dd92fb8112baecb73ac879cd434ebd78d23eb3/docs/transfer/branch-records-31/independent-a/page-entry-base/REPORT.md).

fix2는 신호 진입 한 곳에서 실제 page X/Y를 잡아, 최종 DOM 복원 뒤·지도 크기 측정 전에 기존 render 콜백으로 복원한다. 이후 정확한 하위 기록 열기와 패널 내부 읽기 순서는 유지한다. 같은 동결 반례 검사로 후보 양 PC의 첫 동기·후속 frame·문서 scrollend에서120이 유지됐다. 기존 두 교차 흐름도 양 PC에서 완료해 일반 전체 공간 진입과 명시 원점 복귀를 구별하고, 지도·접힘·소유자·호출행·현재 작업·초안을 대조했다. 이는 관측된 이동 해소의 한정 증거이며 브라우저 내부 원인을 확정한 결과는 아니다. [독립 fix2 대조](https://github.com/tlsee0813-cmd/agentflow-studio/blob/9f1ca01db783a0c298e8043dd7586a7f3f439ddb/docs/transfer/branch-records-31/independent-a/page-entry-fix2/REPORT.md).

별도로 최종 후보의 작성자 회귀는 기존8개와 새 page 위치2개를 모두 통과했다. 같은 신규 검사만 원본 통합본에 얹으면 양 PC에서 준비·가시성 guard를 지난 뒤120→0으로 실패했다. 따라서 준비 실패를 제품 실패로 바꾸거나 기존 단언을 약화해 얻은 통과가 아니다. 이 합성 domain 입력 기반 회귀 실행을 앞선 정상 UI 독립 관측과 합산하지 않는다. [작성자 회귀 실제 실행과 원본 대조](https://github.com/tlsee0813-cmd/agentflow-studio/blob/8a0508a108b9f1183b9cc7b9778dffb259abd0fc/docs/transfer/branch-records-31/independent-a/author-fix2/REPORT.md).

중간 통합본7c7의 CI는 양 OS에서 브라우저250개와 후속 static까지 성공했지만, 새 page 위치 반례를 배제하지 못한 이전 검사 결과다. 최종72940a CI의 성공으로 대체하지 않는다. 초기0d9831의 Ubuntu 설치 지연·25분 취소와 신규31 미실행, dd52aa 문서 누락의 사전 교정도 이력으로 남기고 서로 합산하지 않는다. [중간 통합본 CI 근거](https://github.com/tlsee0813-cmd/agentflow-studio/blob/8a0508a108b9f1183b9cc7b9778dffb259abd0fc/docs/transfer/branch-records-31/ci-7c7bdf/REPORT.md).

54% 맞춤 장면의 신호 글자는 약6px다. 버튼 도달과 글줄 가시성은 편안한 가독성·사람 사용성 합격을 뜻하지 않는다. 화면 밖 호출자에서 돌아가는 공간 제목은 sr-only여서 보이는 강조가 아니다. 같은 세션의 신호 자체 소멸은 미실행이다. 관계 모드 수명은 관계0개 자료의 범위이며 실제 관계 끝점 일반성을 입증하지 않는다. 자료는 합성/MOCK이며 실제 AI 품질·개발 완료를 검증한 것이 아니다.

최종 CI39862478703은 정확72940a에서 양OS completed/success다. 각 로그에서 continuity275·브라우저26묶음252개,31신규10개와30의4개를 확인했다. tail120,000자 잘림으로 앞쪽 app 총계·실제 Node 출력은 확인하지 못했다. [최종 CI 원문·한계](https://github.com/tlsee0813-cmd/agentflow-studio/tree/9afda640938f1ef2536dbb44d01b314757320bde/docs/transfer/branch-records-31/ci-72940a). 독립 Cloud와 자동회귀를 구별한 [총괄 원자료 판정](https://github.com/tlsee0813-cmd/agentflow-studio/blob/9afda640938f1ef2536dbb44d01b314757320bde/docs/transfer/branch-records-31/independent-static/ROOT_FIX2_REVIEW.md)도 연결한다.

[PR16](https://github.com/tlsee0813-cmd/agentflow-studio/pull/16)을 checkpoint에 병합했다. 병합75ed2ed7d7aae5c8267810e544fbbfa807ed56bd의 두 부모는 직전checkpoint60dc1e36과 최종72940a다. app 전체 subtree00267e7cc9b913305dccc063c6439cb1ffd302f3가 후보와 동일하며 직전checkpoint의 모든 docs blob도 보존됐다. main과 gh-pages는 기존 SHA를 유지한다.32의 관측은 이와 동일한 제품 소스72940a를 사용하므로 제품 버전을 바꾸지 않고 이어간다.
