# cycle08 정보량 원문 감사

2026-10-16 공식 자료 두 개만 확인했다. PDF 스킬에 따라 BFA 3쪽을 실제 이미지로 렌더해 열람했고, React Flow는 페이지 설명·내장 예제 코드만 읽었다. 서비스 조작·데모 실행·사람 이해 검증은 하지 않았다. 둘 다 고정 커밋이 아닌 현행 URL이다.

[BFA PDF 3쪽](https://www.bforartists.de/data/manualbfa4/13_Editors_-_Shader_Editor.pdf#page=3)의 Collapsing Nodes는 **노드 헤더** 화살표로 접어 이름·아이콘을 남기는 기능이다. 그림에는 접힌 노드의 이름, 삼각형과 양쪽 소켓이 보인다. 문서 장 제목의 접기나 부모·자식 데이터 계층 축약이라는 해석은 틀리다. 다만 펼침 전후 동일 인스턴스의 짝 그림은 아니므로 ID·관계 불변이나 복귀 보존까지 증명하지 않는다. URL의 manualbfa4와 달리 현재 PDF 머리말은 **Bforartists 5 Reference Manual**이다.

[React Flow Contextual Zoom](https://reactflow.dev/examples/interaction/contextual-zoom)의 내장 코드에서 `zoomSelector`는 `s.transform[2] >= 0.9`, `useStore(zoomSelector)`는 이 조건의 변화를 구독한다. 같은 custom node에서 `data.content`와 `Placeholder`를 조건부 표시하고 두 Handle은 조건 밖에 둔다. 이 예제는 내부 표시량 변경을 지지하며 노드 집합·계층·관계 의미를 바꾸는 근거가 아니다. 배율 임계값이 비교 학습에 적합하거나 사용자가 변화를 놓치지 않는다는 실증도 없다.

우리 적용은 별도 판단이다. A의 기본 이름·역할·두 호출·짧은 변화 묶음과 선택 상세의 책임 두 항목·인자·근거·준비를 나누는 안은 명시적 표시 조절의 응용이지 원문이 정한 정보 위계가 아니다. B는 배율 조작으로 읽던 변화가 숨거나 전후 읽기 단계가 달라질 위험이 있다. 책임이 없던 시점에 회색 가짜 행을 채우지 않고 외곽만 정렬하자는 제안도 사실 보존을 위한 우리 선택이며, 두 자료의 검증 결과로 포장하면 안 된다.

