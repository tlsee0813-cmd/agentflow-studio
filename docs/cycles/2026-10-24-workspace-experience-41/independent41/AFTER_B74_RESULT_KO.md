# 경험41 독립 최종 관측 — 실행 b74 / checkout 684

**실행한 독립 대표 범위에서 이전 실패를 재현하지 않았다.** 선택 지도에서 이어가기, 첫 화면 편집, 다른 부분을 본 뒤 원작업 초안·커서 복귀, 반복 origin 복귀, 긴 이름 식별, 빈 새 프로젝트 진입이 정상이다. 결과 수신 안내와 선택 중인 파일도 다른 작업 이어가기 후 유지됐다. 전체 제품 수용과 CI 결과는 총괄 판단이며 이 문서는 그 판정을 대신하지 않는다.

실제 빌드·브라우저 실행 SHA는 `b74b2597a8d8ab8ab8feeda27a74867520ce130b`, app tree는 `80097aaf62afc1115c808fbe19f0d228173998fd`다. 실행 후 요청에 따라 checkout만 `6840496f2d4a41d7e396f0febea3cc4cb1f90702` / app tree `5f42a2c6f5cbdb295cbb7ad7a71a1e36275b66f9`로 전환했다. 차이는 `app/continuity/tests/branch-records31_browser.py` 하나다. 두 SHA의 src/public/build script/server Git 객체와 이미 실행 중인 normal dist 파일 bytes는 동일하다. 684에서 새로 빌드·브라우저 실행했다고 기록하지 않는다.

재사용 가능한 수치·해시·판정은 [최종 요약 JSON](afterb74/RESULT.json)에, checkout 전환의 동일성은 [684 delta](afterb74/CHECKOUT_684_DELTA.json)에 모았다. 중간 원시 JSON을 정리해도 이 두 파일에 아래 판정 근거가 남는다.

## 이전 실패와 현재 실제 화면

| 기준 | 이전 실패 | b74 독립 관측 |
|---|---|---|
| 편집이 첫 화면에 있는가 | e3 편집칸 y641.66..806.78 | 1280·1440에서 y365.81..665.81, 높이300px 전체 보임. 125% 상당에서 y383.81..559.81, 높이176px 전체 보임 |
| 복사 동작도 보이는가 | 편집칸 위치와 구별 필요 | 1280·1440 복사 y210.14..247.14, 125% 상당 y228.14..265.14. 복사 버튼 가시성을 편집칸 가시성으로 대신 판정하지 않음 |
| 긴 동일 접두 이름을 구별하는가 | e3·7cb 글자 축소 및 무공백 이름 경계 | 공백 있는 최대60자와 `가`56자+`예약변경`/`예약취소`를 같은6부분 geometry에서 관측. 1280·1440 이름15px, 125% 상당14.53px. 중간 생략 허용, 구별 끝4자 전체 clip/hit·패널 전체60자 접근 확인 |
| 두 번째 이후 origin이 남는가 | 7cb 활성화2/3부터 버튼 소실 | 세 크기에서 실제 입력 후 이어가기→origin을3회 반복. 매번 origin 버튼·선택 패널·카메라·선택·커서4..8 유지 |
| 페이지도 같은 지도 위치인가 | 42/c7 카메라 유지 중 page/header 이동 | zero 출발과 자연 wheel/명시 center 출발 모두 아래 수치로 일치 |
| 새 프로젝트 시작점이 맞는가 | 목적 위로 스크롤되고 요청 입력 초점 | 예제닫기→새프로젝트, 예제내프로젝트시작 모두 세 크기에서 scroll0·빈 목적 입력 초점·빈 작업문. 목적 입력과 영역 나누기 버튼 전체 첫 화면 |

대표 PNG 세 장을 직접 열어 보았다. 1280 선택 지도는660×500px이고 좌측 shell220px, 선택 패널300px이다. 선택 카드 이름과 연결선·패널이 서로 덮지 않았고 카드 본문으로 선택할 수 있다. 화면 밖 영역 안내와 선택 맥락이 남아 있다. 이 지도 폭으로 모든 영역을 동시에 보지는 못하지만, 선택한 부분을 읽고 작업으로 옮기는 경로는 성립한다. 작업 화면은 원문 한 줄과 복사·저장·선택형 파일 받기 뒤에 넓은 편집칸이 바로 보인다. 긴 무공백 이름의 125% 상당 화면에서도 구별 끝과 패널 전체 이름을 읽을 수 있다. 작은 카드의 설명이 생략되는 경우까지 설명12px 보장으로 확대하지 않는다.

- [1280 선택 지도](afterb74/after-1280-map-selected.png)
- [1280 이어가기 작업](afterb74/after-1280-work.png)
- [125% 상당 긴 무공백 이름](afterb74/nospace60-125equiv-selected.png)

## 페이지 위치와 보존 계약

zero 출발에서 초기 지도 y/높이와 프로젝트 이름 y는 1280 `204/500/60.25`, 1440 `204/680/60.25`, 125% 상당 `209/351/62.75`다. 세 번 모두 scroll0, 지도 rect, 프로젝트 헤더·이름 위치가 초기와 정확히 같다.

| 출발 조건 | 크기 | 출발 scrollY 1/2/3 | 복귀 scrollY 1/2/3 | 복귀 지도 높이 |
|---|---|---|---|---|
| 명시 center 후 native 좌표 click | 1280 |317/317/317|317/317/317|500|
| 명시 center 후 native 좌표 click | 1440 |319/319/319|319/319/319|680|
| 명시 center 후 native 좌표 click |125% 상당|245/245/245|245/245/245|351|
| 지도 위 자연 wheel120 후 native 좌표 click |1280|120/240/319|120/240/319|500|
| 지도 위 자연 wheel120 후 native 좌표 click |1440|120/240/319|120/240/319|680|
| 지도 위 자연 wheel120 후 native 좌표 click |125% 상당|120/240/327|120/240/327|351|

각 nonzero 복귀의 즉시·100ms·400ms scroll/map/name geometry가 실제 출발과 같고 카메라·선택·열린 패널도 유지된다. c7의 자연 wheel120→복귀240·지도높이704 실패와 다르다. document 좌표로 지도 높이를 정하는 후속12 규칙에 따라 nonzero 복귀 때 지도를 viewport 하단까지 재확장하지 않는 것은 총괄이 승인한 동작 변경이다.

동일한 원래 독립 합성6부분 백업을 정상 가져오기로 사용했다. 원본3개 fixture의 SHA256 동일성을 요약 JSON에 기록했다. 1280·1440에서 읽기/이어가기/긴 보고 읽기/미전송 다른 영역 초안 열기/편집 후 이동의 프로젝트 bytes 보존, 다른 영역 초안과 현재 작업·요청 대상, 원작업 입력·selection4..8, 카메라·선택·별도그룹 접힘·패널 memo를 확인했다. 예제 열기·닫기는 실제 프로젝트 bytes와 지도 memo를 바꾸지 않고 예제 localStorage 쓰기는0이다.

수신 경계는 작성자 fixture를 사용하지 않고 독립 요청A·현재작업B·정상 결과파일을 만들었다. 1280·1440에서 (1) 결과 수신 후 다른 작업A를 명시적으로 이어가도 수신 안내·결과 검토 버튼·compose/file 열림이 유지되고 정확한 수신 보고를 열 수 있으며, (2) 아직 받기 전 선택한 파일과 받기 동작도 유지된다. 두 경로 모두 source/task 기록이 보존됐다. 전체 received20 suite 실행으로 표현하지 않는다.

## 실행 환경과 범위

설치 Chrome155.0.8059.85, Playwright1.57.0, Python3.12.14, Node24.22.1, 기존 TypeScript5.8.3을 재사용했다. 새 dependency 설치·복제는 없다. 로컬 HTTP 서버는 명시 MOCK이며 외부 AI 실행/유료 호출은0이다. 예제·보존·이름·수신의 pageerror는0이고 관측한 외부 요청도0이다.

125% 상당은 **1024×576 CSS viewport + DPR1.25**로 구성한1280×720 물리 프레임이다. 브라우저 UI의 실제 페이지 줌 조작은 하지 않았다.

빌드는 app cwd에서 기존 Node로 `continuity/scripts/build.mjs`, 서버는 `node.exe continuity/server/index.mjs --mock`다. 서버 **http://127.0.0.1:50886 / PID34680**은 총괄 확인까지 유지한다. PID 명령도 재확인했다. 소스/tests 수정은 없으며 untracked cycle41을 전부 보존했다. static-preview-dist 빌드는 총괄이 별도로 수행했으며 독립 검증자는 수정하지 않았다.

독립 실행 명령은 전용 evidence cwd의 `startb74.py`, `runb74.py examples`, `runb74.py preserve`, `runb74.py 125example`, `repeat_scrollb74.py`, `nospaceb74.py`, `departureb74.py`, `receiptb74_fixture.mjs`, `receiptb74.py`다. 원래 독립 probe를 같은 fixture로 재사용했다. 최종 정리 `finalizeb74.py`는 기존 측정만 요약하며, `delta684.py`는 source 동일성을 검증하고 checkout만 수행한다.

전체 작성자 PC12/received20 등 회귀 suite, CI40056301818 결과 확인, 실제 browser UI zoom, 실제 외부 AI 실행, 사람 대상 이해도 조사는 이 독립 실행에서 하지 않았다. 이전 e3·7cb·42·c7 실패 기록은 역사로 유지한다.

## 최소 보관 권고

배포 검토용은 BEFORE 지도/작업2PNG + 위 최종3PNG, 이 보고서, `afterb74/RESULT.json`, `afterb74/CHECKOUT_684_DELTA.json`, 기존 실패 요약 문서면 충분하다. 재실행용은 원본 독립 fixture3JSON, 전용 evidence의 사용 probe와 helper(`after_example.py`, `after_preserve.py`, `after125.py` 포함), 수신 fixture 생성기를 별도 보관한다. dependency 사본은 필요 없다. 중간 중복 PNG·전체 raw 반복 JSON은 최종 요약에 수치·해시·범위가 남으므로 공유 묶음에서 제외할 수 있다.
