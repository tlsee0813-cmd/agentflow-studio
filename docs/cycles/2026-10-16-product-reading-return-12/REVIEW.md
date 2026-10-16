# PC 연결12 — 사전 대조와 수용 경계
2026-10-16 12:10 KST, 구현 후보를 받기 전의 판단 기록. 현재 배정·상태는 [ACTIVE](../ACTIVE.md). 구현 계약을 확대하지 않는다.

## 실제 코드에서 확인한 것
USE106 `618d9bd2b99ad433df35107d8902b15f45e30000`를 Sol High·Astra High와 총괄이 대조했다.
- [continueTask L257](https://github.com/tlsee0813-cmd/agentflow-studio/blob/618d9bd2b99ad433df35107d8902b15f45e30000/app/continuity/src/client/app.ts#L257)은 읽는 요청 A의 직접 보고 R이 current이면 R을 유지한다. 다른 요청의 보고 RB이면 A로 전환한다. 읽는 A의 currentWork와 실제 편집 대상 R을 섞지 않는다.
- [기존 수동 편집 L680](https://github.com/tlsee0813-cmd/agentflow-studio/blob/618d9bd2b99ad433df35107d8902b15f45e30000/app/continuity/src/client/app.ts#L680)은 실제 Task.id에 네 값을 저장한다. [currentWork L225](https://github.com/tlsee0813-cmd/agentflow-studio/blob/618d9bd2b99ad433df35107d8902b15f45e30000/app/continuity/src/shared/domain.ts#L225)는 필드별 manual 우선이며 빈 수동값도 보존하고 낡은 AI 값은 제외한다. 짧은 읽기의 출처도 필드별로 판정해야 한다.
- [출발·열람 L226](https://github.com/tlsee0813-cmd/agentflow-studio/blob/618d9bd2b99ad433df35107d8902b15f45e30000/app/continuity/src/client/app.ts#L226)의 layerMemo만으로 work 경유 복귀는 완성되지 않는다. 최초 출발 상태를 중간 이동에서 덮거나 mapView의 가변 참조로 보관하지 않는다. 프로젝트 교체 시에는 resetEphemeral과 함께 비운다.
- 영역 편집에는 이미 프로젝트+영역별 미저장 버퍼가 있다. 읽기 기본으로 바꾸면서 이 버퍼를 없애지 않는다. 테스트는 기존 spatial102/flow090/use106의 보호 조건을 유지한다.

## Pro 적용 검토와 총괄 판단
[Pro 검토 세션](https://chatgpt.com/c/6ad1695a-1a24-83ee-a948-19a38c912a94)은 기존 Grafana 연구를 좁게 재검토했다. 총괄도 [공식 Panel menu](https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/panel-overview/#panel-menu)의 Edit/Inspect 설명을 대조했다. 해당 서비스는 같은 패널의 편집과 점검을 나누지만 AgentFlow는 읽는 A와 편집할 R이 다를 수 있다. 따라서 메뉴만 복제하지 않고 행동명과 편집 제목으로 실제 대상을 알리는 판단을 채택한다.

받아들인 기준은 ①사용자 구상과 AI/MOCK 제안 출처를 가까이 구별 ②이어가기 버튼·편집 자리의 실제 대상 일치 ③복귀 시 지도 시야와 저장된 업무 상태를 별도로 보존이다. 경고·식별자·보고를 기본 화면에 계속 추가하는 방식은 채택하지 않는다.

Pro의 “핵심 조건을 숨기지 않는다”는 의견을 자동 조건 추출이나 전문 기본 노출의 요구로 확대하지 않는다. 발췌는 앞부분임을 밝히고, 같은 요청의 **원문·조건 전체**를 명시적으로 열 수 있어야 한다. 알려진 긴 조건을 잘라 없애거나 짧은 AI 이해를 완전·검증된 사용자 의도로 보이게 하면 실패다. 기존 MOCK의 의미 오류를 이 UI 작업이 해결했다고 주장하지 않는다.

이 기록은 코드·공식 문서와 기존 공개 PNG의 사전 대조다. Pro는 이번에 화면을 직접 조작하지 않았고, 현재 구현 후보의 조작 성공·사람 이해도 향상 증거는 아직 없다.
