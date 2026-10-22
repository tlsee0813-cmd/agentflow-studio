# 32 이어가기 안내의 작업00 — 읽기 전용 감사

결론: 실제 안내 번호 오류다. 작업02를 명시적으로 이어가는 동작과 원작업04 데이터 보존의 오류로 확대할 근거는 없다. 제품·검사 수정과 UI/서버/단위 실행은 하지 않았다.

## 원행동과 표시

고정 자료는 `57896a27266c20b21ac1c3b2a94ba27ca7294eec`의 `docs/transfer/reentry-judgment-32/observer-a/v0/`다. `1280-EXPLICIT-CONTINUE.md`는 클릭 전에 현재04를 남기고02로 명시 전환하여 N만 편집하겠다는 판단을 기록한다. actions 원문은 다음 순서를 갖는다.

- JSONL 48행/seq27: `2026-10-22T22:15:01.535821+00:00`, 정상 `#task-view-continue` 클릭.
- 49행/seq27: `22:15:01.754863`, `1280-explicit-error-continue` 화면에 “작업 02로 이어가기 … 전에 이어가던 작업 00은 그대로 남아요.”가 기록됐다.
- 155행/seq82: `22:19:03.353737`, 1440의 같은 정상 클릭. 156행/seq82의 `22:19:03.610696` 화면에도 같은02/00 문구가 기록됐다.

`actions.jsonl.gz`는 259,983바이트이며 Git blob `da50d46eb61232672a279ace5c46d9a3fe72b46f`, SHA256 `aedcb47e45479e6cc23210d74cf0d06a72787d58855ff548124d9efc06c316a0`를 실제 회수 바이트로 확인했다. 해제 원문 SHA256은 `e1db71d8d1a9261f932d23f0512bcf1dc129f7501f920968d584b6e851a122c1`다. 필요한 발췌와 앞선 판단은 `ACTION_EXCERPTS.json`에 남겼다. 화면 dump의 일반 가시성 한계를 실제 화면 통과 주장으로 바꾸지 않았다.

## 정확729 코드의 원인

[app.ts 444–452](https://github.com/tlsee0813-cmd/agentflow-studio/blob/72940a043d7a7fdc225a9582ce48831fa0418cc0/app/continuity/src/client/app.ts#L444)의 반환 Git blob은 `8ee7ce15373ca309364e87a6277a59cddebd3e39`다. `continueTask` 447행은 이전 current 객체를 잡고, 다른 작업이면448행에서 `focusTask` 결과를 commit한다. 450행의 번호 함수는 새 `project.tasks.indexOf(x)+1`로 객체 자체를 찾는다.

[domain.ts 10·17행](https://github.com/tlsee0813-cmd/agentflow-studio/blob/72940a043d7a7fdc225a9582ce48831fa0418cc0/app/continuity/src/shared/domain.ts#L10)은 `structuredClone`과 이를 사용하는 `change`다. `focusTask` 78–79행은 이 복제본의 currentTaskId를 명시 ID로 바꾼다. 이전 current는 복제 전 객체이므로 새 배열의 indexOf 결과가 -1이다. +1은0이고 app1306의 pad가 이를00으로 표시한다. 반면 read는 commit 뒤 새 배열에서 찾으므로02가 정확하다. 관측 문구와 이 원인이 일치한다.

따라서 다른 작업으로 명시 전환하는 분기의 안내에서 재현 가능한 표시 문제다. currentTaskId는 선택한 ID로 바뀌고 기존 tasks를 삭제하거나 원작업을 바꾸는 경로가 아니다. 원보고의 비대상 데이터 보존 대조도 통과했다고 기록돼 있다. 이 감사가 그 저장 전체를 새로 재실행·재검산한 것은 아니다.

## 최소 수정과 필요한 회귀

450행의 번호 조회를 `project.tasks.findIndex(t=>t.id===x.id)+1`처럼 안정 ID 기준으로 바꾸는 한정 수정이 가장 작다. 도메인 current 정책·저장 schema·출발점·작업 네 값은 바꿀 이유가 없다. commit 전 두 번호를 포착하는 대안도 가능하지만 현재 helper를 ID 기준으로 고치면 두 안내 분기의 의미를 함께 유지한다.

기존 정상 이어가기 브라우저 장면에 두 경계만 추가하면 충분하다. 첫째, 다른 current04에서02를 읽고 명시 이어가기를 눌러 notice의 대상02/이전04와00 부재, 실제 current02, 원 tasks·draft·대상 보존을 함께 확인한다. 둘째,02의 현재 보고R에서 원요청02를 이어갈 때는 current가R에 남는 기존 정책과 안내의02/R 번호를 확인한다. 전체 새 suite나 의미 판단은 필요 없다. UI 안내를 만드는 함수의 문제이므로 순수 focusTask 검사만으로는 번호 회귀를 검출할 수 없다. 이 제안은 실행 결과가 아니다.

가장 알맞은 기존 검사는 `app/continuity/tests/pc12_browser.py`의 `test_02_continue_keeps_R_then_switches_from_RB_to_A`다. 211–221행은 현재 보고02를 유지하며 원요청01을 이어가는 양성 경계와 notice를 이미 검사한다. 228–239행은 current RB(작업04)에서 A(작업01)로 전환하고 비대상 B/RB/R 보존을 검사하지만, 233행 클릭 직후 이전 번호를 검사하지 않는다. 그 직후, 편집이 안내를 지우기 전에 대상01·이전04·00 부재를 추가하면 원인과 같은 객체교체 분기를 기존 양 PC에서 잠글 수 있다. `report16_browser.py::test_05_continue_policy_unchanged_and_apart` 316–327행도 같은 두 분기가 있지만 중복 확대할 필요는 없다. 이 기존 파일은 전체 테스트가 있는 `work/product31-author`에서 읽었으며 이번 감사에서 수정하지 않았다.

전역 번호 API는 필요 없다. 현재 no는450행 continueTask,2194행 continueTarget,2396행 pointedSection의 서로 다른 지역 함수다. 뒤 두 함수는 같은 렌더의 현재 배열에서 읽은 task로 번호를 표시하며 그 함수 안에 focusTask/commit을 끼우지 않는다. 이미 맞는 사전 안내나 보고 연결경로를 함께 고칠 이유는 찾지 못했다. 450행의 지역 helper만 ID 비교로 바꾸면 호출은 기존 Task 인수와 문구를 그대로 유지하고 두 notice 분기에만 영향을 한정한다. 전역 no(id)를 새로 만들면 입력 타입과 세 별개 렌더 경로를 불필요하게 넓혀 검증 범위가 늘어난다.

원자료 확인 중 잘못 추정한 MANIFEST.json 경로는404였고 실제 목록은 MANIFEST.tsv였다. 첫 콘솔 발췌는 cp949 출력 오류가 있어 원바이트를 건드리지 않고 ASCII 출력/UTF-8 발췌 저장으로 다시 읽었다. 제품이나 관측 원본의 인코딩 오류가 아니다.

