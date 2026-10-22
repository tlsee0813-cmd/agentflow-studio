# 29 fix2 독립 정상 UI 및 AREA17 별도 반례

**읽기 위치 수정은 양PC에서 해결 확인. 후보 전체 수용은 AREA17의 복사 후 복귀 버튼 가시성 회귀 때문에 보류가 필요하다.** origin 소실은 확인되지 않았고, 실패 후 정상 Home→명시 복귀는 가능했다.

정확 제품 `f10eb68962ea1e6d35a491891b8c0c3b934eac77`. app SHA `34f3610faae32b01d22f8a3fc52467b4e0b5d0d9c30059c6b4d201e22edc9477`은 fix1과 동일, CSS `c7ff244982397a42fb3f0bb5133c9631892fc4efa96566d86718b10dd94bc8f2`. 709e 대비 CSS 한 규칙만 변경. 본문 `.source-raw`의 max-height/overflow만 해제되고 바깥 body 제한은 유지됨. 기존 Node22.16 / TS5.8.3 / PW1.57 / 실제 Chromium154.0.8037.57 및 loopback MOCK만 사용. 설치/실제 AI/제품 수정 없음.

## 정상 UI 핵심 경로 — 최신 한 실행
기존25 정상 UI 준비를 다시 실행하여 A의 실제 H/template 기반 합성 외부 설명7→정상 사용자 정정으로 긴 표시30 r2, 수동 U/N7·S/C 실제 보관7/배포금지. B current에서 A 기록/compose 대상을 열어도 B의 참고만 보이고, 명시 A 이어가기로만 A/r2 선택. 저장소/프로젝트 JSON/제품 state 주입 없음.

양PC1280×720·1440×900 모두 다음을 확인했다.
- 정상 휠은 **실제 `.work-reference-body`**를 움직임. summary는 overflow:visible, scroll max0/top0이며 임의로275를 넣지 않음. native 이벤트 owner/좌표·실제 hit도 원시에 기록.
- 첫 U 키 직후 네 입력 동일 DOM·focus/selection, N/S/C/선택 r2/본문/열림/body 위치 보존. N만 표시30으로 고치며 S/C 보관7/배포금지 유지.
- `.work-reference-summary`의 실제 표본 문장 줄과 N 입력의 동시 노출/Range/전체 조상 clip/대표 hit, 원본 PNG를 확인. 구상 라벨만으로 통과시키지 않음.
- 실제 H의 네 값/정확 A anchor와 stale 설명 제외. 과거 H0/H1·원보고·B·bases/구상/관계/소속 불변.
- **별도 A2 실제 요청/H**의 새 설명 파일 수신 후 current A1·읽던 r2 텍스트/판본 유지, 새 설명 안내. 정상 body 휠로 읽던 위치가 **1280:604→604 / 1440:567→567**, 같은 표본 Range의 body 상대 top도 **−11.71875→−11.71875 / 25.28125→25.28125**. 1280 표본은 줄바꿈 일부 Range가 경계에 걸려 있으므로 문단 전체 글자잉크 가독성으로 확대하지 않는다.
- 실제 이전 기록→근거→수신 JSON 원문을 정상 펼쳤고, 수신 전후 열린 details ID 집합도 동일. 펼칠 때 원 JSON 값은 실제 초기 합성 수신 파일과 일치. **JSON textarea 자체 native 내부 scroll 위치는 합격 주장 범위 밖**이다.
- 닫기/재열기로만 최신 r3 선택. 작업 전환, 없음/held-only/보관 소유 경계 및 정확 지도 복귀/current 유지도 같은 실행에서 확인. 프로젝트 전환은 fix1의 별도1440 실행 근거를 재사용하며 **fix2에서 새로 실행한 것으로 합산하지 않음**(app 동일, CSS만 변경).

최신 읽기 child0/외부0, pageerror/fatal/cleanup0. 대표 정보→작업→명시 출발 지도 복귀의 raw pre/post도 JSONL에 보존. 전체 역사 회귀/760px 경계 resize/실제 OS IME/사람 이해/AI 의미 해결은 미실행.

### 최초 fix2 가시성 관측 보존
첫 fix2 양PC 실행에서 핵심 위치·pin·원문 펼침 보존은 모두 통과했으나, 1440에서 읽기 화면을 페이지 휠로 다시 찾은 뒤 표본 줄이 고정 `#notice`에 가렸다(hit=notice). 결과 exit1을 원형 보존. 이를 지우거나 predicate를 완화하지 않고, **정상 추가 페이지 휠 −120 한 번**으로 notice를 벗어나는 접근을 포함해 다시 실행했다. body 내부 위치는 바꾸지 않았고, 최신 같은 문장 hit도 통과. 1280은 이 추가 회복0회. 수신 직후 자동으로 읽기 pane이 보인다는 주장은 하지 않는다.

## 별도 AREA17 test06 회귀
사용자가 요청한 정확 `understanding17_browser.py` test06 두 클래스만 실행. source 파일과 browser helper는 기준27 `6b96543...`와 f10에서 실제 동일 bytes. 원 expected/assert/키/제품은 무수정. 별도 runner가 `#send`/`#copy-work` **정상 click 반환 직후만** 읽기 전용 rect/pageY/viewport/전 조상 clientclip/hit/notice/pending/문서높이/참고 open 및 원 READABLE_JS를 수집했다. 이 instrumentation은 원 검사를 정상 UI 독립 흐름으로 바꾸지 않는다.

- f10 첫 진단: 양PC 모두 line362 원 readable FAIL, child1/외부1. 버튼 count1, origin 버튼은 존재. copy 직후 windowY215, 버튼 pageY161.59375 / viewport y−53.40625~−10.40625. 참고는 닫힘. 원 READABLE_JS(clipboard 완료/원 검사 단계 후)는 첫 줄 y−42~−22, inView=false, hit=null.
- 정확27 같은 조건: 양PC 모두 test06 원 전체 통과, child0/외부0. copy 직후 windowY134, 같은 버튼 pageY161.59375 / viewport y27.59375. 최종 원 READABLE_JS는 줄106~126, readable=true. copy 반환 직후 계측과 후속 원단언 시점은 다르므로 수치들을 같은 순간으로 혼합하지 않음.
- 별도 f10 재현+실패 후 회복: 원단언은 양PC 그대로 FAIL. 이후에만 정상 **Home**→scrollend→버튼 readable 확인→실제 명시 복귀. 새 current는 유지됐고 원지도 style/computed matrix·배율·선택·펼침·focusId가 최초값과 같았다. 이 후속 회복을 원검사 통과로 바꾸지 않음. 반복 f10의 일부 즉시 수치는 windowY282 등 차이가 있어 원 JSONL/시점을 함께 남김.

따라서 현 환경에서는 27 통과 대비29 가시성 반례가 재현된다. **origin/저장 새 작업 소실과는 다르다.** 새 N의 참고는 닫혀 있어 source-raw CSS의 직접 효과라고 하지 않으며, 정확한 layout/scroll 인과는 총괄 정적진단과 통합할 사안이다. 키보드 회복이 가능하다는 이유로 원단언을 완화하지 않았다.

## 실행·보관 경계
원 709e의 WORK29 8개 준비 실패는 fix1 증거에 그대로 보존. f10 내 구버전56CB를 다시 실행하지 않음. 새 작성자 검사 후보는 아직 전달되지 않아 **NOT_RUN**. 이 별도 AREA17 2개를 새29 8개나 정상 UI 성공에 합산하지 않는다.

source pinned 입력/종료후 bytes와 실제 HTTP body↔당시 disk↔종료후 hash 대조, 동적 런타임, 실제 child/외부/서버 종료를 구분한다. 독립 읽기 서버 명시 종료−15, AREA17 원 harness의 server exit는 별도 수집되지 않아 NOT_CAPTURED. root+continuity build shell0 및 별도 typecheck child0, 새 설치/npm ci 성공 주장은 없음. 외부 tool completion은 `outer-exit.json` 발췌이며 전체 tool transcript 아님.

큰 JSON/JSONL만 무손실 gzip, `RAW_INDEX.json` 원본/압축 bytes/SHA와 재해제 동일. 작은 result는 raw 참조만 둠. PNG는 원본. MANIFEST는 자신 제외 정확 payload 집합. fix1/최초 fix2 원본 삭제/덮기 없이 별도 prefix 추가만 한다. main/checkpoint/product/gh-pages/공개 배포 변경 없음.
