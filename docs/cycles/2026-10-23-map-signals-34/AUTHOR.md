# 34 카드 기록 신호 — 작성자 보고
2026-10-23 KST · 작성자 역할(Claude Code). 독립 검증·통합 판단이 아니다. 계약은 [INPUT](INPUT.md), 원시 경계 측정은 [AUTHOR-boundary.json](AUTHOR-boundary.json).

## 무엇을 바꿨나
시작 `575bb7452044e0d987453a24e31680d2d8077b6c`. 카드 180px 높이·저장 좌표·글자 크기는 그대로다.
- **기록 줄을 말단까지.** 기존 부모 전용 신호를 모든 카드에 둔다. 사실은 새 순수함수 `recordFacts`(shared/attention.ts)가 기존 `subtreeSignals`에서 만든다. 부모는 자기+포함 후손, 말단은 자기. 관계선은 범위를 넓히지 않는다. 고정 순서(우선순위 아님): `기록된 질문 N`(기존 총수) · `현재 답변 기록 없음 M`(applicability active && !answered, M>0일 때만) · `현재 설명` · `이번 탭 설명 갱신`(부모만, 기존 그대로) · `설명 보류` · `이전 기준 설명`(기존 ‘이전 기준’에 ‘설명’을 붙여 질문과 구별). 말줄임 없이 사실 경계에서만 줄을 바꾼다. 누르면 기존 `openBranchRecords`로 들어간다(같은 id `branch-records-*`).
- **카드 안 재배치.** ‘정보’ 버튼 옆에는 이름·소속 줄만 남기고, 구상·기존 수 줄은 카드 폭을 쓴다. 기존 접기 버튼과 ‘앱에서 이어갈 작업’·‘설명 갱신’ 표지는 진입 버튼 아래 한 줄로 모은다. 그 줄과 기록 줄은 끌기 손잡이 아래 카드 안쪽 전체 폭(약 214px)의 하단 띠다. 띠에 접기와 현재 작업이 함께 있는 부모에서만 ‘설명 갱신’이 그 카드 기록 줄 맨 앞으로 간다(측정 기반이 아닌 고정 규칙).
- **간격만 줄였다.** 카드 gap 3→2px, 진입 내부 gap 2→1px, 접기 버튼 세로 padding 3→2px, 기록 줄 line-height는 카드 hint와 같은 14px. 글자 크기는 바꾸지 않았다.
- 기존 검사 두 곳은 문구 ‘이전 기준 1’→‘이전 기준 설명 1’만 같은 엄격도로 바꿨다(31·18).

## 상태별 실제 문자열(최종 빌드, 작성자 실행)
| 입력 | 카드 | 기록 줄 |
|---|---|---|
| T2 | 읽기·검토(부모) | 기록된 질문 2 · 현재 답변 기록 없음 1 · 현재 설명 2 |
| T2 | 출력 준비(부모) | 기록된 질문 0 · 설명 보류 1 · 이전 기준 설명 1 |
| T2 | 미리보기 | 기록된 질문 1 · 현재 설명 1 |
| T2 | 오류행 처리 | 기록된 질문 1 · 현재 답변 기록 없음 1 · 현재 설명 1 |
| T2 | 내보내기 | 기록된 질문 0 · 설명 보류 1 · 이전 기준 설명 1 |
| 독립 고정 입력 | P | 기록된 질문 4 · 현재 답변 기록 없음 1 · 현재 설명 1 · 설명 보류 1 · 이전 기준 설명 1 |
| 독립 고정 입력 | Q | 기록된 질문 3 · 현재 답변 기록 없음 1 · 이전 기준 설명 1 |
| 독립 고정 입력 | S | 기록된 질문 0 · 설명 보류 1 |
| 독립 고정 입력 | B(관계만) | 기록된 질문 1 · 현재 답변 기록 없음 1 |

T2는 [공개 T2](https://github.com/tlsee0813-cmd/agentflow-studio/blob/24baf91fa2d519fd8cd33bb5ece28ec5b32323df/docs/transfer/reentry-judgment-32/input-v0/generated-v0/observer-input/T2.json)(sha256 584bca01…), 독립 입력은 [db5be306의 mixed-long-title.json](https://github.com/tlsee0813-cmd/agentflow-studio/blob/db5be306ee1e57b05f3de8378d398e210ee0aea2/docs/transfer/map-signals-34/input-v0/generated/mixed-long-title.json)(sha256 4790bcd1…)을 작성자가 **참고 실행**한 것이다. 둘 다 저장소에 복사하지 않았고 바꾸지 않았다. 독립 입력 FACTS의 N/M/설명 존재와 일치한다. 이것은 작성자 실행이며 별도 Cloud 실행이 아니다. 확대 이미지에서 글자 존재를 읽은 것은 기본 맞춤의 발견성 성공이 아니다. T2 내보내기의 외부 CSV/XLSX 주장은 카드에 인용하지 않는다.

작성자 합성 경계(`tests/map-signals34-fixtures.mjs`, 공개 domain API만): P(두 줄 이름, 구상 미기재) 아래 A 답변 기록, B 현재 답변 기록 없음+보류+이번 탭 현재, S 이전 기준 질문(+이전 기준 설명), T 시험 답변. R은 B와 연결만 있고 자기 현재 질문을 가진다. 문자열은 `map-signals34.test.mjs`에 고정했다.

## 알려진 잔여(작성자 수용 아님)
**장면:** 부모가 자기 현재 작업 + 자기 이번 탭 설명 갱신 + 두 줄 이름 + 기록 사실 6개를 동시에 가짐(기록 줄 4줄).
- 후보: P의 **기존** 수 줄 ‘요청 1개 · 돌아온 결과 1개 · 앱 미검증’이 진입 버튼 아래로 밀린다. 구상이 있으면 line box 4px, 잉크 2px가 가려지고 글자는 읽힌다. ‘구상 미기재’이면 line box 12.5px, 잉크 10.5px로 줄 전체가 가려진다. 새 문구는 가려지지 않는다. 펼침/접힘, 1280/1440 동일.
- 575bb745 같은 장면: ‘설명 갱신’ line box 13.1px(잉크 9.3, 구상 있음) 또는 전체, ‘앱에서 이어갈 작업’ 전체(38.6/47.1px)가 가려지고 같은 수 줄은 말줄임이다.
- 판단 재료: 숨는 항목이 다르다(기존은 표지, 후보는 수 줄). 후보가 숨기는 수 줄은 기존에도 말줄임이었지만 보였다. 악화/개선 판단은 총괄에게 남긴다.
- 검사: `map-signals34_browser.py` test_04/05는 장면 준비·대상 식별(180px, 두 줄 이름, 기록 줄 정확 문자열, 띠, 구상 표시)·수 줄 측정값 존재·수 줄 외 가림 없음을 **일반 실패로** 확인한다. 가려진 px는 비차단 characterization으로만 남는다(관측 jsonl `characterization`, 로그 `MAP34 KNOWN RESIDUAL … hidden 4px/12.5px`). 이 두 검사의 ok는 가림 없음이 아니며 합격으로 세지 않는다. expectedFailure는 준비 실패까지 녹색으로 만들 수 있어 쓰지 않았다. 12.5px 장면의 line box 위쪽 1.5px는 clip 안이지만 잉크는 전부 가려진다(측정 스크립트 inkFullyHidden).

**이전 말줄임 경계:** 575bb745에서는 말단 수 줄(‘요청 1개 · 돌아온 결과 N개 · 앱 미검증’)이 44px 오른쪽 여백 때문에 모든 측정 장면에서 말줄임이었다. 후보는 같은 장면에서 말줄임이 없다(JSON `ellipsis`).

**여유가 작은 통과 장면:** 부모 6사실(띠에 접기+설명 갱신)·구상 미기재, 부모 5사실 이끄는 표지·구상 미기재는 1.5px 여유로 통과한다. 세로는 px line-height로 정해지지만, 다른 OS 폰트 폭으로 기록 줄이 한 줄 늘면 실패할 수 있다(Windows/Cloud 미확인).

## 작성자 실행과 미실행
작성자 원격 컨테이너: Node 22.22.0(CI 고정 22.16.0 아님), TypeScript 5.8.3, Playwright 1.57.0 + Chromium 141.0.7390.37(Cloud 154·CI 143 아님), Noto Sans CJK KR/Inter를 컨테이너에 설치.
- 최종 소스: `npm run check`·`npm run build`·continuity check/build 통과, `node --test continuity/tests/*.test.mjs` 279/279(새 4 포함).
- 최종 빌드 브라우저: map-signals34 10건 OK(그중 test_04/05 4건은 준비·측정 검사이며 4/12.5px 잔여를 기록), branch-records31 10건 OK, hierarchy18 12건 OK. 검사한 dist: app.js `4d345d31…`, styles.css `ec189504…`, attention.js `631e477f…`.
- **부분 전체회귀(최종 아님):** 순수함수 추출 **전** 빌드(app.js `7ce6b36a…`, styles.css 동일 `ec189504…`, attention.js `6c3871cb…` recordFacts 없음)에서 tests/browser.py와 continuity browser·ui001·fresh033·select035·connect039·flow049·ai055·flow083·flow090·guide097·spatial102·use106 13개가 OK. pc12 진행 중 중단했다. 나머지 pc12·pc13·home15·report16·understanding17·work-description29·workspace19·received20·blank21·viewport30·static은 이 변경으로 미실행이며 PR CI에서 확인한다.
- CI: `.github/workflows/verify.yml`에 MAP34 브라우저 단계를 31 바로 뒤에 추가했다. 양OS CI·Cloud 양PC 실제 조작·사람 사용성·모바일·임의 배율은 미실행이다.
- 측정 재현: `python continuity/tests/map-signals34_measure.py OUT.json [APP_DIR]`(판정 없음). 575bb745 checkout을 APP_DIR로 주면 같은 장면을 기존에서 잰다.
