# 기록 신호 page-entry fix2 독립 비교

정확 후보 `6f264cbef15485a120614a8004f48ef05a59065d` (parent7c7, tree `4fd371534862452156b86563d5dd1f572d662ab0`). app276739B/SHA256 `7c63a494627b1ce2da8f089573f4116b17ba04e4af4531f6e2d315ccacee2e0e`, blob `8ee7ce15373ca309364e87a6277a59cddebd3e39`. 원격 객체에서 별도 추출/정상 build했고 전후 소스 변경0입니다. 제품 수정/새 설치/CI 조회는 하지 않았습니다.

## 동결 반례 검사

원본84dd92의 checker SHA256 **c282c96dd420ca542037e256f9b6015945b74423201c254882f5149445b6f67a**를 바이트 그대로 실행했습니다. source/output 환경 선택만 새 후보로 바뀌었습니다. 이전과 같은 P 기록 메모가 남고 패널은 닫혀 있는 상태, 별도 현재B/미전송Q, 같은 이름 다른 부모가 있는 정상UI 준비입니다. 첫 baseline 이후 fit/resize/강제 scroll/focus/DOM 수리는 없습니다. P 신호는 reach 없이 이미 full clip/hit인 상태에서 실제 native click했습니다.

| PC | 원본7c7 첫 동기 pageY | 후보 첫 동기 | 후보 두 native frames | 문서scrollend 뒤 |
|---|---|---|---|---|
| 1280×720 | 120→116 | 120→120 | 120 / 120 | 120 |
| 1440×900 | 120→0 | 120→120 | 120 / 120 | 120 |

원본의 반증 단언은 유지했고 후보 양PC 모두 통과했습니다. 첫 원본은 exit1/1, 이번 동결 검사 child/collector **0/0**입니다. 후보에서는 #document와 area-panel-body의 scrollend를 각각 관측했습니다. 같은 trustedclick bubble 첫동기·두 rAF·문서scrollend의 raw와 before/max/document/map/panel/disclosures/focus가 별도로 있습니다. 정확 P 기록과 첫 소유자 글줄의 Range/전체조상 clip/hit 양성, computed camera/fold 및 전체 project(currentB/draftQ 포함) 불변입니다. 신호가 선택을 P로 바꾸는 의도된 결과도 따로 검사했습니다.

이 비교는 관측된 진입 page 이동 해소의 한정 증거입니다. 원본 이동의 엔진/최대스크롤/중간 레이아웃 원인을 확정하지 않습니다. 원본 전체 실패 자료는 기존 `84dd92fb8112baecb73ac879cd434ebd78d23eb3/docs/transfer/branch-records-31/independent-a/page-entry-base/`에 그대로 있습니다.

## 조건부 두 교차흐름

동결 검사가 통과한 뒤에만 기존463fa와 같은 두 흐름을 양PC에서 실행했습니다. cross-flows/check.py는 source metadata 한곳만 새 SHA로 바꿨고 정상 UI 행동/단언은 그대로입니다. 일반전체진입은 명시원점복귀와 구분합니다.

| PC | 일반 nav-space 첫동기 map bottom | 명시 origin pageY | 호출행 viewport y | 패널scrollTop |
|---|---|---|---|---|
| 1280×720 | 704 | 120→120 | 281.625→281.625 | 551→551 |
| 1440×900 | 884 | 120→120 | 281.625→281.625 | 551→551 |

부모신호→긴 하위기록→정확H 보고/작업 깊은 native읽기→일반 nav-space의 첫동기 높이/하단과 카메라·선택·접힘·패널읽기 보존을 확인했습니다. 일반진입 뒤 닫기는 이전 신호caller가 아닌 정상 info로 복귀했습니다. 두번째 흐름은 실제 공간 pageY120 wheel→부모신호→정확보고→명시 원점복귀이며 이번에는 실제 보고 호출 기준도 양PC120입니다. 원호출행의 전체 clip/hit·초점·y·disclosures·읽기scroll을 복귀 직후 보정 없이 확인했습니다. 이후 패널닫기는 실제 원 부모signal로 복귀합니다. cross-flows child/collector **0/0**, 두PC×두흐름 완주, fatal/pageerror/cleanup0입니다. 준비/끝 전체 project snapshot은 동일해 current/draft/원문/H/구상/자료도 불변입니다.

## 바인딩과 범위

Node22.16.0 / TypeScript5.8.3 / Playwright1.57.0 / 실제 Chromium154.0.8037.57. typecheck/root build/continuity build 각exit0. 각 실행 runtime.json의 실제 loopback HTTP body↔실행 dist↔종료후 disk SHA는 모두 일치합니다. paidAI0이며 sourcebefore/after/검사해시/UTC/actualURL/process raw를 연결했습니다. 서버 종료는 원래 cleanup의 terminate 실제 -15로, child/collector0과 구별합니다. OUTER_EXIT_RECEIPT는 tool 완료metadata 전사이지 전체 tool transcript가 아닙니다.

원본84dd92는 수정/복제하지 않았습니다. 신규8검사 전체/29·30·31 fullmatrix/CI/사람사용성/실제AI는 이번 미실행입니다. 대표 PNG는 동결검사2+교차흐름4, 큰 JSON/JSONL은 원hash/압축hash/재해제 byte동등의 RAW_INDEX와 함께 무손실 gzip입니다. MANIFEST는 자신을 제외한 정확 payload집합이며 제품소스/build/node_modules는 넣지 않았습니다.
