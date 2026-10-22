# 30 PhaseA · 정확27 원제품 가설 관측

**작업의 깊은 scroll에서 전체 공간으로 진입할 때 지도 컨테이너 높이가 남는 반례를 양PC에서 재현했다. 제품·후보 수정 없이 종료한다.** 계약 a1774610, 원제품6b96543f(app55be6a0a/CSS86dda3/HTMLc3981c). 29소스/검사/CI와 별개다. 기존28 c6b3b224의 정상UI6/4영역 백업과 실제H기반P return.2·도구를 고정해 사용했다.

|조건|1280×720 map top/height/bottom|1440×900 map top/height/bottom|
|---|---|---|
|6영역 작업scroll0→직접전체공간|268.890625 / 435.109375 / 704|268.890625 / 615.109375 / 884|
|같은6영역 실제wheel scroll1200→직접전체공간|268.890625 / 704 / 972.890625|268.890625 / 884 / 1152.890625|

각각 새격리context, 동일한 저장완료 준비, 이후 같은 #nav-space 정상click이다. 클릭뒤 `UI.map()/state()/saved()`·추가scroll·fit·close·visibleInfo를 사용하지 않고 첫 결과를 기록했다. 첫 관측뒤 두 native frame에서도 깊은 경우 초과가 유지됐다. 모든 완료trial에서 진입camera/mapmemo 및 프로젝트데이터가 그대로였다. import 자체가 이미 최초카메라를 만든다: 1280 s0.6192307692,1440 s0.9508771930. 이 기존카메라의 work→space 관측을 최초camera 생성실패로 바꾸지 않았고 기억 삭제도 하지 않았다. 초기import rect/memo와 이후진입 raw는 분리했다.

## 회복과 반증 대조(1280만)
- 새 재현 뒤 **맞춤만** 누르면 height704/bottom972.890625 유지. 카메라는0.61923→0.81053으로 바뀌고 정보버튼 fullclip+hit은6/6→3/6이 됐다. 아래3개정보버튼 bottom734.10은viewport720밖이다. 잘못남은컨테이너를 기준으로 맞춘 장면이며 모든fit 고장으로 일반화하지 않는다.
- 다른 새재현에서 fit없이 실제width1280→1279 resize를 하면 height435.109375/bottom704로 회복, 카메라/memo 유지. 보이는정보버튼 정상click·패널표시·선택대상도 확인했다.
- 원래 깊은진입 직후에는 기존작은카메라 덕분에 정보버튼 **6/6이 여전히 clip/hit 안**이었다. 컨테이너초과를 모든카드접근불능으로 과장하지 않는다. 원상태를 보존한 뒤 보이는버튼으로 클릭한 별도재확인에서는 정상render후 height도 회복했다.

## 목록 open과 사건순서
4카드 import의 기본open=true와 정상UI로열림을기억한상태,6카드의열림기억 대조는 최종height435.109375/bottom704였다. PC의 area-list는 display:none이므로 명시기억대조는 **준비단계에서 실제viewport700px→기존목록 summary 정상닫기/열기→PC원폭복원**을 썼다. JSON/property 주입아님. 이다른준비를 원6카드닫힘 조건과 같은조건이라고부르지 않는다. 4카드는 import의 native기본open부터 기억될수있어 이후첫work진입을 미기억첫상태로꾸미지 않았다.

별도읽기전용trace의 6닫힘: workY1200 click→DOM 첫height704/y0→scrollend→project-management toggle, height수리없음(saving계속없음). 4기본open: click→DOM height704/y0→scrollend→DOM height435.109→area-list toggle관측. 제품의 document-capture listener가 계측listener보다먼저등록돼 callback기록시점에는기하가이미변해있을수있다. 이사건순서와소스상측정/scroll복원순서는가설과일치하지만 **DOM만으로 renderStatus 또는 특정함수의 실제호출을확정하지 않는다**. 4의자동회복도숨기지않았다. trace후계측없는6닫힘을다시확인해동일초과를재현했다. observer/rect읽기와첫click직후관측의시간영향은이구분밖으로일반화하지않는다.

## 원본오류·종료·보존
첫실행은5trial완료후resize분기의 `wait_for_function` 인자전달 TypeError로중단(child/collector1). 원코드·오류·부분resize raw 그대로보존. 별도continuation은준비인자만정정하여남은6trial완료(fatal없음), 실제기하실패때문에child/collector1. 별도4trace1trial은child/collector0. 세실행을하나의12무오류실행으로세지않는다. 오프라인원인표집계도실패판정exit1이며추가UI실행아님.

동적PW1.57/Chromium154.0.8037.57/Node22.16/TS5.8.3. 서버는각실행후명시terminate, 실제−15로child와분리. pageerror/consoleerror/cleanup0, POST0/paidAI0. HTTP195응답의body/disk실행중/종료후hash일치. 기존정확27 compiled resource와도바이트동일, 새build/29재사용성공으로포장하지않았다. 영역/관계/포함/좌표/수동값/설명/과거H/원보고/current/draft는프로젝트정규hash로모든완료trial전후불변. UI정보선택/명시fit은의도된memo변경이며원진입불변과별도로raw기록.

원인표 CAUSE_TABLE, 사건순서 EVENT_ORDER, 실행분리 RUN_INDEX, 첫오류 process/traceback, 전체raw 및 실제PNG3장을공유한다. PC1440 회복/목록기억추가순열·새제품후보·수정·전체회귀·인간가독성/초행사용성·AI의미성공은미실행. 가장작은양PC반례와1280원인대조로멈췄다. 큰JSON/JSONL은무손실gzip·원hash/재해제검증 RAW_INDEX. 공유코드/입력은hash별1벌, MANIFEST는자기제외정확집합이다.
