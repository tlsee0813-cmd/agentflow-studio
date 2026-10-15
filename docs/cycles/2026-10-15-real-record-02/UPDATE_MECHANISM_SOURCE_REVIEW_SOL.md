# 갱신·사용자 조정 메커니즘 — 좁은 공식 원문 대조

2026-10-16 · 사례별 지정 핵심 파일 1개＋공식 문서 필요 부분 1개만 열람 · 설치·실행·UI 조작·원격 쓰기 없음

## 판단

**두 설명의 핵심은 근거가 있지만 ‘사용자 수정은 언제나 그대로 보존’, ‘수정한 속성 하나만 보호’로 일반화하면 안 된다.** HA는 출처 필드와 사용자 필드를 나누고, Penpot은 명시적인 인스턴스 연결과 속성군 단위의 덮어쓰기 보호를 둔다. 이는 AgentFlow가 갱신과 직접 조정을 구별하는 참고 메커니즘이며, 자연어 목적 변화의 자동 판정·범용 충돌 해결·더 나은 사용자 경험을 입증한 결과가 아니다.

## Home Assistant

고정 코드: [`entity_registry.py` @ `44df32d0df56ac75f2d1eb13082dc2459901b244`](https://github.com/home-assistant/core/blob/44df32d0df56ac75f2d1eb13082dc2459901b244/homeassistant/helpers/entity_registry.py). 공식 [Entity registry 문서](https://developers.home-assistant.io/docs/entity_registry_index/)는 사용자 이름 우선과 식별자의 안정성을 설명하고 Device Name을 unique ID의 부적합한 출처로 든다. 이 문서 URL은 가변 문서이며 고정 코드와 동일 시점의 판이라고 주장하지 않는다.

- **확인:** `RegistryEntry`는 `unique_id`, `name`, `original_name`, `area_id`를 분리한다. [`entity_name` 307~313행](https://github.com/home-assistant/core/blob/44df32d0df56ac75f2d1eb13082dc2459901b244/homeassistant/helpers/entity_registry.py#L307-L313)은 `name is not None`일 때 이를 먼저 쓰고, 없으면 접두를 정리한 원래 이름·원래 이름으로 내려간다. 표시 이름을 정체성 키로 삼는 구조가 아니다.
- **일반 갱신 경계:** [`async_get_or_create` 1557~1619행](https://github.com/home-assistant/core/blob/44df32d0df56ac75f2d1eb13082dc2459901b244/homeassistant/helpers/entity_registry.py#L1557-L1619)은 `(domain, platform, unique_id)`로 기존 항목을 찾고 `original_name` 등 통합 제공 필드를 갱신한다. 이 호출은 사용자 `name`과 `area_id`를 전달하지 않으며, 업데이트는 `UNDEFINED`가 아닌 값만 반영한다. 따라서 **이 재등록 경로에서 사용자 이름·영역을 덮지 않는다는 설명**은 맞다. 명시적 사용자 편집이나 마이그레이션까지 불변이라는 뜻은 아니다.
- **복원·마이그레이션 예외:** [삭제 항목 복원 1638~1669행](https://github.com/home-assistant/core/blob/44df32d0df56ac75f2d1eb13082dc2459901b244/homeassistant/helpers/entity_registry.py#L1638-L1669)은 저장된 이름·영역·내부 ID 등을 가져오지만, 종전 `entity_id`는 가용할 때만 재사용한다. [1.24 마이그레이션 1033~1078행](https://github.com/home-assistant/core/blob/44df32d0df56ac75f2d1eb13082dc2459901b244/homeassistant/helpers/entity_registry.py#L1033-L1078)의 `name=None`은 **삭제 항목**에 적용된다. 활성 항목에는 조건부 기기 접두 제거·호환 이름 보존 처리가 있다. ‘1.24가 모든 사용자 이름을 비움’도 ‘삭제 뒤 모든 값을 무조건 원상복구’도 과장이다.

**적용 한계:** AgentFlow에서도 같은 대상의 안정 식별자, 외부에서 온 값, 사용자 조정 값을 구별한다는 가설은 참고할 수 있다. 그러나 HA의 기기 영역·재등록·삭제 복구를 프로젝트 구성의 분할/병합이나 사용자 의도 철회의 자동 규칙으로 옮길 근거는 없다. 실제 설정 UI·갱신 시각·사람의 이해 효과는 실행하지 않았다.

## Penpot

고정 코드: [`component.cljc` @ `7383e086837c5d868de6e29f312f96924236f8bb`](https://github.com/penpot/penpot/blob/7383e086837c5d868de6e29f312f96924236f8bb/common/src/app/common/types/component.cljc). 같은 커밋 [Data Guide의 Component synchronization](https://github.com/penpot/penpot/blob/7383e086837c5d868de6e29f312f96924236f8bb/docs/technical-guide/developer/data-guide.md#component-synchronization)과 대조했다.

- **확인:** 코드의 `sync-attrs`와 문서는 복사본에서 수정한 속성의 군을 `touched`로 표시하면 이후 원본의 **같은 군 속성** 갱신을 적용하지 않는 계약을 설명한다. `font-family`·`font-size`는 같은 `text-font-group`, 위치·크기·회전 등은 같은 `geometry-group`이다([42~89행](https://github.com/penpot/penpot/blob/7383e086837c5d868de6e29f312f96924236f8bb/common/src/app/common/types/component.cljc#L42-L89)). 따라서 글자 크기만 고쳐도 원본의 글꼴 변경, 위치만 고쳐도 원본의 다른 기하 변경이 보호 군에 함께 걸릴 수 있다. 이는 문서·매핑에 따른 추론이며 실제 UI 동기화를 실행한 결과는 아니다.
- **ID 연결:** `instance-of?`는 `component-file`＋`component-id`, `is-main-of?`는 복사본의 `shape-ref`와 원본 shape `id`를 비교한다([202~211행](https://github.com/penpot/penpot/blob/7383e086837c5d868de6e29f312f96924236f8bb/common/src/app/common/types/component.cljc#L202-L211)). 이름 유사성으로 원본·복사본을 찾는 규칙이 아니다. 이 helper만으로 모든 연결 변경·중첩·동기화 성공을 감사한 것은 아니다.
- **과장 주의:** Data Guide의 ‘매핑 밖 속성은 동기화에서 무시’는 해당 속성 매핑 경로의 설명으로 좁혀야 한다. 같은 파일 [`component-attr?` 162~175행](https://github.com/penpot/penpot/blob/7383e086837c5d868de6e29f312f96924236f8bb/common/src/app/common/types/component.cljc#L162-L175)은 design tokens의 별도 경로와 `shape-ref`·`component-id`·`component-file` 등의 동기화 유발을 명시한다. ‘목록 밖 모든 데이터는 어떤 동기화에도 관여하지 않음’이라는 전체 규칙은 아니다.

**적용 한계:** 보호할 수정의 소유와 단위를 명시한다는 가설은 참고할 수 있지만, 속성군을 그대로 가져오면 관련 자동 갱신까지 넓게 멈출 수 있다. 구성 이름 수정이 관계·목적·작업 범위까지 보호하거나 반대로 다시 쓰게 하는 규칙으로 바로 확정하면 안 된다. 실제 동기화 엔진의 모든 분기·해제/재동기화 UI·충돌 판단은 읽기 범위 밖이며 설치·실행하지 않았다.

## 검증 수준과 사용 조건

이번 확인은 고정 공식 코드의 필드·우선순위·선택 분기와 지정 문서의 계약 대조다. Pro의 실제 UI 미실행 보고와 일치하며 새로운 실행 증거를 추가하지 않았다. Penpot 핵심 파일의 MPL-2.0 헤더는 직접 확인했다. HA의 Apache-2.0은 Pro 보고 사항으로만 보존하고 이번 제한된 파일·문서 범위에서 별도 LICENSE를 감사하지 않았다. 두 프로젝트의 의존성 도입·코드 재사용·라이선스 적합성을 권고하거나 확정하지 않는다.
