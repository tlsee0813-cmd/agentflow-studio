# 29 독립 정상 UI — fix1 원본, 수용 보류

**제품 FAIL: 새 설명 수신 시 읽던 설명의 내부 위치가 275→0으로 초기화된다.** 선택한 r2 문장/판본과 current A1은 바뀌지 않았다. 바깥 body 0→0만 보면 놓치는 반례다. 제품 수정 없이 원본을 보존했고 fix2를 기다린다.

제품 실행 기준 `2a7d078124e96243e949244bec945cc8da2c47ec`, tests-only 최종 `709e402b2e44a4864139eda03201e186f5761c6f`. app SHA `34f3610faae32b01d22f8a3fc52467b4e0b5d0d9c30059c6b4d201e22edc9477`, CSS `fb9192e07adb180e55530b3f489125861c542a61a53d7058fd24022b4715115f`. 두 head의 제품 blob 동일을 실제 대조. 28 연구 CSS 미포함. 계약 `7d99679.../INPUT.md`.

## 실제 수행
정상 UI 격리 context, 25 fixture 준비 재사용. 새 프로젝트/A/B/실제 요청·직접 네 값/실제 clipboard H를 만들고 그 template에 명시 합성 return.2를 작성하여 정상 수신. 유효 외부7 설명은 UI 사용자 정정으로 긴 표시30 설명 r2가 됨. 수동 U/N은7, S/C는 실제 보관7/배포금지. 긴 설명은 합성 읽기 경계 자료이며 실제 외부 검증/새 정책이 아니다. storage/state/DOM 수리 주입, forceclick, 고정 sleep, 실제 AI 없음.

1. 양PC1280×720·1440×900에서 B current로 A 기록/compose A를 열어도 B 편집 참고는 B만 가리키고 A 설명으로 대체되지 않음. 명시 A 이어가기 후 A/r2 선택. 작업 전환 뒤 앞 참고는 닫힘.
2. **첫 실제 U 키**: 정상 click/Control+Home/방향키/Shift+방향키로 ‘7’을 선택하고 `3` 한 키 입력 직후 다른 click 전에 관측, 이어 `0`. 네 입력 동일 DOM, focus/selection, N/S/C 불변, 선택 r2·본문·열림 유지. 별도 nested probe에서 **실제 두 scroll owner의 위치도 모두 유지**. N만 표시30으로 명시 수정하고 S/C 실제 보관7/배포금지 보존.
3. 선택 설명 `.work-reference-summary`의 실제 문장 `[중간29] 안내 표시30과 실제 보관7은 다른 역할이다.`와 실제 N 입력이 같은 viewport에 노출됨. 모든 clip/Range/대표 hit와 원본 PNG 양PC로 확인. 현재 구상 라벨만 존재하는 것을 동시 읽기로 세지 않음. 본문 폭은 두 PC 모두 나란히 grid가 적용되는 실제 폭. 좁은 한 열/760px 경계 자체는 이번에 별도 resize하지 않음.
4. 실제 clipboard H의 수동 네 값 정확, 정확 A anchor, 현재 설명 절에서 stale r2 제외. 원보고/H0/H1/B/구상/bases/소속/관계는 보호됨. 참고 표시가 export validity를 되살리지 않음.
5. 별도 **실제 A2 요청/H**를 만든 뒤 current를 정상 명시 A1로 돌려놓고 A2 보고를 파일 수신. current A1과 읽던 r2 텍스트/판본은 유지, 새 설명 안내가 보임. 닫기·재열기에서만 최신 r3 선택. 같은current 수신 정책을 숨은 조작으로 우회하지 않았음.
6. 설명 없음 B, 정상 옛 H→구상 편집→수신한 held-only, 정상 UI 보관한 소유 영역을 확인. held가 현재 본문으로 승격되지 않고 보관 소유가 표시됨. 별도1440 프로젝트 전환 정상 UI 보조 실행에서는 새 프로젝트/재진입 때 참고 닫힘과 명시 재열기, 원자료 보존 확인. 미지정/소유 소실 및 강제 데이터 삭제는 별도 미실행.
7. 양PC 대표 정보→정확 A 읽기→명시 출발 지도 복귀 raw pair: matrix/선택 동일, 2카드 x/y/w/h delta0, current A1 유지. scroll/focus pre/post 원시도 보존. sidebar 진입의 임의 pan/zoom 범위로 확대하지 않음. 이 사례에서 704px 높이를 새29 회귀로 확정하지 않음.

## 중요한 후속 반례와 최초 계측 빈칸
첫 정상 UI 2PC 수집은 위 1~7의 선언된 검사에서 child0/outer0였지만 **전체 PASS가 아니다**. `.source-raw.work-reference-summary` 자체가 overflow:auto/max-height360px이고 바깥 `.work-reference-body`도 스크롤 가능하다. 최초 스냅샷은 body만 계측하여 1440에서 body=0인 채 실제 summary 휠 움직임을 충분히 기록하지 못했다. 그 원 실행/코드를 보존하고 이 빈칸만 별도 probe로 추가했다.

양PC 별도 probe는 실제 보이는 summary 교집합 위치에 native wheel을 보내 **inner275 / outer0**을 만들고, 같은 조건의 별도 A2 실제 H 수신 직후 보조 click/scroll 전에 관측했다.
- 선택 텍스트 SHA와 selectedRevision2는 전후 동일.
- current A1도 동일, A2 보고의 새 설명 안내는 구분됨.
- **summary275→0 / body0→0**. 늦은 설명이 본문을 다른 버전으로 자동 교체한 실패가 아니라 **선택한 같은 본문의 내부 읽기 위치 소실**.
- 첫 U 입력은 inner/body/DOM/focus/selection 보존에 통과. 새 수신 때의 full render와 별도 경계.

`nested-scroll-analysis.json`은 원시 JSONL에서 그대로 뽑은 rect/실제 overflow owner·Range·판본/textSHA/H/current 쌍이다. 별도 probe child1/outer1은 **기대 제품 실패**, fatal/pageerror/cleanup0. 첫 nested 실행의1440 실패와1280 native reach 준비 오류도 별도 원형 보존. 수정 probe는 보이는 실제 교집합으로 휠 지점만 보완했고 의미 단언을 완화하지 않았다. 고정 숫자275를 강제로 쓰거나 scrollTop을 설정하지 않았다. fix2가 owner를 하나로 합치면 실제 owner/줄 위치로 비교해야 하며 summary275 강제 조건을 재사용하지 않는다.

PNG 파일명 `after-new-description-old-selected-reading`은 **수신 직후 상태**를 뜻하며 화면은 파일 수신부에 스크롤되어 있다. 읽기 패널이 그 PNG에 실제 보인다고 주장하지 않는다. 같은 pin/읽기 위치 변화는 즉시 원시로 확인했다. 대표 동시 읽기/명시 새판본 PNG4는 실제 읽기 화면이다. 이후 패널을 정상 페이지 휠로 다시 찾는 추가 캡처는 아직 만들지 않았다.

## 별도 작성자8 실행
exact709 `work-description29_browser.py` 무수정, 공개 domain API로 만든 합성 프로젝트를 **정상 복구 UI**로 로드하는 검사다. 정상 UI 생성 독립 흐름과 합산하지 않음. 실제 결과 **8중6 ok / test02 양PC fail**, child1/outer1.
양PC 모두 line142 `reach(BODY)` 안 `native scroll event completion` 실패. 원시 휠−4, host scrollTop0, scrollend timeout이며 **첫 입력 단언 전에 중단**. 이를 제품 첫 키 DOM 실패나 위275→0과 동일한 실패로 부르지 않음. 더 안 보이는 실제 호출을 force/sleep/단언변경으로 통과시키지 않았다. 원 stderr/합성입력/관측JSONL/실패 PNG 원본 유지. 작성자 server exit/HTTP body는 원 harness가 별도 수집하지 않아 NOT_CAPTURED이며 독립 UI의 값을 가져다 채우지 않음.

## 종료·원본·해시
독립 정상 본 흐름 child0/outer0(계측 범위 제한), 프로젝트 보조 child0/outer0, 최종 nested probe child1/outer1(제품 FAIL), 작성자 child1/outer1(접근/스크롤 대기 실패). 독립 각 서버 명시 종료 **−15**, 종료값을 UI 성공과 혼동하지 않음. source pinned 입력/종료후 bytes와 실제 HTTP body↔disk당시↔종료후 SHA 일치, PW1.57.0/Chromium154.0.8037.57/Node22.16/TS5.8.3 동적 확인. 모든 독립 정상/최종 probe console/pageerror/fatal/cleanup0. typecheck0, root+continuity build shell0(개별 build collector는 별도 미제공). npm ci/설치/유료AI 없음.

최초 본 흐름은 본문 중심이 viewport 아래인데 휠을 보내 준비 실패했다. 원본/code/PNG/exit1 보존 후 정상 페이지 휠로 body에 접근했다. 이후 정상 본 흐름에 있는 `checksInThisPC` 값13/26은 **누적 내부 카운터**라 두PC 검사수로 합산하면 안 된다. 작은 결과의 각 raw 참조는 viewport+UTC로 구별. 최종 판정은 `FINAL_RESULT.json`의 제품 FAIL을 따른다.

큰 JSON/JSONL은 무손실 gzip(mtime0)이며 `RAW_INDEX.json`에 원/압축 bytes/SHA·재해제 동일성을 기록. 작은 결과에는 중복 Range 전체를 복제하지 않음. `MANIFEST.tsv`는 자신 제외 정확 payload집합. PNG는 원본 그대로, 일부 비대표 이미지의 로컬 보존 위치/해시는 inventory로 구분. 소스·제품 branch/main/checkpoint/공개 배포 변경 없음. CI/단위·사람 사용성·AI 의미 해결·좁은폭/전체 회귀 성공은 주장하지 않는다.
