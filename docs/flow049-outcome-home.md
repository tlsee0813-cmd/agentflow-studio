# FLOW049 — 목적 중심 프로젝트 홈

기준 개발 HEAD: `61c3b2f063a0f25edf53dbd709a85a27e41d8815` (제품 `dfc1bb92`와 동일).
별도 후보 브랜치: `flow049/outcome-home`. main·gh-pages·실AI 배포는 변경하지 않는다.

## 바뀐 흐름과 상태 소유권 (FIX051 반영)

자연어 요청 → 이번 요청과 앞서 전달한 방향을 구분하는 홈 → 기존 작업문 전달 → 정확한 결과 JSON 또는
붙여넣기 → 같은 연결에서 결과·사용자 기준 읽기 → 방향 수정 → 원문과 유지 조건을 포함한 다음 작업문.
명확한 요청은 기존처럼 바로 전달한다. 첫 작업이라는 이유로 조사·승인 왕복을 추가하지 않는다.
작업문은 목적 변경·사용자 선택·의미 있는 결과 때 돌아오도록 안내한다.

- Source/Basis/Task가 계속 유일한 저장 원본이다. 홈은 `outcomeOf`에서 부모 연결의 첫 request Source ID를
  기준점으로 도출한다. 별도 목적 문서나 현재 요약을 저장하지 않으며 기존 project.1/.2/.3 복구와 return.1은 유지한다.
- 출발 원문은 추적 이력이며 현재 목적의 큰 제목이 아니다. 이번 요청과 앞선 방향/요청을 따로 보인다. 기준이 여러 개면 임의로 하나를 채택하지 않는다.
  최신 사용자 요청과 AI/모의 제안·직접 조정·미확정 제안을 분리한다. 이유는 사용자 원문에 있는 범위만 보인다.
- 보고는 해당 작업 연결과 기존 인접 반환 묶음으로 표시한다. 같은 작업의 별도 report/evidence를 함께 보여 주지만
  다른 작업의 반환을 현재 요청에 합치지 않는다. 경로 밖 요청은 다음 요청 뒤에도 남고 진행·완료로 추정하지 않는다.
- 정확한 파일 결과는 JSON 본문을 홈에 보여 주며 원본 파일/연결 ID는 보존한다. 수동 보고는 판본 미확인이다.
  보고자·방법·환경·버전은 원문에 기재된 범위만 알 수 있다. 수신·로그 첨부를 실행·수용·완료 등급으로 바꾸지 않는다.
- API의 키·버전, prompt/provider/validator, 저장 형식은 불변이다. HTTP 문맥은 현재 입력과 기존 인접 반환 묶음을 사용한다. 오래된 출발 요청을 Source로 중복 추가하거나
  발췌 면제하지 않는다. 원문은 Basis/출처에 보존하고 크기 초과는 기존 128 KiB 경계에서 정직하게 거절한다.
- 서버판과 정적판은 같은 UI/도메인을 쓴다. 정적 빌드의 새 shared 모듈만 포함하며 서버 adapter/provider/prompt와
  네트워크 호출은 포함하지 않는다. 공개 Pages에 게시하지 않았다.

## 최초 FLOW049 검증과 인계 (dbbb22b 대상)

Linux / Node 22.16.0 / TS 5.8.3 / Playwright 1.57.0 / Chromium 143.0.7499.0.
기존 고정 버전 도구를 재사용한 PATH bootstrap이며 새 `npm ci`나 Windows 실행 성공을 주장하지 않는다.

최종 후보: 타입·문법·클라이언트 경계, 서버/정적 build, continuity Node **115/115**.
실제 localhost/mock 브라우저: 기존 continuity **13**, UI001 **11**, FRESH033 **3**, SELECT035 **3**,
CONNECT039 **5**, 새 FLOW049 **3**; 정적 서브경로 **1**. 각 pass, fail/error/skip 0.
기존 장애·지연·설정·저장 주입 검사는 순수 사용자 동작과 구분하며 실제 AI/로컬 개발 도구를 실행한 증거가 아니다.
새 흐름은 공개 합성 입력과 합성 결과 파일을 사용하며 UI 밖 프로젝트 상태 주입 없이 수행했다.
새 아이디어/문구 수정/비화면 성능 요청, 정확 반환/수동 반환, 형제 보고·자료, 다음 HTTP/Markdown 원문,
기준·수동값·JSON 복구, 늦은 응답·낡은 질문·A/B 분리 경계와 390/1440 화면을 확인했다.

중간 실패도 구분한다. 홈 추가 후 대기 표시가 viewport 밖에 있던 UI02는 홈 위 배치로 고쳤다.
출발 요청을 추가 전송하면서 바이트 fixture의 첫 원문 패딩이 두 번 계산됐다. I17/I22는 단일 전송되는
오래된 기준을 패딩하도록 수정했으나 이것은 실제 크기 회귀를 가렸다. FIX051에서 제품 중복 전송을 제거하고
원래 index0 패딩을 복원했다. 정확한 131072 bytes 수용 / 초과 거절 assertion은 계속 유지한다.
읽기전용 보조 검토의 형제 report/evidence 누락은 기존 반환 묶음 함수를 공유해 수정하고 회귀를 추가했다.
부모 build/정적 시험의 최초 잘못된 cwd와 누락된 기존 cases fixture는 실행 준비 오류였으며 제품 실패와 구분한다.

재현은 `app/`에서 기존 설치 후 실행한다:

```sh
npm run build
node continuity/scripts/check.mjs
node continuity/scripts/build.mjs
node --test continuity/tests/*.test.mjs
node continuity/scripts/build-static.mjs
python continuity/tests/flow049_browser.py
python continuity/tests/static_browser.py
```

기존 CI 게이트는 유지하고 FLOW049 native 단계만 추가했다. 새 테스트는 `test-results/flow049`에 합성 요청·
작업문·반환·백업과 desktop/mobile 화면을 남긴다. CI·독립 리뷰 결과는 이 로컬 검증과 별도 확인한다.

## 남은 경계

첫 요청 ID는 추적 기준점이지 의미상 같은 목적이라는 사용자 확정이 아니다. 독립 목적 여러 개의 관리,
코드 영향 자동 판정, 자동 로컬 실행, 학습/역할/그래프는 구현하지 않았다. 일반 변경 발언을 자동 확정 정책으로
만들지 않으며, 코드 현실은 로컬 도구의 자료와 구분한다. 실제 AI 초안 품질과 사람의 시간 절감·고객 효용은
이번에 측정하지 않았다. 이 후보는 총괄 및 독립 검토를 기다린다.

## Windows CI 후속 — 합성 반환 파일의 개행 보존

`dbbb22bd96c4fe1987a655dc2ee7159840d0650a`의 CI `38384891052`는 Ubuntu 성공,
Windows step19 실패·step20 정적 검사 skipped다. 위 로컬 성공과 구분한다.
Windows job `115254117895`의 test_01은 `flow049_browser.py:39`에서 보존된 rawText의 CRLF와
기대 raw의 LF를 비교해 실패했고 test_02/03은 통과했다. 실제 artifact의
`flow049/flow049-synthetic-return.json`은 496 bytes, CRLF 7개/bare LF 0개였으며,
기대 JSON 문자열을 Windows 개행으로 쓴 바이트와 정확히 일치했다. artifact ZIP SHA256:
`d44cd12196dd71ad8fad03539f68380a1549d09f26f4597289181ef8484fb908`.

원인은 fixture의 `Path.write_text` 기본 개행 변환이다. 제품은 업로드된 원문을 그대로 보존했다.
파일 생성만 `write_bytes(raw.encode('utf-8'))`로 고쳐 양 OS에서 같은 기대 바이트를 업로드한다.
원문 완전일치 assertion·나머지 수용조건·skip·timeout·CI·제품 코드는 그대로다.
로컬에서 Windows식 text-write 변환을 명시 주입해 같은 line39 실패를 재현했다(Windows 실행은 아님).
수정 후 같은 재현 조건 1/1, Python 문법, 기존 FLOW049 native 3/3이 통과했다.
새 커밋의 양 OS CI 최종 결과는 해당 Actions run에서 별도로 확인한다.


## FIX051 — 독립 검토 재현과 수정

기준 HEAD `ce21fe8e09bd9b8c02dd33ea0eb90886df151484` 및 원격 blob 일치 확인. 변경은 제품 3파일,
기존 검사 5파일, 이 문서에 한정한다. prompt/provider/API/project/return 형식·CI·CSS는 변경하지 않는다.
앞선 Windows fixture 수정과 독립 변경을 보존한다. 원래 115/39는 dbbb22b의 로컬 검사이며 이번 결과와 구분한다.

- **R1 수용:** 회원가입 필수 → 링크 취소로 방향 변경 → 버튼 색 수정의 3턴에서 종전 홈 큰 제목이
  첫 발언에 고정됨을 재현했다. 이제 큰 제목은 **이번 요청**, 이어온 방향은 별도 펼친 영역이다.
  `방향/목적/목표를 바꿀게: …`처럼 명시한 선언은 이후 작은 요청에도 남는다. 이 표식은 화면의 탐색 보조이며
  정책의 의미 병합·폐기 권한이 아니다. 다른 표현도 직전 요청 원문으로 자동 표시하므로 특수 문법을 입력해야만
  진행할 수 있는 것은 아니다. 자연어 전체의 목적 요약을 구현했다고 주장하지 않는다.
  바로잡기에서 사용자는 내용만 고치며 내부 Basis ID를 선택하지 않는다. 기존 `editBasisDraft/recordBasis`를
  사용해 초안·직접 정정·이전을 구별한다. 명시적 변경 발언은 기존 요청 경로로 즉시 전달되며 추가 승인이 없다.
  최초 원문과 요청 기준은 삭제하지 않는다. 이전 요청은 작업문에서 **후속 변경을 우선하는 원문 참조**로 분리하고
  현재 지시와 함께 강조하지 않는다. 어떤 기존 문장이 철회됐는지 임의의 의미 판정으로 저장 값을 덮지 않는다.
- **R2 수용:** 11,000자 + 짧은 중간 요청 + 11,000자는 종전 `CONTEXT_TOO_LARGE`.
  동일 자체 입력의 base61c3b2f와 수정 후 요청은 모두 **100,676 bytes**다(검토자의 다른 중간 입력은 100,665).
  출발 Source 중복 삽입과 출발 Task의 발췌 면제를 제거했다. I17/I22 첫 기준 index0 패딩을 복원했다.
  정확히 131,072 bytes 수용, +1 원자적 거절, 오래된 무편집 요청만 압박 시 발췌, 원문 저장·복구 보존을 유지한다.
- **R3 수용:** 부모 연결을 현재 목적의 의미 판정으로 쓰지 않는다. 독립 차트 변경의 현재 요청을 앞에 표시하며,
  오래된 출발 원문은 Source/목적 연결 문구로 반복 강조하지 않는다. 답변·직접 확정 조건과 과거 요청 참조는 구분한다.
- **R4 수용(기존 구조의 한계):** A→B→늦은 A 보고→다음 요청에서 B 표시가 사라짐을 재현했다.
  경로 밖 요청 목록을 유지한다. B를 현재 parent로 재연결하거나 B 보고를 혼합하지 않는다.
- **R5/6 수용:** 읽기 전용 제안 복제를 제거해 기존 편집칸 하나만 남긴다. 기술 제안을 고객 경험 제안으로
  부르지 않는다. 결과·다음 행동을 먼저 보이고 범위 한계는 상세에 둔다. 긴 요청은 홈에서 기존 3줄 미리보기를
  사용하며 원문 전체·이력은 열어 읽는다. 관측 등급은 없다.

이번 Linux 로컬: Node22.16/TS5.8.3 기존 PATH 도구. 타입/문법/경계 검사, 서버·정적 빌드,
continuity Node **118/118**. 실제 localhost/mock FLOW049 **5/5**(새 방향 3턴·정정/복구와 긴 요청·늦은 반환 포함),
기존 continuity browser **13/13**, UI001 **11/11**, FRESH033 **3/3**, SELECT035 **3/3**, CONNECT039 **5/5**, 정적 서브경로 **1/1**.
390/1440에서 방향 변경·긴 원문·반환 후 진행, 실제 POST/Markdown/JSON 원문과 parent를 확인한다.
합성 보고·명시적 mock이며 인간 시간 절감/실AI 내용 효용/실제 외부 구현을 검증한 결과가 아니다.
중간 회귀 검사에서는 기존 F049의 “첫 Source를 늘 보내야 함” 기대 1건이 실패했고 새 전송 정책에 맞게
“Basis 원문 보존 + 중복 Source 없음”으로 교체했다. 크기/원문/보호 assertion을 완화하지 않았다.
양 OS 최종 CI는 이 브랜치의 해당 커밋 PR 검사로 확인하며 로컬 실행과 구분한다. main·Pages·실AI 배포는 하지 않는다.

재현은 위 명령과 기존 `ui001_browser.py`, `fresh033_browser.py`, `select035_browser.py`,
`connect039_browser.py`를 사용한다. SELECT035는 기존 CI의 공개 합성 fixture 환경변수를 따른다.
새 화면/POST/다운로드 자료는 기존 FLOW049 CI artifact에 `fix051-*`로 남는다. 새 평가 하네스는 없다.


FIX051 CI 후속: `f5672f98e396dc5b1a99847d2a3dfa320229d0e3`의 run `38390626743`은
Ubuntu 성공, Windows CONNECT039 test_03 실패(뒤 홈/정적 skipped)였다. 실제 line101 traceback은
클립보드 무효화 안내 기대에 빈 notice였다. `recovery()`가 이미 화면에 있던 동일 프로젝트 이름만
기다려 파일 읽기/교체 전에 반환했고, 늦은 복구 렌더가 안내를 지우는 순서를 허용했다.
로컬에서 세 번째 File.text 읽기 250ms 지연과 관찰 시점 조절로 같은 assertion 실패를 재현했다
(Windows 실행으로 주장하지 않는다). helper만 해당 복구의 확인창 수락과 이전 작업 카드의 교체까지
기다리게 고쳤다. 기대문구·상태 불변·클립보드 무효화 assertion, timeout/skip, 제품은 변경하지 않았다.
같은 지연 재현은 수정 전 0/1 → 수정 후 1/1, 기존 CONNECT039 전체 5/5 통과다.
최종 브랜치 HEAD의 새 CI 결과는 이 실패 run과 구별한다.


## REVIEW052 / FIX053 — 반환 작업의 유효 범위

총괄이 전달한 REVIEW052는 `fce7f29cd9976217a98c0ab5d7c443dc300aeae0` 독립 빌드/최소재현에서
원래 R1~R6 해결·새 치명 결함 없음, N1 수정 조건부 수용으로 판단했다. 이번에는 N1만 재현·수정했다.
요청 “예약 취소 기능을 만들어줘. 환불은 이번 범위 아님” → 내보내기 → “테스트 2개 실패, 남은 일: 실패 수정”
보고의 작업문에서, 같은 요청을 실행 범위로 지목하면서 과거 참고로도 분류하는 모순을 확인했다.
원인은 `earlierRequests`가 보고 Task의 sourceIds만 현재 입력으로 보았기 때문이다.
작업문 분류의 currentSources에 `outcome.request.id`를 포함해 유효 요청과 환불 제외를 현재 기준으로 유지한다.
HTTP contextParts/buildRequest·발췌 정책·저장 원문은 불변이며 첫 Source 중복 전송을 되살리지 않는다.

회귀 **1개**(붙여넣기 report/evidence 및 정확 return 파일의 동일 범위)를 추가했다. 수정 전 현재 기준 분류
assertion 실패 → 수정 후 통과. 관련 domain/작업문/I17·I22 128KiB/CONNECT039 Node **84/84**,
타입·문법·경계 검사와 서버/정적 빌드, 실제 localhost/mock UI 1흐름이 통과했다.
UI에서는 실제 보고 작업문 다운로드의 유효 요청·제외 조건과 explicitReplacement 후 현재 값 표시를 확인했다.
부가 문구는 최대 세 종류 원문에 맞춰 “출발 · 방향 · 이번 요청 원문 보기”, 원문과 다른 Basis 값에는
“기준의 현재 값”으로 교정했다. 구조 확장·기존 R1~R6 재설계·실AI 평가는 하지 않았다.
방향 선언 탐색 보조, 자유문장 전체 의미 병합 아님, 다목적 미구현이라는 기존 한계는 유지한다.
최종 양 OS CI는 이 수정 커밋의 PR 검사로 확인하며 위 로컬 실행과 구분한다.


## WEB054 — 검토 완료본의 공개 MOCK 갱신

검토·FIX053 수용 소스 `1454c6ff369b49243b5fc07ba91af8365f9e6cc8`의 [CI38398192356](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/38398192356)은 양 OS 성공·skipped 0이다. 같은 잠금 의존성과 Node22.16/TS5.8.3으로 정적 빌드 후 13파일192239B·상대자산/import closure·connect-src none·MOCK adapter·서버/비밀 제외를 확인했고 원격 게시물과 바이트 동일했다. 전체 검사는 반복하지 않았다.

게시 커밋 `1033f0654762baeea870e5350045acea61b92c9c`를 `gh-pages`에 비강제 반영했고 [Pages 배포38400559735](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/38400559735)는 성공했다. 공개 주소는 https://tlsee0813-cmd.github.io/agentflow-studio/ 이다. Cloud의 기존 프록시 제한으로 새 공개 UI는 재접속하지 않았으며 총괄 IAB 확인에 인계한다. 게시 성공과 공개 UI 실제 검증은 구분한다. main·기존 개발브랜치·PR1과 서버/실AI 경로는 보존했고 PR2는 Draft다. 앞선 미게시/검토대기 문구는 당시 기록이며 이번 갱신으로 일반 품질·고객 효용을 입증한 것은 아니다.

## AI055 — 자연어 목적 해석을 다음 작업에 연결

기준 `57ec3b24771bf273a83e0a8df8c0c6f8ffaa9883`(WEB054 문서 포함)을 읽고 제품 파일이 FIX053과
같음을 확인했다. 위 API/prompt 불변·방향 선언 탐색 제한은 당시 구현 기록이며 아래가 이번 변경이다.
기존 DeepSeek 경로는 최신 발언 우선 지시가 있었으나, 목적 해석을 다음 턴으로 옮기는 구조가 없었다.
`runtime → /api/continuity → provider.callContinuity → prompt.buildBody → validateEnvelope → receive`
한 경로에 연결했다. 다른 generator/평가 AI/자동 재호출은 없다.

- HTTP는 `idea022.context.5`: 기존 필드 + `previousIntent`. 응답은 기존 8키 + `intent` 1키이며
  `intent.1`의 목적, 관계(start/continue/revise/separate/uncertain), 유지 조건, 대체된 지시,
  Basis ID/sourceId/revision 참조를 가진다. 현재 입력의 기준 참조 누락·틀린 버전/출처·발췌를
  전문인 듯 인용한 응답은 적용 전 거절한다. 의미 정확성·사용자 확정·코드 현실을 증명하는 검사는 아니다.
  uncertain 자체로 질문을 강제하지 않는다. 이미 보류한 답 뒤 질문 없이 미정을 유지하는 경계도 검사한다.
- Task.advice가 AI 해석의 유일한 저장 위치다. 원문/Basis를 덮거나 요청을 의미상 같은 목적이라고
  부모 ID만으로 단정하지 않는다. 직전 유효 해석을 조건부 배경으로 전달하고 현재 요청과 함께 재해석한다.
  중간의 미정리 요청을 뛰어넘어 옛 해석을 현재라고 골라내지 않는다. 원문 발췌 정책과 정확 128 KiB
  경계는 유지하며, 참조가 발췌되면 해석 전달을 빼고 원문 확인 경로를 남긴다.
- 홈에서 목적·유지 조건과 이번 작은 요청을 구분한다. 정리는 AI 또는 MOCK으로 표시하며 자동 적용에
  매번 승인창을 붙이지 않는다. ‘정리 바로잡기’/‘직전 정리로 되돌리기’는 기존 manual.understanding/
  scope를 편집한다. 별도 현재 목적 사본을 만들지 않는다. `Task.intentEdit`는 `intent-edit.1`의
  정정 revision만 기록한다. 정정 전 AI 행동·질문은 제외하고, 재정리에 직접 수정 값을 넣으며 응답은
  수동 값을 덮지 않는다. 기존 수동 next/checks도 보존한다. 정정 자체는 AI를 호출하지 않는다.
- 저장 project.1/.2/.3 및 intent 없는 기존 8키 advice를 읽는다. project.3 안의 버전 있는 추가 객체는
  선택 필드다. 옛 앱이 새 확장 자료를 읽는 역방향 호환을 주장하지 않는다. return.1·원문·정확 반환
  식별은 불변이다. 서버와 정적판의 UI/domain은 공통이며 정적 번들은 명시 MOCK·네트워크 차단을 유지한다.

검증: Node22.16/TS5.8.3 offline bootstrap, 타입/문법/서버 경계, 서버·정적 빌드와 continuity Node
124개(기존 119 + AI055 5), 새 native HTTP 1흐름, 기존 홈 5흐름, 정적 경로/복구 1흐름을 실행했다.
새 native는 **손으로 작성한 의미 응답 fixture**를 기존 HTTP 앱의 mockImpl에 넣고 네 번 UI 입력→
HTTP→목적/유지조건→실제 Markdown 다운로드→직접 정정→새로고침→재정리를 확인했다. 저장/응답 주입은
없다. 390/1440 화면에서 가로 넘침 없음. 이것은 의미 정리 연결 검증이지 모델의 자연어 이해 통과가 아니다.
기존 I17/I22의 버전/응답 예시 기대는 새 계약에 맞췄고, B05의 원문 8키 내용은 바꾸지 않고 합성 intent만
감쌌다. F033의 ‘동일 조언 보존’은 새로 만든 다른 UUID 프로젝트와 비교하던 대신 동일 프로젝트의
수정 전 스냅샷과 비교한다. 원래 stale 거절·정확 크기·원문 보존 assertion은 유지한다.
초기 검사에서 새 mock의 manual_decision 참조 누락과 직접 정정의 재정리 입력 누락을 발견해 수정했다.
첫 CI38409301665의 Ubuntu browser.py test_09가 8키 성공 fixture의 새 intent 누락으로 실패했다.
동일 assertion을 로컬 재현한 뒤 fixture에 정확한 요청 기준 참조만 추가했고, 원래 stale 제외·복구·수동값
assertion은 바꾸지 않았다. browser.py 전체 13/13도 통과했다. 제품 validator를 완화하지 않았다.
최종 커밋 양 OS CI는 PR2에서 별도로 확인한다. 이전 성공 CI와 이번 로컬 결과를 합산하지 않는다.

실AI는 미실행이다. 이 환경에 이미 구성된 안전한 제공업체 서버가 확인되어 있지 않아 키·비밀 설정을
찾거나 유료 옵션을 켜지 않았다. 원래 DeepSeek adapter의 승인·서버 비밀 경계·출력 한도·1회 호출을
그대로 쓴다. 따라서 자연어 유지/철회 판단, 불필요 질문 정도, 사람 시간 절약은 **미검증/미측정**이다.
MOCK 기본 응답은 입력 인용만 하고 새 자연어 해석 능력을 흉내 내지 않는다. 여러 목적 동시 관리·의미
전체 병합·코드 영향 판정은 구현하지 않았다. 틀린 해석은 직접 정정 가능하지만 참조 검사만으로 잡히지 않는다.

### 보호된 실행 경로로 넘길 최소 실AI 확인

`app/continuity/tests/ai055-cases.mjs`의 공개 합성 7사례를 각각 새 프로젝트에서 실행한다.
**turns의 문자열만** UI에 입력한다. observe/사례 ID/fixture 응답은 모델 입력에 붙이지 않는다.
기존 안전한 서버 설정 그대로 서버 빌드 후 기존 `node continuity/server/index.mjs` 경로를 사용한다.
`/api/config`의 DeepSeek/설정/유료 승인 상태는 UI로 확인하며, 이 인계가 설정 변경 명령은 아니다.
각 턴의 실제 HTTP 요청·응답, 홈, 다운로드, 백업을 남긴다. 추가 질문은 알려진 사실에만 답하고 새 정책은
미정으로 남긴다. 모호한 사례는 질문의 정확한 문장이 아니라 선택의 효과를 읽는다.
06은 첫 작업 내보내기→목적 직접 정정(링크 12시간/환불 제외)→별개 통계 요청→첫 작업의 정확 반환 파일
(‘가입 제한 구현’이라는 **합성 늦은 보고**, 실행 증명 아님)→‘버튼 문구도 짧게’를 UI로 진행한다.
관찰자는 유지/철회/미정을 원문 및 9키 전체·다음 payload·Markdown에서 대조한다. HTTP200이나 모델
자기평가를 성공으로 세지 않는다. 기존 네 턴에서 가입 조건 재지시/환불 제외 누락, 별개 목적 강제 상속,
수동 수정 손실이 나오면 실제 원문으로 좁게 판단한다. 좋은 답이 나올 때까지 자동 반복하지 않는다.
로컬 기능 재현은 `node --test continuity/tests/ai055.test.mjs`,
`python continuity/tests/ai055_browser.py`(후자는 명시 합성 MOCK)이다. 둘 다 app/에서 실행한다.

## FIX058 — 목적 정정과 작업 필드 분리 (별도 브랜치 `fix058/intent-edit-separation`)

기준 `d5ef9a4458144901148a60eda342d78e5f3890f4`(제품은 REVIEW056 대상 `8b23cdf`와 동일). Work 연결 장애로 독립 검토자가 구현했고 최종 확인은 별도 검토자가 한다.

- B1: 작업 카드의 이해/범위 직접 수정은 그 작업의 작업 지시일 뿐이다. 다음 턴 `previousIntent.manualGoal`·홈 ‘직접 정정’으로 승격하지 않는다.
- B2: 목적 정정은 `Task.intentEdit`(`intent-edit.2`: revision·goal·conditions)에만 저장하고 `manual.*`를 덮지 않는다. 정정 뒤 낡은 AI next/checks·질문 제외는 유지되며, 사용자가 쓴 좁은 범위와 현재 요청 원문이 작업문에 남는다. AI 해석이 낡아도 정정은 홈·작업문에 보이고 재정리 요청에 실린다.
- `intent-edit.1`(이전 후보 저장값)은 복원 시 정정 내용을 복사해 `intent-edit.2`로 한 번 변환한다(`manual.*`는 그대로).
- N1: AI의 retired는 이전 요청 원문의 표현에만 적용하고 확정·답변·보류 기준을 대체하지 않는다고 작업문·홈에 표시한다. 사용자 결정이 있으면 그 ID를 해석보다 우선하는 현재 조건으로 명시한다. 사용자 결정의 변경은 요청 원문이나 직접 수정으로만 일어난다. prompt에 같은 규칙을 추가했고 실제 모델 준수는 미검증이다.
- N2: 새 응답에서 `separate`+retired, 같은 문장의 conditions/retired 동시 기재를 거절한다(저장된 기존 advice는 그대로 읽음). N5: MOCK 작업문 라벨은 ‘MOCK 정리 / 의미 이해 아님’.
- 남은 한계: partial 기준 인용 시 응답 전체 거절(N3), 큰 previousIntent를 줄이지 않고 128 KiB에서 거절(N4), retired는 여전히 ID 없는 자유문이라 어떤 요청 표현을 대체했는지 앱이 결정적으로 알 수 없다. 검증은 손으로 쓴 합성 응답·명시 MOCK이며 실DeepSeek 해석 품질은 별도 평가가 필요하다.
- FIX059: 유효한 AI 해석이 없는 첫 작업에서 정정 뒤 새 확정 기준을 기록해도, 다음 요청에 `previousIntent.value=null`과 사용자 정정이 함께 실린다(가짜 AI 해석을 만들지 않음; `value=null`은 정정이 있을 때만 검증 통과). 발췌 기준에 기댄 AI 해석은 빠지되 정정은 남는다. `intent-edit.1` 복원 뒤 일반 작업 편집은 목적을 바꾸지 않는다. FIX061: 모든 `intent-edit.1`은 첫 복원 때 v2로 확정 변환하고 결과를 재검증한다. 비공백 목적이 없으면(빈값·공백·조건만) 목적을 지어내지 않고 `goal:null`로 옛 AI 문구·질문 제외 revision만 유지하며, `manual.*`는 그대로 둔다. 이후 편집·저장·재복원이 `manual.*`를 목적으로 읽지 않는다. `idea022.context.5`는 미공개 후보 계약이라 버전명을 유지했다.

재현: `node --test continuity/tests/fix058.test.mjs continuity/tests/ai055.test.mjs`, `python continuity/tests/ai055_browser.py`(app/에서).

## FIX066 — 실제 DeepSeek 의미 실패(AI060)의 구조 원인 수정 (`fix066/intent-action-consistency`)

AI060(기준 `2750b58`, deepseek-flash 9회, 증거 `docs/evidence/AI060-semantic-failures.md` @ `c417c2a`)에서 HTTP·계약은 모두 통과했지만 의미 실패가 관측됐다. 원문 판정은 다음과 같다. P1·P2 입력에는 가입 제한을 철회한다는 명문이 없으므로, 이번 수정은 "가입 철회 위반"을 정답으로 고정하지 않는다.

- P1 구조: 3턴째 버튼 색 작업이 `separate`로 해석되자, 4턴째 `previousIntent`에는 그 해석만 실리고 2턴째의 유지/대체 해석이 사라졌다. 이제 `previousIntent`가 separate이면 같은 경로에서 더 앞선 separate가 아닌 유효 해석을 `purposeIntent`로 함께 보낸다(AI 해석이며 기준을 바꾸지 않는다. 낡은 해석은 건너뛰지 않는다. 계약 `idea022.context.6`).
- P2 구조: 정정된 작업의 정정 전 request 원문이 AI에는 "이번 입력"으로, 작업문에는 "현재 값"으로 정정과 나란히 나갔다. 이제 정정은 이 작업에 귀속(`previousIntent.taskId`=현재 작업)되고, 작업문은 그 원문을 "정정 전 이 작업의 요청 원문 — 양립하는 조건은 유지, 충돌·불명확은 확인" 구간에 보존한다. 사용자 결정(확정·답변·보류)은 그대로 현재 조건이다.
- prompt: 같은 작업의 정정과 원문의 관계, 보존이 '그대로 유지' 단정이 아님, purposeIntent의 의미, next로 넘긴 사실의 재질문 금지, 원문에 없는 시점·조건 창작 금지(P3)를 추가했다. P3은 입력 결함이 아니라 모델 불이행 후보다.
- 검증은 손으로 쓴 응답(관측 형태)과 MOCK이다. **수정 후 실DeepSeek 재검증은 아직 하지 않았다.**
- FIX069(AI068 @ `41245ec`, 후보 `baa94ae` 실DeepSeek 6회): P2 직접 정정은 실제 next/checks에 반영됐다. SMS-only는 현재 confirmed 기준으로 작업문에 있으므로, checks에 배타성 문장이 없다는 이유로 결함 판정하지 않았다. P1은 같은 기능의 색·문구 수정을 `separate`로 해석해 앞선 목적을 "무관/적용하지 않음"으로 서술하고 목적 표시도 작은 작업만 남았다. 다만 범위가 로직을 건드리지 않아 기능 파괴는 아니다. 수정 방향은 두 축의 분리다. prompt에서 relation을 고객 결과의 관계로 정의하고(수정 범위의 크기는 scope로), 유효한 조건을 "적용하지 않음"으로 쓰지 않게 했다. 작업문·홈은 `separate` 해석 옆에 계속 유효한 앞선 목적(AI 해석, 바꾸지 않음)을 결정적으로 함께 표시한다. 기준 상태는 바꾸지 않는다. 실DeepSeek 재검증은 아직이다.
