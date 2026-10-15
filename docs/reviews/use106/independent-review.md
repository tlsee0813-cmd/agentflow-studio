# USE106 독립 diff 검토

검토 기준: `2931b50938af037a43e20ed7aba69b96ab79843d` 대비 현재 작업 diff와 `app/continuity/tests/use106_browser.py`. 소스 읽기와 `git diff --check`만 수행했다. 브라우저 추가 실험, 실제 키 사용, 유료 API 호출, 제품 소스 수정은 하지 않았다. 아래는 재현 경로가 소스로 확인되는 좁은 문제 3건이다.

## 1. [P2] 이전 프로젝트의 미제출 목적이 새 프로젝트의 배경으로 저장될 수 있음

- 위치: `app/continuity/src/client/app.ts:1462–1463` (관련 기존 경로: `resetEphemeral():107–112`, `startNew():133`, `render():1445`, `showProjects():839–842`).
- 경로: 첫 화면 A에서 `#brief-input`에 목적만 입력 → ‘내 프로젝트’ → ‘새 프로젝트’ B → B의 첫 요청을 작성·제출. 목적 input은 프로젝트 데이터에 들어가지 않고 DOM에만 남는다. 프로젝트 전환은 이 DOM 값을 비우거나 프로젝트별로 복원하지 않는다. 새 자동 capture는 B의 보이는 form에서 그 값을 읽어 `setBrief(candidate, ...)`에 넣는다.
- 영향: 사용자가 B의 첫 요청만 제출해도 A의 목적이 B의 `space.brief`, 첫 작업 `background`, 후속 정리 요청에 들어갈 수 있다. 이전에는 직접 첫 요청 제출이 이 잔여 목적을 저장하지 않았다. `firstRequest`/form hidden 검사는 프로젝트 소유를 확인하지 않는다.
- 최소 권고: 목적 draft를 프로젝트/진입 세션에 귀속시키고 전환 때 해당 프로젝트 값만 복원하거나 초기화한다. 오류 후 같은 프로젝트에 머무는 경우에는 현재 입력 보존을 유지한다. A 목적 입력→목록→새 B→첫 요청 회귀 사례를 추가한다.

## 2. [P2] 수정된 현재 기준을 ‘이번 요청 원문’으로 표시함

- 위치: `app/continuity/src/client/app.ts:624`.
- 경로: 요청으로 만들어진 기준을 `recordBasis(..., id)` 등 기존 기준 수정 UI에서 바꾼다. `outcomeOf().requestBasis`는 `b.history`에 원 요청 source가 있는 현재 Basis도 찾아 반환한다(`shared/outcome.ts`의 `basisFor`). 새 카드는 `flow.request.text`보다 `flow.requestBasis.text`를 먼저 표시한다.
- 영향: 카드의 ‘이번 요청 · 원문 앞부분’이 immutable Source 원문이 아니라 후속 정정된 기준 텍스트가 된다. 전체 전달문은 `flow.request.text`를 원문으로 쓰므로 사용자가 상단에서 검토한 ‘원문’과 실제 전달문의 원문이 다를 수 있다. 기존 원문/현재 기준 구분을 새 위계가 흐린다.
- 최소 권고: 원문 label을 유지하려면 `flow.request?.text`를 표시한다. 현재 기준도 보일 필요가 있으면 별도 label/ID와 함께 표시한다. 기준 수정 후 원문과 현재 값이 구분되는 작은 회귀 사례를 추가한다.

## 3. [P2] 답변이 필요한 질문·준비 전 상태에도 ‘미정 없음/외부 도구에 전달’ 위계가 나타남

- 위치: `app/continuity/src/client/app.ts:627–629` (삽입 위치 `344–347`).
- 경로: MOCK에서도 ‘자동으로 대기 예약을 처리’처럼 기존 규칙이 active 제품 질문을 생성하는 요청을 제출한다. 아직 답변하지 않았으므로 deferred Basis나 unknown/deferred Source는 없다. 새 ‘미정’ 칸은 보류·모름 기록이 없다고만 말하고, 실제 active question은 누락한다. ‘다음 행동’은 항상 외부 도구 복사/저장이다. 같은 문구는 정리 대기와 원문만 보관된 상태에도 나타난다.
- 영향: 상단 4칸 검토의 다음 행동이 기존 `stageOf()`의 ‘답변 필요’, ‘정리 응답 대기’, ‘직접 작성/다시 정리’ 안내와 충돌한다. 문구상 보류·모름 기록이 없다는 말은 좁게 사실이지만, 저장된 active 질문을 미정 위계에서 제외한 채 전달을 권해 미결 선택을 놓치기 쉽다. 현재 새 브라우저 테스트 7은 질문 없는 요청만 검증한다.
- 최소 권고: 기존 `questionApplicability()`/`stageOf()`를 사용해 active 질문을 미정 칸에 명시하고 다음 행동을 현재 단계에 맞춘다. 질문은 현재 답변 가능한 것과 stale 참고 기록을 구분한다. 기존 소스·schema·prompt 변경은 필요 없다. 적어도 active 질문과 advice 없는 보관 상태의 안내를 회귀 확인한다.

## 확인한 보존 사항

- 첫 목적과 요청은 candidate에서 검증한 뒤 한 번 commit되므로 새 코드의 목적/이름만 부분 반영되는 경로는 보이지 않는다. invalid visible request가 이전 valid draft로 제출되는 첫 요청 경로도 재검증한다.
- `commit`/`persist`/locked workspace save를 변경하지 않아 기존 저장 실패 시 메모리 복구 및 기존 저장본 보호 경로는 유지된다. 테스트도 quota 시 기존 저장 문자열, 복구 사본, 중복 task 방지를 확인한다.
- `setBrief` 후 기존 `submit`이 background를 capture하는 방식이며, 기존 작업 사본에 소급 적용하는 코드가 없다. 목적을 Source/Basis/확정 요구로 추가하지 않는다.
- 결과 정리 안내는 읽기 전용이며 개별 삭제·제외·연결 해제 한계, 새 정정 요청 가능성, 전체 프로젝트 휴지통 영향과 기존 연결 잔존을 밝힌다.
- 전체 전달문·IDs·근거·권한·복사/다운로드 로직을 삭제하지 않았다. server/provider/schema 변경도 없다. 조건란의 빈 값 문구는 원문 조건 부재를 단정하지 않게 개선되었다.
- `git diff --check` 통과. 테스트 실행 결과와 브라우저 화면 증거는 root 담당 결과로 별도 판단해야 한다. MOCK/모델 요청 수락만으로 backend 모델 독립 증명이나 의미 이해 품질을 입증하지 않는다.
