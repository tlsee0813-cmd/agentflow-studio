# Cycle18 fix2 추가 두 경계 — 핵심 통과와 잔여 실패 구별

제품 9330fc3b19994dd5398d4373c1a3fc703bd28574. before [c7981de](https://github.com/tlsee0813-cmd/agentflow-studio/tree/c7981de616f275b97b1ccc28dd316a778a075f7d/docs/transfer/mixed-depth-18/independent-v0), core fix1 및 anchor 진단 [dba09504](https://github.com/tlsee0813-cmd/agentflow-studio/tree/dba09504c13ff18b9a97f11bb6b60484f4ddd11f/docs/transfer/mixed-depth-18/independent-fix1)을 보존한다. 제품/다른 증거를 수정하지 않았다.

## 직접 실행

- check/build/continuity check/build 실제 child 모두 exit0. 이번에 전체 역사 unit/browser suite를 다시 돌리지 않았다. fix1 Node261/261/core 질문 검증은 그 SHA의 별도 실행이고 fix2 수치로 합산하지 않는다. attention/domain/shared/CSS는 e37과 동일하다.
- 같은 extra-ui-key-observation 6관측(양PC×목록/일반입력 Escape/composition Escape) exit0. 코드의 제품 경로/보고 source SHA만 바꿨다. 목록 전후 bodyTop1280 294→294,1440 280→280; 펼침 유지. 프로젝트 재열기 직후와 같은 영역 명시클릭 후를 둘 다 기록했다. 후자의 click으로 복구를 만들어낸 것이 아니다. context true와 area-name focus가 일반 입력 Escape/isComposing=true Escape 뒤 유지되고 값도 남았다. Chromium CDP composition이며 OS IME/사람 사용검사는 아니다. 관측 listener는 console에 keydown을 기록할 뿐 이벤트/제품 상태를 변경하지 않는다. defaultPrevented인 실제 내부 control 경로를 독립적으로 만들지는 않았으며 작성자의 synthetic dispatch 성공을 독립 성과로 세지 않는다.
- normal-escape는 양PC에서 panel body 실제 Escape→패널 제거/원카드 focus/context 유지, 다음 실제 Escape→context 닫힘을 별도 4관측으로 확인했다(exit0).
- 기존 독립 2표본×2PC 핵심 4흐름/46관측을 이 SHA에서 실제 실행 exit0. raw cards/computed matrix/collapse/original relation 배열/실제 새 작업/명시 결과파일용 clipboard/원래 관계 읽기 panel anchor 복귀. 첫 fit과 native panel wheel은 기록대로이며 숨은 state/API·DOM scroll 주입·force click은 쓰지 않았다.
- 정확 작성자 코드의 관련 6test만 실행: 1통과/5실패 exit1. 전체 12통과라고 보고하지 않는다. 초기에 test05 이름을 잘못 지정한 loader/setup 오류는 first-author-selector-error에 보존하고 실제 이름으로 수정했다. 제품 오류와 구별한다.

## 작성자 5실패의 구별

3개는 fix1과 같은 ‘설명 읽을 부분 찾기’→새 요청/인계→parent 복귀 호출행 anchor 단언 실패다. 실제 saved report/task가 삭제된 것은 아니며, 새 요청이 그 report의 child가 되면서 미조치 보고 목록에서 해당 row가 빠졌다. 첫 가시 항목으로 선택된 임시 anchor ID가 DOM에서 사라져 호출행은 원래 위치에 복원되지 않았다. root 수용 판정을 남겨두며 failure를 지우거나 새 기대값으로 통과시키지 않았다.

나머지 2개는 신규 test05 목록복귀에서 absolute scrollTop equality 실패다. raw상 안내 제거 뒤 body clientHeight가 약67.59px 증가하고 전체 scrollHeight는 그대로다. 1280 1333→1266,1440 1153→1086이며 복귀값은 새 max와 약0.31px 이내다. author-classification.json은 저장된 raw만으로 새 max/clamp를 재계산한 설명이다. 원래 author exit1/assert failure는 보존하며 이를 몰래 PASS로 바꾸지 않았다. 독립 중간 읽기 위치294/280의 보존과 끝부분 clamp 조건은 구별한다. 이 test05가 일찍 중단되어 뒤의 context/connection synthetic 회귀는 그 실행에서 미완주다. 독립 native Escape/Chromium composition 결과와 구별한다.

## 경계

격리 합성 import/MOCK/paid0. source-restated 입력은 원자료 실행/사람의 원발화를 의미하지 않는다. SOURCE_BINDING은 pinned 188 git files와 실행 후 바이트 동일이며 별도 HTTP GET은 compiled 응답-body/disk전후를 비교한다. 최초 page.goto body와 별도 audit를 혼동하지 않는다. pageerror/외부요청 []는 lifecycle에서 검증, console 전체 원문은 미수집이다. 실제 child/collector exit JSON을 참조한다. API state/long text/구형 anchor의 ba9 실행과 core 질문 e37 실행은 링크한 과거 실행이며 이번 실행인 척 합산하지 않는다. 같은 AreaID인 사본 프로젝트 간 읽기 오염 추가 순열·OS IME·touch·사람 연구·실제 AI/원프로젝트 실행은 미검증. 남은 anchor 실패가 있어 제품 전체 합격을 선언하지 않는다. MANIFEST는 본인 제외 정확 payload 집합이다.
