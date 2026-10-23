# 36 합성 merge65cd 독립 검증

실행 소스는 `65cd96d9da53753e70dba350bdf62c5d68474809`로 고정했다. 부모 `395df224…`+`c04c9d00…`, app subtree `66d79f03d9884fa5d06252c7d9ad7fdc9322e231`를 직접 확인했다. 후속 head `a17cbcf9804154b878ccf20dfa4d5155777ce7ca`는 실행하지 않았다. Git fetch/소스 비교로 app subtree 동일, 전체 차이는 ACTIVE.md 1개 수정·삭제0임만 확인했다. CI는 조회하지 않았고 checkpoint 수용을 선언하지 않는다.

환경: 기존 Node22.16.0 / TS5.8.3(PATH compiler, npm ci 아님) / Playwright1.57.0 / system Chromium154.0.8037.57. 폰트 설치·제품/검사 수정·유료AI·배포 없음. 타입/root/continuity/demo/--preview 빌드 각 child0. 실제 preview 17파일을 artifact/에 원bytes 그대로 제공한다. 데모와 client/static-target.js만 다르고 CSP connect-src none, closure17을 확인했다.

## A. 원반례 → 수정본

원본 `5f9da8d47f76084b3e7a3e14a9e7ad82841a6aae`의 sample과 check.py/gate.py는 바이트 그대로 재사용했다. REPORT36_APP만 merge65cd로 선택해 표준 MOCK runtime에서 실행했다. L/O 파일은 정상 chooser로 수신했다. 말단 L·접힌 부모 P에 generic 기록 버튼이 생기고 정확 L 보고·실제 소유 집합을 읽었다. O는 관계-only라 P에서 제외된다. 현재 P·manual4·기존 task/H/원보고·읽기 후 저장본/카메라 보존 검사도 그대로 통과했다.

원후보: 수집0, generic 입구 조건실패 gate1. 수정 merge: 수집0, 같은 gate0. 원본 실패를 덮지 않았다. frozen checker의 raw source 문자열 c0와 frozen collector의 meaning='original failure'는 옛 리터럴로 남아 있다. 실제 대상/env·소스 SHA·실제 exit0은 SOURCE_BINDING/종료자료에 별도 연결했으며 c0를 다시 실행하거나 새 실패로 오독하지 않는다.

## B. 실제 static --preview 표시

1280×720·1440×900에서 T2/db5 고정 자료와 공개34 API fixture를 사용했다. 총8 context(T2/db5/부모구상 있음·없음 각 양PC), 12표시 장면(경계의 펼침/접힘 포함)이다. 거대 추가 grid는 만들지 않았다. 복구/결과 파일은 정상 chooser와 명시 가져오기로 준비했다. 이번 탭 갱신은 실제 설명 수신이다. db5 P는 적용 entry revision1→2, S는 held-only이며 갱신으로 세지 않았다. 경계 B/P도 실제 수신 후 측정했다.

고정 장면에서 현재작업+자기갱신 부모의 구상 있음·없음/접힘·펼침 모두 기존 controls와 네 이유가 카드/실제 overflow clip 안이고 center hit도 유지됐다. 이유는 현재 미답·설명 보류·이전 기준 **설명**·이번 탭 갱신으로 구별되고 ‘외 N개’로 합치지 않았다. 카드180px·저장 좌표·font size는 유지됐다. 옛 수줄은 숨은 overflow가 아니라 이번36 계약대로 정보 패널에 명시 이동했다.

실제 PNG에서 db5 구별 단어 ‘상위 구성/관계만 존재/오류행 구분/보류만 존재’가 제목3줄 안에 보인다. 다만 이름 끝은 여전히 잘리고, 자식의 소속 줄은 공통 접두어+부모 첫 글자 수준이라 비슷한 두 부모를 정확히 구별하는 증거가 아니다(이 입력 부모 하나). 역할/구상은2줄까지만 보인다. 전체 목적도 고정 지도 문장/PNG로 남겼다. 이 제한을 통과 숫자로 지우지 않는다.

기본 맞춤은 T2 68%/95%, db5 73%/120%, 34경계56%/85%였다. 작은 글씨는 화면6~8px 수준까지 줄어들며 배치/버튼 hit 통과를 가독성·사람 이해 성공으로 확대하지 않는다. raw char Range의 full=false는 짧은 line-height와 glyph linebox의 위·아래 초과도 포함한다. rangeVisibleText가 중간 줄만/빈 문자열이라고 실제 글자 전부 소실로 판단하지 않았다. 원Range/clip·개별 hit와 native PNG를 함께 보존했다. 별도 잉크 분할 판정은 미실행이다.

## C. 대표 기록 왕복 (db5 각 PC)

접힌 P의 신호→기록 reader에서 정확 전체 집합을 대조했다. 질문은 qStaleOwn/qRealAnswered/qExactTrial/qActiveLeaf 네 task, 보고는 새 P_CURRENT+Q_STALE 두 실제 return task, 설명 소유자는 P/Q/S 세 영역이다. 제목은 ‘질문4 · 설명3’, 관계-only B는 집합에 없다. trial-context 생성 질문은 제외됐고, 실제 질문의 정확 시험답변은 N에 남되 현재 미답 M에는 제외됐다. M은 active && !answered인 qActiveLeaf 하나다. 읽기 이유와 generic 기록 존재를 혼동하지 않는다.

내부 native wheel로 모든 기록 구간을 지나 ‘요청1개 · 돌아온 결과2개 · 앱미검증’ 수줄까지 읽었다(이는 P 자기 요청/결과 수, 하위 합계 아님). 양PC에서 실제 count line이 panel clip 안에 완전히 들어온 원시 rect를 확인했다. 새 P 보고의 정확 ID로 read-only 진입 후 명시 원지도 복귀, panel scroll·원호출 초점·카메라·접힘·선택/pageY를 대조했다. 닫으면 원 P 카드 신호로 초점이 돌아왔다. 이어 B 기록을 한 번 열고 닫아 다른 owner로의 누출이 없음을 확인했다.

현재 B/별도 Q 대상 미전송 draft/manual4/과거 H/raw/구상·기준·관계는 불변이다. 읽기전·report reader 중·닫은 뒤·다른 owner 뒤 project 원bytes가 같았다. native C 탐색에는 fit/resize/DOM scroll/focus 보정을 넣지 않았다. 준비용 fit은 기준 저장 전에만 수행했다.

준비 파일 구역의 일부 summary/accept/file 버튼은 클릭 직전 viewport 밖이었다. Playwright 실제 click의 내장 autoscroll로 접근했고 그 전후 page/focus/rect를 원시 events에 남겼다. 이것을 무스크롤 발견성이나 원상태 노출 성공으로 세지 않았다. C의 읽기 이동은 native panel wheel이며 클릭실패는 없었다. UI source/DOM/store 주입·force·고정 sleep 없음. 기존 저장완료 polling과 scrollend deadline은 관측/완료대기다.

## D. 별도 exact 작성자 검사

|검사|실제 결과|
|---|---|
|map-priority36_browser.py|12개, child0|
|branch-records31_browser.py|10개, child0|
|hierarchy18_browser.py|12개, child0|
|static_browser.py|3개, child0|

네 프로세스는 앞 실패로 뒤가 skip되지 않도록 독립 실행했다. 원문 stdout/stderr/source hash/명령·시작끝·exit를 보존했다. 이 합성 domain fixture 검사와 독립 UI 장면을 하나의 성공 수로 합산하지 않는다. static quota는 표적 fault이며 실제 공유 origin 용량 해결 주장이 아니다.

## 증거와 경계

artifact/17파일은 실제 HTTP module body 길이/SHA↔build disk 전후 SHA에 연결했다. SOURCE_BINDING/ARTIFACT_MANIFEST/MANIFEST는 직접 회수 가능하다. 대표 PNG6장, 나머지 큰 raw/상태/JSONL은 무손실 gzip과 원bytes/SHA·해제동일성을 보존했다. app/server/node_modules 전체 복제 없음. 수집/조건/설정 실패를 분리했다. 후행 projection 첫 checker가 current.revision을 읽어 exit1이었고 실제 경로 current.entry.revision으로만 교정해 exit0, 원코드는 보존했다. UI는 재실행하지 않았다. static HTTP server -15는 완료 후 의도적 종료다.

이번 고정 장면에서는 새 중요 결함을 발견하지 못했다. 전체 사용성/블라인드·사람 연구/임의 배율/모바일/Windows·CI/공개 배포는 미검증이며, 작은 글씨·긴 이름·소속 생략 비용은 남는다. 최종 통합은 총괄 판단이다.
