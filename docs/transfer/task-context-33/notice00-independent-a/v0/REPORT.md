# 33 notice00 좁은 독립 실행

정확 후보 **4ffa06dc28c51f20db9f93887747d353911ccdc9**(parent97f39939304e56971c907faa7fb949dad08fe04a)와 원본72940a043d7a7fdc225a9582ce48831fa0418cc0을 격리 추출했습니다. 후보 app276754B/SHA256 `9314dc3412fe4ac7d3207188eb9bcb046e04e2c6e4ebd0556d28b703e54fda9e`, 검사41794B/SHA256 `54fa4956d90565839e052530d80e3040bf84fa78497b5cba9ea6bb89b4c6b6b9`. 원본에는 동일 pc12_browser.py 하나만 overlay, 제품은 그대로입니다. 검사/제품 수정·단언완화·재시도는 없습니다.

| 제품 | exact test02 1280×720 /1440×900 | child/외부 collector |
|---|---|---|
| 후보4ffa | 2/2 PASS | 0/0 |
| 원본729+수정검사 only | 2 FAIL | 1/1 |

각 test02는 두 단계를 모두 유지합니다. current=R(A보고)에서 A이어가기는 현재보고 **작업02**를 유지하고 R만 편집합니다. 이 기존양성 경로는 양 제품/양PC 모두 통과했습니다. 그 뒤 current=RB(B보고)에서 A이어가기는 A로 전환하며 후보의 실제 안내는 **‘작업01로 이어가기…전에 이어가던 작업04은 그대로 남아요.’**입니다. 후보는 notice01/previous04/no00 세 새단언과 A/R/RB/B 수동값·초안·복귀·reload 등 기존 상태보존 단언을 끝까지 완주했습니다.

원본은 같은 위치에서 **‘작업01로 이어가기…전에 이어가던 작업00은 그대로 남아요.’**라고 실제 표시됐고 line235 previous04 단언에서 양PC 실패했습니다. 준비오류가 아닌 해당 notice 반례입니다. 이후 no00 단언과 두번째 A편집/최종복귀/reload 보존단언은 원본에서 **NOT_RUN**이며 통과로 섞지 않습니다. task01 양성은 실패 전 통과했고 actual00은 read-only notice 수집/PNG/원traceback에서 확인됩니다. 이 결과를 실제 데이터 소실/편집대상 오류로 확대하지 않습니다.

원검사 바이트는 고정했습니다. 별도 runner는 원 Locator.click 실행을 그대로 호출한 뒤 `#task-view-continue`에 대해서만 notice text/hidden/display/rect/viewport/중앙hit/focus/windowY를 읽고 screenshot을 남깁니다. 양 제품의 모든4개 notice관측은 visible/inViewport/centerHit 양성이며 y10,높이49.59375입니다. PNG는 추가scroll/focus/스타일조정 없이 해당click직후 캡처했습니다. 원검사 행동·기대값을 바꾸지는 않았지만 읽기계측/캡처 경계가 있음을 명시합니다.

Node22.16.0 / TS5.8.3 / Playwright1.57.0 / 실제 Chromium154.0.8037.57. 양쪽 typecheck/root build/continuity build 각각0. HTTP 각 실행6개 index/CSS/app.js 응답의 actualbody↔실행disk SHA 동등 및 종료후 compiled SHA를 연결했습니다. 실제URL/UTC/동적환경은 raw. pageerror/capture-error0. 원서버 cleanup terminate 실제-15는 child/collector판정과 별도입니다. first failure traceback/stdout/stderr를 그대로 보존했고 준비실패나 후보실패는 없었습니다.

SOURCE.before/after는 exact source/tree/제품/검사 해시와 전후 변경0을 기록합니다. exact test02 두 메서드만 실행했으며 PC12전체/다른회귀/CI/배포/제품변경은 없습니다. 대표noticePNG8개와 원검사 자체캡처의 hash색인을 남겼습니다(자체중복PNG는local유지). 큰 JSON/JSONL gzip은 원hash/재해제 byte동등 RAW_INDEX로 연결합니다. MANIFEST는 자신을 제외한 정확 payload집합입니다. 기존증거/다른branch는 불변이며 사람이해/전체문구정확성의 무제한보증은 아닙니다.
