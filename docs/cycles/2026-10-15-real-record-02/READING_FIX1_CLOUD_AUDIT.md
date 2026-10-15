# Reading fix1 Cloud 증거 독립 감사

감사 기준: 2026-10-15 16:35 UTC. 새 브라우저 실행 없이 GitHub connector로 고정 원문을 회수하여 코드·JSON·프로세스 로그·PNG를 대조했다. 제품 수정이나 원격 쓰기는 하지 않았다.

**판정: 기존 54개 확인 항목과 추가 6개 전환 관측을 합쳐, 지정한 로컬 60개 계약의 증거가 확보되었다. 외부 원문 읽기·실제 왕복 2개는 인증서 차단으로 NOT_RUN이다.** 하나의 최종 실행이 60/0을 새로 산출했다는 뜻이 아니다. B 모바일에서 비교 상대가 미리보기와 함께 보이지 않는 기존 한계도 남는다.

## 고정 원본과 무결성

- 저장소: `tlsee0813-cmd/agentflow-studio`.
- 연구 원본: `4971cb51965a7c40b374ddf0210f51c8609ed20e`, `docs/cycles/2026-10-15-real-record-02/reading-fix1/reading-study.html`.
- 최초 공유: `e1cca303e57c19ad01c21f7302457ffda044b63c`; 최종: [ce91a08](https://github.com/tlsee0813-cmd/agentflow-studio/tree/ce91a08fe8ff641a491d34bf35de732f85816792/docs/transfer/real-record-02/fix1).
- 원본 HTML을 connector base64로 별도 회수해 해시를 직접 계산했다. `9add34fc341db08e6ef54e6e99d1fbfac6b39e7de61f5d8bd6415b32fa28ed1d`이며 실행 전후 기록과 동일하다.
- 허용 기준 `7e79392080157be693429da40d54c2a206b8aa7b`→e1은 fix1 경로의 31개 추가만, e1→ce91은 `continuity-addendum/`의 7개 추가만이다. 기존 첫 실패 자료를 덮어쓰지 않았다.
- 최종 커밋에서 두 manifest가 열거한 **36개 파일 전부**를 base64 원본 바이트로 한 번 회수해 크기와 SHA256을 대조했다. 36/36 일치, 불일치 없음. 두 manifest 자체는 자기 해시 대상이 아니며 별도로 읽었다. 로컬 대조 기록: `work/reading-fix1-audit/final/hash-verification.json`.

## 실행 결과를 구분한 판정

| 자료 | 실제 브라우저 / 판정 | 기록된 결과 | 실제 프로세스 종료 |
|---|---|---|---|
| `harness-first/` | 첫 실제 실행, 로컬 60단계 완주 | 54 PASS / 6 FAIL / 외부 2 NOT_RUN | 1 |
| `output/` + `verify.py` | 두 번째 실제 실행, 로컬 60단계 완주 | raw 60 PASS / 외부 2 NOT_RUN | 0 |
| `assessment.json` + `assess-recorded.py` | 두 번째 기록의 오프라인 보수 판정, 브라우저 재실행 아님 | 54 PASS / 내부 6 NOT_RUN / 외부 2 NOT_RUN | 1 |
| `continuity-addendum/` | 빠진 내부 읽기 연속성 6경로만 추가 실제 실행 | 6 PASS / 0 FAIL, 6/6 완주 | 0 |

각 종료값은 JSON과 별도 `process-exit.json`, 마지막 로그와 일치한다. 첫 6 FAIL은 모두 `switch-same-peek`의 scrollTop 절대 픽셀 일치 조건이다. 두 번째는 이를 단순 `previewTop>0`로 완화했으므로, 그 raw 60 PASS만으로 읽기 연속성을 인정할 수 없었다. 오프라인 판정은 이 증거 부족을 NOT_RUN으로 남겼으며 원본 결과를 소급 수정하지 않았다. 최초 실패 시점의 before 세부값이 반환되지 않은 곳은 새로 채워 넣지 않았고, 첫 진단 PNG는 보존되지 않았다는 한계도 유지한다.

추가 관측은 그 부족분을 채운 별도 증거다. 따라서 최종 해석은 **54개 기존 확인 + 6개 추가 확인**, 확인된 제품 실패 0개, 외부 2개 NOT_RUN이다. 과거 오프라인 assessment의 exit 1이나 raw 실행 결과가 변경되었다고 쓰면 안 된다.

## 동작·완주·실측 확인

기존 실행은 A/B × 1440×900·390×664·390×844의 6조건, 조건별 10단계다. JSON의 예상 60개 ID가 각각 정확히 한 번 존재하며 누락·중복이 없다. 공통 25 fact ID/순서, 핵심 실제 텍스트, 초기 닫힘, 닫기/Escape, 같은 근거 전환, 재열기/다른 근거 초기화, P02 출처 부재 이유, 원문 링크 속성, 문서 가로넘침을 검사한다. 작성자의 203개 수치를 목표로 맞추지 않았다.

클릭은 화면/스크롤 조상 clipping과 중앙 hit-test를 먼저 검사한 뒤 일반 Playwright click을 사용한다. 강제 클릭, 앱 함수 호출, CSS/상태 주입, 원문 스텁/route fulfill은 없다. 본문 위치 준비의 DOM scrollBy/scroll_into_view와 **미리보기의 실제 mouse.wheel(0,240)**는 별도로 기록되어 있다. 본문 전체를 휠/터치로 탐색했다고 해석하면 안 된다.

닫기 버튼·Escape 12왕복 모두 preview wheel +240 / body delta 0, 닫은 뒤 실제 출발 버튼 focus, 클릭한 f14 선택 유지, aria-expanded=false를 확인했다. body scrollY 및 출발 버튼 top 차이는 모두 0이며 clamp 사용은 0건이다. 코드에는 1px 또는 경계 clamp 분기가 있으나 이번 PASS는 그 경계 예외에 기대지 않았다. 숨김은 속성만 보지 않고 display=none·본문/닫기 box=0도 확인했다. f14 재열기와 f19 새 근거는 previewTop=0 및 출발 맥락 표시를 확인했다. 문서 가로넘침 조건은 clientWidth 대비 1px 허용이며 모든 브레이크포인트·콘텐츠·터치 제스처를 전수 검증한 것은 아니다.

실제 환경은 Playwright 1.57.0, `/usr/bin/chromium` 154.0.8037.57, HTTP 200이다. 실제 URL은 첫 실행 `http://127.0.0.1:44859/reading-study.html`, 두 번째 `http://127.0.0.1:41967/reading-study.html`, 추가 관측 `http://127.0.0.1:38925/reading-study.html`이다. fatal/pageerror/cleanup 오류는 세 실제 실행 모두 없다. favicon 404 콘솔은 별도 기록이며 제품 JS 오류로 합산하지 않았다. 코드의 fatal·완주·hash·pageerror·cleanup 검사와 nonzero 종료 경로도 읽었다. 이번 감사에서 예외 주입 시험은 하지 않았다.

## 추가 6전환이 실제 검사한 것

`observe.py`는 같은 f14/E09를 열고 실제 preview wheel을 한 뒤 A→B/B→A를 정상 클릭한다. 단순 fact 일치나 scrollTop>0만으로 PASS하지 않는다. E09 `.evdl` heading 및 dt/dd 9개에 대해 다음을 before/after 원문으로 비교한다.

- 결정적 DOM ID와 immutable 텍스트 동일성.
- 텍스트 노드 Range.getClientRects의 줄 수·텍스트·상대 top/bottom.
- 보이는 줄 인덱스 동일성 및 pvScroll 읽기 창 기준 visible clip.
- 모든 해당 요소 상대 top/bottom·가시 clip 차이의 1px 이내 유지. 구현 수치 epsilon은 1.001px이며 관측 최대는 그보다 작은 **0.734375px**이다.
- 비어 있지 않은 읽기 영역(각 before에서 8~9개 노드), 같은 source IDs/선택, 바뀐 표현의 출발 설명, 현재 f14 expanded.

여섯 JSON 모두 위 검사가 실행돼 PASS했다. previewTop은 240→218/217/262로 달라졌지만, origin 높이는 ±22.265625px, scrollHeight/max는 ±22px 변하고 clientHeight는 유지됐다. 텍스트/줄/clip의 최대 상대 차이는 0.734375px이며 0 또는 max로 초기화된 전환은 없다. 이는 **실제로 관측한 wheel 240 위치의 같은 E09 읽기 구간 보존**을 뒷받침한다. 브라우저 scroll anchoring과 일치하는 현상이지만 내부 알고리즘을 계측한 증명이나 모든 읽기 위치에 대한 보장은 아니다. 추가 실행 시간의 원문 문자열은 `2026-10-15T16:31:21.464886+00:00`→`2026-10-15T16:31:30.309320+00:00`이다.

## 외부·시각 증거·남는 한계

외부 S03은 실제 GitHub 고정 blob href의 새 탭을 열었고 `net::ERR_CERT_AUTHORITY_INVALID`·응답 없음·`chrome-error://chromewebdata/`를 기록했다. TLS 우회나 로컬 대체를 하지 않았다. 탭을 닫은 뒤 로컬 상태 기록은 있으나 실제 원문을 읽은 왕복으로 인정하지 않았다. 두 번째 실행은 첫 실행의 차단 증거를 출처/해시와 함께 재사용하며 새로운 외부 성공으로 주장하지 않는다.

대표 PNG 2개를 **GitHub connector base64 → 로컬 원본 바이트 → view_image**로 직접 열람했다. `1440-B-E09-open.png`에서는 표의 선택 셀, 별도 우측 E09 미리보기, 닫기와 원문 이동 구분이 보인다. `390x844-B-E09-open-known-limitation.png`에서는 하단 미리보기와 위 본문 일부만 보이며 비교 상대가 동시에 확보되지 않는다. 이를 모바일 동시 대조 성공으로 쓰지 않는다. 나머지 PNG 2개는 바이트/해시만 검증했다. 스크린샷 자체는 클릭·연속성 검사의 대체 증거가 아니다.

v0 시각 불일치 주장은 감사자 표시 파이프라인 오류로 철회됐다. 원본 UTC 문자열 및 base64/UTF-8/로컬 raw 해시는 같았다. 기존 미해결 addendum은 역사 자료로 보존되고, 새 `continuity-addendum/V0_TIME_ADDENDUM.md`가 이 정정을 명시한다. 새 환경 복원이나 전체 제품 동작을 이번 결과로 추론하지 않는다.

