# 30+31 통합 정상 UI 교차검증

정확 제품 `7c7bdfa8d244d83c2c776b91b6a3a669127ba2e9` (tree `a0d2671bd3b17b814c6e828814bb00c08cad7f43`). app SHA256 `da2502c6a011578c77931a10f41a7fcd09f182ae3b8b186b26f640966b747c2b`, CSS `6d8ddbb78d0f51b061ccaeaf8a939a4d07c558fc7ae7334a07fd106cf5b540f7`, workflow `11c28b3164beefc47c2e92f37044731ea5d18528f75161b1fb74ee909db2a232`. 추출 소스 전후 변경 0입니다.

PC1280×720/1440×900 각각 요청한 두 흐름을 완주했습니다. 최신 child/외부 collector 실제 exit **0/0**, fatal/pageerror/cleanup 오류 0. 최초 준비 로더는 기존 정의부 절취 구분자 때문에 브라우저 시작 전에 SyntaxError로 child/collector **1/1** 종료했고 first-loader-error에 당시 코드/로그/종료값을 그대로 보존했습니다. 로더의 rsplit 교정 외 제품/검사 기대값 변경은 없습니다.

기존31 정상 UI 자료를 재사용했습니다. 정상 UI 백업 import(6영역)와 기존 실제 H/template로 작성한 명시 합성 반환을 정상 파일입력으로 수신했습니다. 정상 UI 재소속으로 P→S→Q, 같은 이름 다른 부모 D→L을 만들고 실제 새 요청/파일용 H/합성 반환을 추가했습니다. 별개 current B와 미전송 Q 대상 초안이 있습니다. 준비의 fit은 baseline 전에만 수행했습니다. 첫/끝 프로젝트 전체 snapshot의 동등성을 확인했으며 current/draft/원문/관계/구상/이력 등 보존됩니다. 정상 UI 준비가 완료된 뒤 fit/resize/DOM scroll·focus 수리·앱 state/API 호출·force·고정 sleep을 쓰지 않았습니다. page wheel과 패널 body wheel은 각각 native scrollend를 관측했습니다.

## 흐름1: 부모 신호→긴 하위기록/정확 보고→깊은 읽기→일반 전체 공간

P 신호로 열린 기록을 읽고 panel-more/panel-edit/긴 이름을 실제 펼쳤습니다. 패널 내부 wheel 후 실제 P의 H로 연결된 보고를 선택하고, 연결경로/당시 작업문/현재 작업문/요청 원문을 정상 disclosure로 열어 native page wheel로 깊게 읽었습니다. 일반 nav-space는 원점 버튼과 별개로 직접 클릭했습니다.

| PC | 첫 동기 map top | height | bottom | 닫기 초점 |
|---|---:|---:|---:|---|
| 1280×720 | 268.890625 | 435.109375 | 704 | node-info-P |
| 1440×900 | 268.890625 | 615.109375 | 884 | node-info-P |

첫 동기는 trusted nav-space click의 target 제품 handler 뒤 같은 이벤트 task bubble에서 읽은 값입니다. 후속 두 rAF와 이후 자동화 snapshot은 별도 raw입니다. 첫 관측부터 하단16px 여유이고 카메라/선택/접힘, 패널 open/내부 읽기 scroll이 유지됐습니다(1280 panel top362,1440 top182). 이전 branch signal caller는 일반 진입 뒤 닫기에 남지 않았고 정상 info 버튼으로 복귀했습니다. read-only event listener는 측정 경계이며 무계측이라고 주장하지 않습니다.

## 흐름2: 실제 page wheel120→부모 신호→정확 보고→명시 원점

두 PC 모두 실제 공간 page wheel로 Y120에 도달했습니다. **부모 신호를 누른 직후 정상 UI의 pageY는 1280에서116,1440에서0으로 바뀌었습니다.** pageY120이 신호를 연 뒤에도 보존됐다고 주장하지 않습니다. 강제로 되돌리지 않고 그 상태에서 긴 기록을 읽고 실제 호출행에 도달한 뒤 baseline을 잡았습니다.

| PC | 보고 호출 직전→명시 복귀 직후 pageY | 호출행 viewport top | 패널 내부 scrollTop |
|---|---|---|---|
| 1280×720 | 116→116 | 285.625→285.625 | 551→551 |
| 1440×900 | 0→0 | 401.625→401.625 | 551→551 |

명시 task-return-origin 복귀 직후 보조 focus/scroll 전에 raw를 수집했습니다. 원 호출행 focus·전체 ancestor client clip·중앙 hit, disclosure, 실제 computed transform/카메라·선택·접힘이 유지됐습니다. 이후 패널 닫기는 일반 진입과 달리 실제 원 부모 signal로 돌아왔습니다. 1440의 nonzero **호출 시점** origin 검증으로 확대하지 않습니다(신호를 연 직후 이미0). 이 흐름은 pageY120 시작과 이후 실제 origin 보존을 나눈 한정 결과입니다.

동일 이름의 다른 부모 아래 L 보고가 P 기록으로 혼동되지 않게 실제 report task ID와 원 H를 대조했습니다. 신호 목록의 실제 소유자 자료와 정상 UI 구성은 raw 및 prepared snapshot에 있습니다. 이번 프로젝트 관계는0개이며 비어있지 않은 관계 끝점 재검사를 했다고 부르지 않습니다.

## 실행/원자료

Node22.16.0 / TypeScript5.8.3 / Playwright1.57.0 / 실제 Chromium154.0.8037.57. typecheck/root build/continuity build 각 exit0. 실제 loopback HTTP 30응답의 body SHA가 실행 dist 및 종료후 파일 SHA와 모두 일치했습니다. runtime.json에 실제 URL/버전/console/pageerror/서버 종료가 있으며 원서버 terminate 실제 **-15**는 검사 child0과 다릅니다. outer receipt는 tool 완료 metadata 전사이지 전체 tool 원문이 아닙니다.

대표 PNG는 양PC×두 흐름 4장입니다. 원시 큰 JSON/JSONL은 무손실 gzip으로 저장하고 RAW_INDEX에 원 바이트/SHA·압축SHA·재해제 동등을 기록했습니다. MANIFEST는 자신을 제외한 정확 payload 집합입니다. 전체 제품 소스/빌드/node_modules는 공유하지 않습니다. 이전29/30/31 full matrix·CI조회·사람 사용성·실제 AI는 미실행입니다. 통합 수용 판정은 총괄 범위입니다.
