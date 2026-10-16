# REPORT16 fix1 (독립 검토 P2 대응 · 원본 후보는 변경하지 않음)

| 항목 | 값 |
|---|---|
| 제품 기준 | `a5a48a715c41d1f8ea928af48a33d264c295a128` |
| 원본 후보 (그대로 보존) | `71a72298bc1b23279ab4ac03f778b87eb18d145e` |
| fix1 | `3f269e93e714bd556f0f44588d79d1c462433dea` |

두 커밋 모두 로컬에만 있고 push하지 않았다. `patches/`에 2개를 `git am` 순서대로 넣었다.

## 결함과 재현
결함은 리뷰 지적과 같다.
- `render()`는 다시 그리기 전 DOM의 `details[id]` 펼침 상태를 id로 복원하는데, 이 복원이 `keepReadOpen`(readOpen)보다 늦게 적용됐다.
- 모든 보고가 같은 id인 `task-report-path`를 쓴다. 그래서 R1에서 연결 경로를 펼친 뒤 R2를 고르면 R2의 연결 경로가 펼쳐진 채로 나왔다.

실제 브라우저로 재현했다(`test_09`).
- 원본 후보 71a7229에서 exit 1로 실패한다: `① R1 path open does not carry over to R2: True != False` (`evidence/1-candidate-…-FAIL.log`).
- render 복원만 고친 중간 판본에서는 `②`(같은 보고를 다시 고르면 펼침 유지)가 실패했다. 원인은 `pickReport`가 같은 보고를 다시 골라도 보고 전용 메모를 버린 것이었고, 원본 후보에서는 앞의 render 복원이 이를 우연히 가리고 있었다. 이 중간 판본은 커밋하지 않았고 로그도 남기지 않았다.

## 수정 (app.ts 9줄)
1. **`render()`:** 작업 화면(`view==='task'`의 `#space-view` 안)의 details에는 이전 DOM 복원을 적용하지 않는다. 작업 화면에서는 readOpen만 펼침을 정한다.
2. **`pickReport`:**
   - 같은 보고를 다시 고르면 readOpen을 그대로 둔다.
   - 다른 보고를 고르면 `task-report-*`만 버리고, 요청 공통 펼침(요청 원문·작업문·구상 전체 등)은 유지한다.

새 schema·UI·상태는 추가하지 않았다. 작업 화면 밖의 render 복원 동작은 그대로다.

## test_09에서 확인한 것 (1280)
- **①** R1에서 연결 경로를 펼친 뒤 R2를 고르면 닫혀 있다. R2에서 펼친 뒤 R1으로 가거나, 다시 R2로 돌아와도 R2 전용 펼침은 닫힌 상태로 시작한다.
- **②** 같은 R2를 다시 고르면 연결 경로와 전문 펼침이 유지된다.
- **③** 보고를 바꿔도 요청 원문(`task-view-request`)과 작업문(`task-view-work`)의 펼침은 유지된다.
- **④** 읽기와 무관하게 생긴 재그리기 뒤에도 같은 R2의 보고 펼침과 요청 공통 펼침이 유지된다.
  - 재그리기 원인: 다른 영역 요청의 MOCK 응답을 일부러 붙잡아 두었다가(표시된 결함 주입), 읽는 도중에 풀어 commit→render를 일으켰다.
  - **한계:** 이 앱에는 다른 탭의 저장을 받아 다시 그리는 경로(storage/BroadcastChannel 리스너)가 코드에 없다. 다른 탭이 저장하면 이 탭의 다음 저장이 충돌로 막힐 뿐 화면은 다시 그려지지 않는다. 그래서 '다른 탭 업데이트 재그리기'는 실제로 일어나지 않으며, 같은 `render()` 경로를 타는 늦은 응답 재그리기로 대신 검증했다.

## test_07 범위 축소
- 이름을 `test_07_area_round_trip_keeps_saved_input`으로 바꿨다. 주석도 "영역 왕복과 초안 보존만 검사, 출발 영역 소실 fallback은 검사하지 않음"으로 고쳤다.
- 실행되지 않던 `if back.count()` 조건부 fallback 블록은 삭제했다. 소실 fallback 검증은 총괄 담당이다.

## 최종 검사 (fix1 3f269e9, 실제 child 종료값)
| 명령 (`app/`, `node continuity/scripts/build.mjs` 뒤) | 결과 |
|---|---|
| `node continuity/scripts/check.mjs` | 0 |
| `python3 continuity/tests/report16_browser.py` | 0 (13개: 기존 12 + test_09) |
| `pc12_browser.py` / `spatial102_browser.py` / `flow090_browser.py` | 0 / 0 / 0 |
| `node --test continuity/tests/*.test.mjs` | 0 (210/210) |

- pc13·home15·guide097은 다시 실행하지 않았다. 이번 변경은 작업 화면에만 적용되고 CSS 변경은 없다.
- `evidence/1-…-FAIL.log`에는 붙잡아 둔 응답 때문에 생긴 teardown `CancelledError`가 함께 찍혀 있다. 실패 판정은 위의 ① assertion이다.

## 내용물
| 경로 | 내용 |
|---|---|
| `cumulative.diff` | a5a48a7..fix1 누적 |
| `fix1-only.diff` | 71a7229..fix1 |
| `patches/` | 커밋 2개 |
| `changed/` | 누적 변경 파일 5개 |
| `evidence/` | 실패/통과 로그, 최종 로그, 조건별 JSONL |
| `screens/` | test_09 재그리기 뒤 장면 1장 |
| `MANIFEST.sha256` | 매니페스트 |

재현: `git checkout a5a48a7 && git am patches/*.patch && cd app && npm ci --ignore-scripts --no-audit --no-fund && npm run build && node continuity/scripts/build.mjs && python3 continuity/tests/report16_browser.py`

원본 후보에서 실패를 보려면 첫 패치만 적용하고 fix1의 `report16_browser.py`를 덮어쓴 뒤 `Report16.test_09_report_disclosures_do_not_leak_and_survive_redraws`를 실행한다.
