# Cycle19 독립 실행 — 실패 보존, 수용 보류

최신 검사 head **81d50c72f6e4182b04d3b00576e9ae662c16cac2**. 제품은 최초 **8c46dc72057237cbc05da837ee75b3807969f9ef**와 동일하다. **9fb83ef50252d56c6411c81a0dca56d99becd651**은 검사/CI13파일,81d는 W19 test03만 변경. `FINAL_IDENTITY.json`에서 세 제품 파일 Git-object↔각 작업사본 바이트와 SHA를 확인했다. 변경 전후 원본 소스 전부 불변. 연구 계약은664129bf338017a5f0eddf899cff5db36e4762a5의 INPUT이다.

## 실패와 원인

- **제품 결함 — 안내 제거 뒤 stale 지도 높이**: 정상 이름 입력이 가져오기 안내를 지우면 지도 top은292.484375→224.890625지만 높이411.515625/591.515625가 남는다. 다음 사용자 행동 없이100/400/1000ms 표본에서도 동일. 다음 정상 records render에서479.109375/659.109375로 늘어난다. 양PC67.59375px의 불필요한 여백이 지속된다. 기록 열기가 높이를 빼앗은 현상으로 해석하지 않는다. 원본 test01 정확 동등 FAIL은 유지한다.
- **검사 시점 경계 — native brief-edit toggle**: 정상 닫기 click 반환 때 open=false이나 앞선 펼침 높이를 읽을 수 있다. 별도 읽기전용 document-capture/target toggle 관측은 앱 handler 이후 닫힌 높이가 됨을 보였다. 클릭반환→document→target의 performance/event timestamps와 실제 높이는 `failure-first/toggle-event-order-addendum/raw/result.json`에 있다. 원래 test03 40% FAIL을 고치거나 PASS로 재분류해 실행기록을 덮지 않았다. CSS공식 복제·무조건 sleep 성공규칙은 사용하지 않았다.
- W19 원본9fb **6실행/4실패**, 최종81d도 **6실행/4실패**, 실제 child/외부collector **1**. test01/03은 실패 지점 이후 중단되므로 해당 suite의 모든 후속 장면이 실행됐다는 뜻이 아니다. 독립 성공이나 예전 주기/작성자 수치와 합산하지 않는다. 최종 제품 합격을 선언하지 않는다.

## 수행 범위

**독립 core — 최초8c46 실행, 제품 동일성으로 연결**: source-restated PowerToys/product13×1280×720/1440×900 네 흐름. 추가 요청/보고는 모두 합성으로 표시했다. 실제1→5/8기록·읽기 전후 map top/height/camera, native zoom/fit/pan, 실제 기록 끝 native End/wheel, 정확 보고 read-only, owner→관계 실제 끝점→새 request count+1/id/area/body→실제 OS clipboard와 다운로드→FIRST records 호출행 복귀, A 미저장 구상 보존을 확인했다. 반환 직후 보조 이동 전 raw card/path/computed matrix/선택/가지/body scroll/focus를 보존했다. 관계 ID는 중복제거 전 배열과 기대 배열을 남겼고 자동 단언은 개수/중복 및 실제 클릭한 끝점이다. 모든 관계 종류/방향의 전수 자동 대조를 주장하지 않는다.

**독립 경계**: 두PC에서 사라진 보고의 원문 보존/가짜행 없음/records-heading 초점/고정 안내, 실제 branch-toggle 후 안내 유지; 살아있는 R1→ownerA 이후 unrelated B info·nav-work→space·명시records 재열기의 세 reset 경로; A 미저장 구상 격리를 확인했다. 초기 경계6실행 중 purpose 장면은 자체 짧은 대기/닫힌 관리메뉴 접근 오류가 있어 exit1이며 원형 보존했다. 보완한 **목적 전용2실행**은 실제 records native scroll>0에서 목적창 End/wheel→전문 tail Range+clip+hit→닫기/Escape 후 모드/선택/카메라/행raw rect(양PC x/y/w/h delta0)/body scroll/호출초점/저장/미저장구상을 보존했다. 닫힌 관리메뉴를 정상 재열어 backup 다운로드/import filechooser, Home 전체 이름/목적 modal과 more버튼 초점을 확인했다. 이전 성공과 합쳐 단일 완주라고 표시하지 않는다.

**보완 최소 관측**: 두PC records native 비초기 읽기→프로젝트목록→같은 프로젝트는 mode/selected/computed camera/행 상대위치와 저장을 보존. 이 마지막 추가의 실제 child0은 collector가 수집했지만 외부 shell 마지막 명령이 별도 receipt cat이어서 collector 자체 외부 종료 관측은 별도 미제공으로 구분했다. **390 최소2입력**의 records 접근/휠·키 이동/정확 report 복귀/일반 Escape, synthetic composing·consumed Escape 보호, 가로 문서 넘침 없음과 실제 잘못된 복구 파일 거절(안내 full clip+3hit 및 원본 불변)을 확인했다. 실제 OS IME/모바일 전체 경험은 미검증이다.

**exact9fb 관련 실행**(81d에서 해당 파일 모두 동일): type/build/continuity type/build/domain261/261/static-build 각 child0. PC12 **15**, PC13 **14**, HOME15 **21**, REPORT16 **13**, AREA17 **12**, H18 **12** 각 child0. 작성자 스크립트를 실제 실행한 회귀이며 독립 장면 수로 합산하지 않는다. static browser/역사적 전체 suite는 이번 범위에서 미실행. 로그와 명령별 시작/끝/실제 반환값은 `regressions-9fb/author-commands/process.json`; 외부 collector 실제 종료는 W19 실패를 전파하여1이다.

## 실행·자료 경계

Node22.16.0/TS5.8.3/Playwright1.57.0/실행 Chromium154.0.8037.57. 새 설치 없이 기존 PATH compiler 사용, npm-ci 아님. 실제 loopback HTTP→Chromium/MOCK. core 최초 goto200/body와 실행 disk SHA, 9fb/81d의 compiled HTTP runtime16파일 SHA를 각각 저장했다. OS clipboard raw와 다운로드 파일 bytes/SHA/returnId/anchor를 구분했다. 자체 core console 기록은4context 모두[]이고 pageerror 목록은 실행한 독립 장면에서[]. 이름붙은 회귀의 pageerror guard 통과를 근거로 전체 console 관측0을 발명하지 않는다. paid provider0, 배포/제품/다른 branch 변경 없음.

첫 width-overconstraint/다운로드 추가 중 syntax error/초기 목적 짧은 대기·닫힌 메뉴 오류와81d의 base dist 미빌드 setUpClass0실행 exit5는 검사·준비 오류로 보존한다. 최초81d 준비 이후 필요한 base build를 수행해 같은 원본 W19를6실행했다. 제품3파일이나 작성자 검사 단언을 수정하지 않았다.

`MANIFEST.tsv`는 이 prefix의 전체 payload 정확 집합을 포함하며 **루트 MANIFEST 자신만 제외**, 하위 선공유 manifest도 payload로 포함한다. 하위 manifest는 각각 당시 전송 batch 기준이다. 회귀의 비대표 자동 PNG는 원형 cloud scratch 보존/`NONREPRESENTATIVE_LOCAL_PNGS.json` SHA목록이며 여기에는 대표 PNG·원시 JSON/JSONL/입력/로그를 올렸다. 선공유 fd21955d와430f6aa3 기존 파일은 덮어쓰지 않는다.

대표 화면: `independent/core/1280-records-origin-return.png`, `independent/boundaries/1280-gone-record-fixedhead.png`, `independent/record-list-memo/1440-records-after-project-list.png`; 실패의 실제 지속 stale 상태는 `failure-first/diagnostics/layout-phase/{1280,1440}-notice-cleared-stale-height.png`. `1440-long-failure.png`는 screenshot 시 이미 toggle 처리된 장면이므로 FAIL 순간 이미지로 쓰지 않는다.

사람 이해/사용성, 실제 원프로젝트 실행·수용, 대규모지도, 실제 AI, touch/Windows 성공을 주장하지 않는다. 총괄의 새 제품 후보를 기다린다.

## HOME15 CI 불일치 — 미해결

CI81d Ubuntu39790388931/job119865109890 narrow test08의272≠120 실패를 root가 전달했다. 기존9fb HOME15 전체21개 exit0와 혼합하지 않는다. exact81d의 원본 narrow test08 두 번은 각각child0/외부collector0. 별도 원본 본문/단언 그대로의 읽기전용 native event 관측은 narrow/wide 각1실행 모두0. narrow는 y0/더보기 pointerdown·click/읽기 pointerdown·click/열린dialog/PageDown·End·Home·wheel/닫기 모두120, wide는92였다. 이 환경에서는 CI의120→272가 재현되지 않았다. 재실행 통과로 CI 실패를 해소했다고 주장하지 않는다. 실제 단계 이벤트 time/초점/caller/menu/item rect/body scroll은 home15-ci-discrepancy raw에 있다. 관측 listener의 영향 가능성과 실제 CI환경 차이는 남아있다. 새acf 제품 검증은 별도 independent-fix1에서 실행 중이며 이v0의 결과가 아니다.
