# PC 연결12 — 작성자 fix1 보고 (Opus, 작성자 검사)

작성 2026-10-16 KST. v0 위의 좁은 수정이다. 독립 검증·후보 수용·공개 반영이 아니며, 검사 통과를 사람 사용성으로 해석하지 않는다. v0 묶음의 원시 증거는 고치지 않았고, 틀린 기술은 아래 ‘정정’에 기록한다.

## 변경 (v0 대비, `files/`에 원 repo 경로)
| 파일 | 내용 |
|---|---|
| `app/continuity/src/client/app.ts` | (1) 긴 이해/범위 전문 펼침, (2) 출발 보기의 펼침 상태 보존 |
| `.github/workflows/verify.yml` | (3) USE106 단계 다음에 `pc12_browser.py` 실행 단계 하나 추가(+7줄) |
| `app/continuity/tests/pc12_browser.py` | 새 장면 2개, (4) JSONL 관측 기록 |

`styles.css`, `flow090_browser.py`는 v0과 같다. domain·저장 형식·서버·AI 경로·의존성은 바꾸지 않았다. `v0-to-fix1.diff`를 v0 파일(verify.yml은 USE106 원본)에 적용하면 `files/` 세 파일과 바이트 단위로 같아짐을 확인했다.

1. **P2 긴 이해/범위:** 작업 읽기의 짧은 맥락에서 200자를 넘는 `understanding`/`scope`는 앞부분 뒤에 읽기 전용 details `#task-view-full-<key>`를 둔다. 요약 줄은 ‘<이름> 전문 보기 · N자 · <출처>’다. 펼치면 선택한 Task 자신의 값 전문이 나온다. 다른 Task로 바꿔 읽지 않고, 원문으로 대신하지도 않는다. 펼침은 상태 저장이나 commit을 일으키지 않는다.
2. **출발 보기의 펼침 상태:** 출발점(탭 메모리 `origin`)에 그 보기 안 `details[id]`의 열림/닫힘을 함께 기록한다. 복귀 시 다시 그린 뒤, 아직 있는 것만 같은 상태로 되돌리고 그다음 스크롤을 복원한다. 영구 schema·sessionStorage·새 엔진은 없다. 좌표·배율·선택·currentTask·수동 수정 보호는 v0 그대로다.
3. **CI 단계:** 두 OS 매트릭스, env, `set -o pipefail`/`tee` 형식은 기존 단계와 같다. YAML 파싱 확인(단계 27개, matrix 불변)만 했다. **실제 GitHub Actions나 Windows에서 실행하지 않았다.**
4. **관측 기록 `pc12-observations.jsonl`:** 줄마다 `kind`를 둔다.
   - `condition`: 검사 조건의 `expected`와 실제 `value`.
   - `actual`: 원시 스냅샷. 출발·복귀의 `windowY`, `docHeight`, `style.transform`, `getComputedStyle` matrix, 선택 카드 `getBoundingClientRect`, `focusId`, `:focus-visible` 일치 여부, 패널 표시, 열린 details 목록, 배율 문자열.
   - `step`: 표시된 조작.
   - 각 assertion 직전에 append하므로 실패해도 그때까지의 값이 남는다.

## 원시 실행 기록
실행은 `tools/collect.py`로 했다. 명령마다 별도 child process를 띄우고, child별 실제 returncode·시작/끝(UTC)·소요·명령·env·로그 경로·로그 bytes/SHA를 `raw/collector.jsonl`에 한 줄씩 남긴다. shell loop의 종합 exit는 쓰지 않았다. 환경은 v0과 같다(Node v22.22.0, Playwright 1.56.0, Chromium 141, MOCK, 유료 호출 0).

| child | returncode | 의미 |
|---|---|---|
| v0product-pc12-fix1checks | 1 | **v0 제품** + 새 검사 첫 실행 |
| v0product-pc12-fix1checks-run2 | 1 | **v0 제품** + 검사기 수정본, 재현 기록 |
| fix1-npm-check / cont-check / cont-build | 0 / 0 / 0 | |
| fix1-pc12 | 1 | fix1 제품 첫 실행 |
| fix1-spatial102 / fix1-flow090 | 0 (11) / 0 (18) | 영향 회귀 |
| fix1-pc12-run2 | 0 (13) | 최종 |

**v0 제품 첫 실행 실패의 분류**
- test_08 ×2: **제품 결함 P2 재현.** `#task-view-full-understanding`이 없다.
- 검사기 문제 3종(검사본 `raw/pc12_browser.fix1-checks-run1.py`):
  - test_05: 경계 클래스에 `record`가 연결되지 않아 AttributeError.
  - test_02 ×2: 카드 rect 높이 비교. 명시 이어가기로 ‘앱에서 이어갈 작업’ 표시가 붙어 높이가 234.6→277.0으로 변했다. 위치·너비는 같았다. 수정 후에는 x/y/w만 조건으로 비교하고 h는 actual에만 남긴다.
  - test_09 ×2: 구상 fixture가 1932자로 만들어졌다. 생성식 반복 수를 고쳤다.

**v0 제품 재실행(run2):** test_08 ×2와 test_09 ×2만 실패했다.
- **반례 재현:** 펼친 `panel-idea-full`이 복귀 후 닫힌다. 열린 details가 `['area-list','panel-idea-full']`에서 `['area-list']`로, docHeight가 1877에서 1495로 바뀐다.
- **scrollY clamp는 이 자료에서 재현되지 않았다.** 1280에서 725→725, 1440에서 546→546이다. 문서가 짧아져도 그 위치까지는 남았다. 다만 같은 scrollY에서 보이는 내용은 달라진다.
- 관련 기록: `raw/v0product-run2-pc12-observations.jsonl`.

**fix1 첫 실행:** test_09 ×2 실패는 검사기 문제였다. 두 번째 출발 때 이미 복원된 열린 펼침을 다시 클릭해 닫았다. 열려 있으면 누르지 않도록 고쳤고, 검사본은 `raw/pc12_browser.fix1-checks-run2.py`다. 이 실패에서 ‘도착 시 이미 열림’ 상태가 확인되었고, run2 관측에도 `True`로 기록되어 있다.

**fix1 run2(최종) 관측**
- test_09 복귀: 열린 details, `windowY`(1280: 725, 1440: 546/496), docHeight 1877, computed matrix, focus가 출발과 같다.
- 편집 경로에서 currentTask=A, manual `checks` 값이 유지된다.
- test_08: 마커 ZZ-REQ-U/ZZ-REQ-S는 앞부분에 없고, 명시 펼침 뒤 전문(저장값과 동일)과 ‘사용자 직접 수정’ 출처가 보인다. 이때 current=R이고, 저장 프로젝트는 전후 동일하다.
- 관측 197줄, 그중 condition 152줄.

HTTP·디스크: fix1 `client/app.js`는 `09b6e69d…f07f`이고, HTTP 200 응답과 디스크가 일치한다. `styles.css`와 `index.html`은 v0과 같다(`raw/fix1-http-disk-hashes.txt`).

## 대표 PNG (3장)
- `pc12-1280-10-long-fields-open.png`: 긴 이해/범위의 앞부분과 펼친 전문.
- `pc12-1280-11-idea-open-back.png`, `pc12-1440-11-idea-open-back.png`: 2000자 구상 전체보기가 열린 채 출발 보기로 복귀한 화면.

## v0 보고 정정 (v0 원시 파일은 그대로 둠)
- **ZIP 구성:** 채팅 보고의 ‘62파일’은 틀렸다. `pc-reading-return-12-author-v0.zip`은 **62 entries = 정규 파일 52 + 디렉터리 10**이다.
- **수정 전 Node 결과:** v0 REPORT의 ‘210 중 6 실패’는 틀렸다.
  - 실제는 **145 tests 중 139 pass / 6 fail**이다(v0 묶음 `raw/base-node-tests.log`). 실패한 6개 파일은 모듈을 불러오지 못해 그 하위 테스트가 집계되지 않았다.
  - 부모 앱 `npm run build` 뒤 **210/210**(v0 묶음 `raw/base-node-tests2.log`)이 맞다.
  - 그 v0 `raw/base-node-tests.log`는 디렉터리 인자로 잘못 실행한 첫 로그를 덮어쓴 것이다. 그 첫 로그는 보존되지 않았다(exit 기록만 `base-exits.txt`에 있음).
- v0의 exit 기록은 shell 루프에서 `$?`로 남긴 것이고 child별 시작/끝 시각이 없다. fix1부터 collector로 바꿨다.

## 한계
- **scrollY clamp:** 현재 자료와 두 PC 폭에서는 재현되지 않았다. 고친 것은 펼침 상태 소실이다. 더 큰 구상이나 짧은 화면에서 clamp가 날 수 있는 조건은 펼침 복원으로 함께 막히지만, 그 경우를 별도로 관측하지는 않았다.
- **펼침 복원 범위:** 출발 보기에 다시 존재하는 `details[id]`만 되살린다. id 없는 펼침이나 textarea 크기는 대상이 아니다.
- **CI:** 단계는 정적으로만 추가했다. Windows와 CI 실행 결과는 없다.
- **검사 범위:** 390 최소 장면은 pc12(test_07)에 들어 있어 이번에도 통과했다. 그 밖의 browser 회귀(use106·guide097·browser·flow083 등)는 다시 돌리지 않았다. 바뀐 경로는 pc12·spatial102·flow090이 덮는다.
