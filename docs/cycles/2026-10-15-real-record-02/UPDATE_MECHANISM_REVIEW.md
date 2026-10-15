# 사용자 조정 뒤 새 기록 — 기존 메커니즘 조사 회수

2026-10-16 · Pro 공식 문서·고정 코드 조사 회수 · 직접 서비스 조작 미실행. 현재 실행 상태는 [ACTIVE](../ACTIVE.md)에만 모은다.

질문은 사용자 이름·묶음 조정 뒤 새 AI 기록을 받을 때 무엇을 보존하고 갱신하며 언제 확인을 요구할지다. [Pro 원 세션](https://chatgpt.com/c/6ad0ec2b-71b8-83ec-8e3a-798f622b57dc)의 후속 조사이며 이전 공간·탐색 연구와 구분한다. 아래는 총괄이 회수한 주장과 적용 경계다. [HA·Penpot 독립 대조](UPDATE_MECHANISM_SOURCE_REVIEW_SOL.md), [Zotero 독립 대조·정책 반박](UPDATE_MECHANISM_SOURCE_REVIEW_ASTRA.md)를 회수했다.

| 사례 | 조사에서 찾은 메커니즘 | AgentFlow에 적용할 때의 경계 |
|---|---|---|
| Home Assistant | 사용자 name과 연동 original_name을 별도 보관. domain/platform/unique_id로 같은 등록 대상을 찾는 경로에서 수집 값은 갱신하되 사용자 이름·방을 덮지 않음 | 이름의 유사성은 동일성 근거가 아님. 안정된 기기 식별자·삭제 후 재발견 복원을 프로그램 구상에 그대로 적용하지 않음 |
| Penpot | 원본과 인스턴스의 연결 ID 및 touched 속성군으로 재정의 보호. 사용자 수정 초기화와 원본 갱신 방향을 구별 | 한 필드의 수정이 같은 속성군의 다른 변경을 막을 수 있음. 이름·설명·소속·결정 전체를 한 보호 단위로 만들지 않음. AI 해석을 항상 정답인 메인으로 놓지 않음 |
| Zotero | 공통 기준 JSON 이후 로컬·원격 변경 집합을 대조. 대응 가능한 독립 변경을 병합하고 충돌은 객체 유형에 따라 처리 | 필드 차이의 비중첩은 의미 양립의 증명이 아님. 기준본 없는 경우·삭제·일반 항목 이외의 정책은 별도. 확인된 병합의 옛 참조 유지와 분할 뒤 결과 자동 귀속은 다름 |

Pro는 Home Assistant의 삭제 기록 복원과 저장 형식1.24의 예외, Penpot의 text-font/geometry 그룹 보호, Zotero의 기준 캐시 없는 구성원 삭제 무시 및 비항목 원격 우선 분기를 반례로 제시했다. 이는 정적 코드·문서에 근거한 설명이며 실제 사용자 조작·최신 버전 전반의 동작을 확인한 결과가 아니다.

## 총괄의 조건부 판단

Pro가 제시한 ‘사용자 조정을 지속 우선값으로 유지’와 ‘공통 기준 이후 변경으로 비교’를 제품 전체의 양자택일로 바로 채택하지 않는다. 전자는 조정의 권위·지속 범위, 후자는 변경 판별 방법이므로 함께 적용될 수 있다. 표시 취향과 실제 작업 기준은 다를 수 있다. 먼저 **어느 의미를 사용자가 바꿨는지, 같은 대상임을 무엇으로 확인하는지**가 필요하다. 이름을 보존한다는 이유로 새 개발 정보를 전부 막거나, 새 정보가 왔다고 사용자 수정을 되돌리는 정책은 둘 다 피한다.

독립 대조에서 일반화도 좁혔다. HA는 특정 재등록 경로의 사용자 값 보존이지 마이그레이션·삭제 복원까지 불변인 것이 아니다. Penpot에는 속성군 외 디자인 토큰·연결 변경 경로가 있어 속성 매핑만으로 전체 동기화를 설명하지 않는다. Zotero의 비항목 예외는 해당 충돌의 원격 변화를 적용하는 것이며 전체 원격 사본의 무조건 교체가 아니다. 병합 실행 코드만으로 사람이 승인한 UI 경로를 증명하지 않는다. 이 경계 때문에 세 도구 중 하나를 그대로 도입하는 결론은 내리지 않는다.

다음 작은 공간 흐름에서는 이 원리의 읽기 표현만 검토한다. 기본 지도에 사용자용 짧은 설명과 중요한 변화, 관련 부분을 남기고 필요한 때만 근거를 펼친다. 자동 병합·충돌 처리 엔진·라이브 수집·인스턴스 체계를 구현하는 배정으로 바꾸지 않는다. 사용자의 수정이 보기 정리인지 실제 책임 변경인지 불명확하면, 그 차이가 현재 판단에 필요할 때만 드러낼 방법을 비교한다.

Pro의 예시인 ‘알림을 이메일 알림으로 바꾸고 푸시 부분을 옮긴 뒤 늦은 옛 결과 수신’은 **미확보된 표본 제안**이다. 실제 사건으로 사용하지 않는다. 현재 찾은 [FIX058 부분 후보](REAL_CHANGE_CANDIDATE.md)는 목적 정정과 작업 지시 분리를 문서로 보고하지만, 사용자 원발화·실제 인계 수락은 없다. 두 자료의 빈칸을 서로 보충한 것처럼 합치지 않는다.

## 고정 출처

- Home Assistant: [공식 Entity registry](https://developers.home-assistant.io/docs/entity_registry_index/), [사용자 수정 안내](https://www.home-assistant.io/docs/configuration/customizing-devices/), [44df32d0의 entity_registry.py](https://github.com/home-assistant/core/blob/44df32d0df56ac75f2d1eb13082dc2459901b244/homeassistant/helpers/entity_registry.py), [해당 LICENSE](https://github.com/home-assistant/core/blob/44df32d0df56ac75f2d1eb13082dc2459901b244/LICENSE.md).
- Penpot: [공식 Components](https://help.penpot.app/user-guide/design-systems/components/), [7383e086의 데이터 가이드](https://github.com/penpot/penpot/blob/7383e086837c5d868de6e29f312f96924236f8bb/docs/technical-guide/developer/data-guide.md#component-synchronization), [component.cljc](https://github.com/penpot/penpot/blob/7383e086837c5d868de6e29f312f96924236f8bb/common/src/app/common/types/component.cljc), [해당 LICENSE](https://github.com/penpot/penpot/blob/7383e086837c5d868de6e29f312f96924236f8bb/LICENSE).
- Zotero: [공식 동기화](https://www.zotero.org/support/dev/web_api/v3/syncing), [db41b99f의 syncLocal.js](https://github.com/zotero/zotero/blob/db41b99fddcc52d38897c59c161b6adaca036afb/chrome/content/zotero/xpcom/sync/syncLocal.js#L1940-L2220), [mergeItems.mjs](https://github.com/zotero/zotero/blob/db41b99fddcc52d38897c59c161b6adaca036afb/chrome/content/zotero/mergeItems.mjs), [해당 COPYING](https://github.com/zotero/zotero/blob/db41b99fddcc52d38897c59c161b6adaca036afb/COPYING).

Pro가 확인한 라이선스 식별은 각각 Apache-2.0, MPL-2.0, AGPLv3다. 독립 대조에서는 Penpot의 MPL-2.0 헤더와 Zotero의 AGPL v3 또는 이후 버전 헤더를 직접 확인했다. 코드 결합·배포 조건 전체의 검토나 의존성 도입 결정은 아니다. 이번에는 메커니즘과 반례의 참고 범위다.
