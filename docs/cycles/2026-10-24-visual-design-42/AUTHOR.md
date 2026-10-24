# VISUAL42 작성자 기록

총괄 정리: 아래는 작성자가 각 후보에서 반환한 기록이다. 중간 `candidate*.png` 11장은 [최종 코드 커밋의 원본 폴더](https://github.com/tlsee0813-cmd/agentflow-studio/tree/6cfbaf6fe35b26f3813f903c5bd75034e7b8b4c0/docs/cycles/2026-10-24-visual-design-42)에 보존하며 현재 tree에는 중복 보관하지 않는다. 최종 독립 화면은 [independent](independent/RESULT_KO.md), 최종 수용·CI는 [DECISION](DECISION.md)을 따른다.

기준 `b4566599e89412dfadb5041047729a759bb358b3` (app tree `5f42a2c6…`). 변경 범위는 `app/continuity`의 CSS·HTML·렌더 마크업과 테스트 한 줄이다. domain/storage/server/수신 형식은 바꾸지 않았다.

## 선택한 시각 변경 (첫 후보)

- **foundations**: `styles.css`를 한 번에 다시 작성했다. 역할 토큰(배경/표면/글자 3단/경계/강조 1색/상태), 간격 4·8·12·16·24·32, 컨트롤 높이 28/32/36, 모서리는 셸·붙은 패널 0, 컨트롤 7, 노드·카드 10이다. 기본 그림자는 없고 떠 있는 메뉴에만 쓴다. 강조색은 Dify 파랑이 아니라 차분한 남보라 `#4a43c2` 한 가지다. 과거에 같은 selector를 여러 세대에 걸쳐 덮어쓰던 override(.area-node 5회, .work-source·제목, 지도 헤더 등)를 9개 구역(foundations, controls, shell, home, map, area/task, work, dialogs, narrow)으로 통합했다. 모든 selector가 정확히 한 번만 정의되는 것은 아니다. 공통 규칙과 화면·상태별 규칙(예: `.area-panel` 기본과 PC 높이, 좁은 화면 media)은 의도적으로 나뉘어 있다. 글자: 이름 16/24·600, 본문 14/22, 메타 13/20, 작업문 입력 15/24. 시스템 글꼴과 한글 fallback(Apple SD Gothic Neo, Malgun Gothic, Noto Sans KR)을 쓰고, 글꼴이 하나뿐인 환경에서도 굵기가 보이도록 weight 합성만 허용했다. 새 의존성은 없다.
- **셸**: sidebar 222px 안에 작은 브랜드 한 줄, 작업 공간 한 줄, 16px SVG 탐색을 둔다. 슬로건 블록과 ↗ 글리프는 뺐다. 프로젝트 머리는 56px 헤더 한 줄로 옮겼다: 내 프로젝트 › 이름 입력 · 예제 표시(작은 배지와 한 문장, 두 행동) · 저장 상태 · 관리 메뉴 · 모드. PC에서는 모든 프로젝트 층이 같은 관리 메뉴를 쓴다(`syncProjectHeader`).
- **홈**: 제목, 한 줄 설명, 새 프로젝트를 같은 상단 행에 둔다. 빈 상태는 가운데 600px 시작 그룹이다(제목, 기존 빈 상태 문장, 새 프로젝트 행과 예제 행, 그 아래 백업 불러오기). 예제는 실제 프로젝트가 있을 때도 같은 시작 행으로 남는 보조 진입이다. 이름 없는 미리보기는 없다.
- **지도**: 목적 행(약 44px)과 도구 행(32px 컨트롤)을 거쳐 canvas와 선택 패널이 오른쪽 끝까지 이어지는 연속 면이 된다. 패널은 왼쪽 경계 한 줄로 붙는다. 노드는 240×180과 좌표를 그대로 두고, 안을 이름·이동 손잡이 행(SVG) / 소속 / 구상 / 읽기 이유 / 경계선 아래 하단 행(접기·앱 표시·열기 ›)으로 나눴다. 연결선은 차분한 점선, 점 격자는 글자보다 옅다.
- **작업**: 920px 문서 열 안에 경로와 지도 복귀, 상태 한 줄, 카드(제목 20, 소속, 원문 한 줄, 도구 한 행, 레이블이 붙은 편집 칸) 순서로 둔다. 이어가기 안내는 첫 줄에 고치는 대상만 보이고 정확한 문장은 ‘자세히’ 안에 있다. 작업문 칸은 내용 높이를 따르되 최소 160–208px이다.

## 검사 변경

`entry37_browser.py`에서 예제 카드 높이 ≥170 단언 하나를 바꿨다. 총괄이 빈 홈을 시작 행으로 정했기 때문이다. 대신 행 높이 ≥96과 새 프로젝트 행과의 x·폭 정렬(±1px)을 단언한다. 예제의 정확한 목적·이름 한 줄·메타·첫 화면·저장 0 단언은 그대로다. 다른 단언과 timeout은 바꾸지 않았다.

## 실행 (첫 후보 `50006905`)

이 컨테이너(Linux, Chromium 153, Python Playwright 1.57, Node 22.22):
- continuity check, Node 287/287, static/preview 빌드 통과.
- 변경 전 기준 SHA로 browser suite 29개 전체를 별도 worktree에서 돌렸고 모두 통과했다.
- 변경 후: WORK41, HOME15, ENTRY37, PC13 통과.
- 같은 checkout·dist의 전체 순차 회귀는 앞 18개 suite(browser~SOURCE40)까지 통과한 상태에서 중단했다. 후속3 수정과 섞이지 않게 하려는 것이다. REPORT16은 실행 도중 멈췄고, 나머지 10개는 이 SHA에서 실행하지 않았다. 따라서 500069 전체 통과라고 기록하지 않는다.

미실행: Windows/macOS 실제 글꼴, 실제 브라우저 125% 줌(1024×576 DPR1.25 상당만 확인), 사람 사용성.

대표 화면: `candidate1-1280x800-home.png`, `candidate1-1280x800-map-selected.png`, `candidate1-1280x800-work.png`.

## 후속3: 헤더 표시 결함 (독립 실행 결과 반영)

- 예제 이름 끝 글자 잘림: 이름 칸이 flex에서 줄어들었고, `field-sizing:content`도 실제 글자 폭보다 약 2px 좁았다(이 컨테이너에서 글자 165.2 vs 칸 163). 이름 칸이 줄어들지 않게 하고, 너비는 계산된 글꼴로 잰 글자 폭 + 6px로 렌더가 직접 맞춘다(`fitNameField`, 저장값 변화 없음). 긴 이름은 CSS 최대 폭 안에서 칸 안쪽으로 스크롤된다.
- 901px에서의 겹침: 헤더와 프로젝트 머리를 줄바꿈 가능하게 바꿨다. 예제 묶음(배지·안내·시작·닫기)은 붙어 있고, 좁은 PC에서는 다음 줄로 내려간다. 높이는 폭으로만 정해지므로 진입과 복귀 때 같다.
- 긴 비저장 문장은 항상 보이는 작은 배지 ‘예제 · 저장 안 됨’과 바로 옆 안내 disclosure(ⓘ, 키보드로 접근 가능)로 바꿨다. 기존 문장 ‘저장되지 않고, 내 프로젝트 목록에 섞이지 않아요.’는 그 안에 그대로 있다.
- 이 컨테이너의 실측(예제/60자 실제 이름): 901·1024에서 2줄(87/91px), 1100 이상에서 예제 56px. 겹침 0, 헤더 overflow 0, 이름 칸 내용 폭 172 ≥ 글자 165.2.
- `.gitignore`에 `static-preview-dist/` 한 줄을 추가했다(생성물은 commit하지 않음).
- 후속3 이후 실행: WORK41, ENTRY37, PC13, FLOW083 통과. HOME15는 5개 동시 실행 중 test_01이 config 응답 전에 모드 칩(‘모드 확인 중’)을 측정해 한 번 실패했고, 단독 재실행에서 통과했다(코드 결함 아님, 동시 부하 타이밍).
- 화면: `candidate2-1280x800-map-selected.png`, `candidate2-header-901.png`, `candidate2-header-1280.png`.

## 후속4·5: WORK29 복구, 밀도 정리, 좁은 화면 예제 묶음

- `43fa911` 정확 SHA 전체 회귀는 앞 10개 suite(browser~GUIDE097)까지 통과한 상태에서 중단했다(최종 SHA로 대체). 이 SHA 전체 통과라고 기록하지 않는다.
- WORK29 실패(CI ubuntu, 로컬 재현): 빈 작업문 칸이 내용 높이(208px)로 줄어 열린 참고 본문과 함께 보이는 높이가 113px이 됐고, 그 안에 참고 글줄이 없었다. 참고를 옆에 연 상태에서는 작업문 칸 최소 높이를 `clamp(240px,100vh-400px,320px)`로 두어 함께 읽고 쓰는 배치를 복구했다. 테스트는 바꾸지 않았다.
- 선택 패널 ‘이어갈 작업’: 작업 이름+앱 표시 한 줄, 요지, 그리고 항상 보이는 짧은 소유 줄 ‘작업 02 편집 · 작업 01 원문 유지’. 정확한 문장(‘고치는 대상 · …’)과 이어가기 규칙은 같은 줄의 키보드 disclosure 안에 그대로 있다(`#panel-continue-target`).
- 작업 도구 행: 복사·Markdown 저장이 주 그룹이다. 다시 정리, 전체 보기, 결과 파일 선택은 구분선 뒤의 조용한 보조 그룹이고 메뉴에 숨기지 않는다. 작업문 작성자 표시(`#instruction-author`)는 ‘실행 도구에 전달할 작업문’ 레이블 옆으로 옮겼다. id와 handler는 그대로다.
- 360px 넘침: 900px 이하에서만 예제 묶음이 헤더 폭 안에서 줄바꿈하고, 이름은 전체 폭을 쓰며, 안내 popover는 묶음 왼쪽에서 `min(280px,100vw-32px)`로 열린다. 360/390에서 문서 폭이 viewport와 같고 popover는 16–296px이다. 901·1000·1024·1100·1280·1440 헤더 실측은 그대로(겹침 0, 이름 칸 172 ≥ 글자 165.2).
- 지도 화면 밖 카드: 자동 맞춤이나 좌표 변경은 하지 않는다. 기존 ‘화면 밖 영역 N개 · 모두 보기’를 유지한다.
- 화면: `candidate3-1280x800-work.png`, `candidate3-1280x800-map-selected.png`, `candidate3-header-360.png`.

## 후속5 이후: Windows UI001 경합 수정

- `43fa911` Windows CI UI001 test_ui10: 테스트가 390→1440으로 넓힌 직후 `#backup`을 확인하는 사이에 resize 처리기가 PC 관리 메뉴를 닫아 `#backup`이 숨었다. 원인은 이 PR이 관리 메뉴를 모든 PC 층으로 넓힌 것이다. 좁은 화면에서 열려 있던 메뉴는 창을 넓혀도 열린 채 dropdown이 되고, 기존 바깥 클릭 처리기로 닫힌다. 테스트는 바꾸지 않았다.
- `7a471de` 전체 회귀는 앞 5개 suite(browser~CONNECT039)가 통과한 상태에서 중단했다(이 수정 SHA로 대체).

## 후속6·7: 정적 미리보기의 헤더 겹침과 모드 popover

- 원인: static preview의 모드 표시 ‘미리보기 · 브라우저 MOCK · AI 아님’은 일반 서버 표시보다 약 95px 넓다. 901px에서 예제 묶음(flex:none)이 프로젝트 머리보다 넓어져 ‘예제 닫기’ 아래로 모드 칩이 겹쳤다. 폰트 차이만의 문제가 아니었다. 표시 문구는 줄이지 않았다.
- 수정: 예제 묶음은 머리 폭을 넘지 않고 그 안에서 줄바꿈한다. 프로젝트 머리는 최소 기준 폭 360px를 갖고, 남는 폭이 그보다 작으면 모드 칩이 다음 줄로 내려간다. 이름 칸 측정은 letter-spacing도 반영한다.
- 모드 popover(800px 이하): 칩이 아니라 그 줄 전체(홈 머리, 헤더)에 붙어 오른쪽으로 정렬되므로, 칩 위치나 문구 길이와 상관없이 화면 안에 있다.
- 실제 `build-static --preview` 산출물을 `/agentflow-studio/preview/`로 서비스해 측정했다. 예제 헤더는 901/950/1000/1024/1100/1280/1440에서 겹침 0, 이름 잘림 0, 문서 가로 넘침 0이다. 헤더 높이는 901: 123px(3줄), 950–1100: 87px, 1280/1440: 56px이다. 홈·프로젝트 모드 popover는 360에서 24–344, 390에서 54–374, 800에서 464–784로 열린다. 예제 안내는 360/390에서 16–296이다. 일반 서버에서도 기본 글꼴과 DejaVu/Liberation 강제, letter-spacing +0.05em 조건으로 901–1440 겹침 0이다.
- 이 수정 뒤 STATIC, HIERARCHY18, HOME15, ENTRY37, WORK41, UI001 통과. `2aec20e` 전체 회귀는 앞 15개 suite(browser~HOME15)가 통과한 상태에서 중단했다(이 수정 SHA로 대체).
- 화면: `candidate4-preview-header-901.png`, `candidate4-preview-home-popover-360.png`.

## 후속9~11: 전체 회귀가 발견한 세 경계 — caf6126

총괄이 Claude 메시지24의 반환을 정리했다. 정확 `6cfbaf6`의 격리 전체29 suite는26통과·3실패로 끝났다. 통과는 browser, UI001, FRESH033, SELECT035, CONNECT039, FLOW049, AI055, FLOW083, FLOW090, GUIDE097, SPATIAL102, USE106, PC12, PC13, HOME15, ENTRY37, WORK41, SOURCE40, REPORT16, WORK29, HIERARCHY18, WORKSPACE19, RECEIVED20, BLANK21, VIEWPORT30, STATIC이다. AREA17 Wide3건(화면 밖 준비), BRANCH31 2건(native page wheel 준비), MAP36 4건(독립 영역 clip)은 실패했다.

- BRANCH31: 이전 셸 여백 x1260/1420이 새 패널 내부가 됐다.1280에서 패널82px/page0,1440은 스크롤이 없었다. 빈 도구행 자체 hit를 확인하는 x1264/1424,y180.5 native wheel120으로 준비를 바꿔 양폭 page120·native scrollend를 확인했다. 문서120여유·page≥119·원클릭/두frame/카메라/상태 단언은 유지했다.
- AREA17: zoom만으로 offscreen이 되던 baseline과 달리 새 지도에서 후속 pan이 실제 실행돼 native text drag 취소가 드러났다. 수정 전후 비교는 작성자 주장이고, 현재6cf의 동일 기전은 별도 Windows 독립 실행도 확인했다. canvas user-select:none으로 고쳤다. 수정 뒤 두 번째 pan도260px(camera x−491→−751),카드x207<map left222다. 기존 AREA17 검사 그대로 통과했다.
- MAP36:68%에서 소속 line bottom294가clip bottom291을3px 넘었다. reading reason13/18과두꺼운foot이 원인이라12/16·20px controls·작은foot여백으로 고쳤다. 기존 가독성 검사·240×180카드·좌표·카메라는 그대로다.

수정은 `caf6126a4a2e592dc4f17626f0440d13a1d4c188` / app tree `9ba47af6a58cf97d717e743a862553ea2cf1053d`에 고정했다. 변경 파일은 styles.css와 테스트 helper/호출부 두 파일뿐이다. 변경 직전 working tree에서 BRANCH31, AREA17, MAP36, WORK41, RECEIVED20, PC13, HIERARCHY18, VIEWPORT30, SPATIAL102, ENTRY37, PC12, REPORT16, FLOW090, WORKSPACE19가 통과했고 그대로 commit했다. clean caf의 check·continuity check·Node287/287·static/preview build도 통과했다. caf 전체29 suite와 양OS CI는 이 반환 시점에 진행 중이며 완료 결과는 DECISION에 별도로 기록한다. 이전 실행/waiter는 모두 종료하고 caf 한 실행/waiter만 유지했다.

최종 caf 전체 회귀 반환: 격리된 정확 SHA checkout/build에서29 browser suite 모두통과. 컨테이너재시작 전10개(browser,UI001,FRESH033,SELECT035,CONNECT039,FLOW049,AI055,FLOW083,FLOW090,GUIDE097)와 같은checkout/build에서 재개한19개(SPATIAL102,USE106,PC12,PC13,HOME15,ENTRY37,WORK41,SOURCE40,REPORT16,AREA17,WORK29,BRANCH31,MAP36,HIERARCHY18,WORKSPACE19,RECEIVED20,BLANK21,VIEWPORT30,STATIC)를구분한다. 앞10개를반복하지않았다. 원래app npm test는작성자에서실행하지않고CI에맡겼다. 전체수행은작성자반환이며독립Windows/Cloud/CI와구분한다.
