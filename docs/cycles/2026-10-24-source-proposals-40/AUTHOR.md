# 작업40 — 출처 있는 연결 대기 제안 검토 (작성자 기록)

2026-10-24 KST. Claude 구현 담당의 **작성자 주장**이다. 독립 검증·수용·CI·배포 판단은 총괄 몫이다.

- 기준 `43af7412e44c49f0460323153224cdd641a89879`(checkpoint/2026-10-15 HEAD, 수용 app c7329aa와 app tree 동일)에서 시작을 확인했다.
- 브랜치 `product/source-proposals-40`. checkpoint/main/gh-pages에는 push·merge·배포하지 않았다.
- 입력: ACTIVE, QUESTIONS Q02/Q06, 관측39 RESULT·candidates3·source-manifest·project-manifest, 결합38 DECISION.
- 조사·DeepSeek 분류는 다시 실행하지 않았다. 세 후보의 보정·미확인 문장은 그대로 옮겼다.

## 선택한 최소 UX

1. 프로젝트 홈(내 프로젝트 목록) 예제 아래에 한 줄 진입 `기록 제안 검토 열기`만 둔다.
   - 홈에 보고서나 후보 목록을 펼치지 않는다.
2. 누르면 전체 창 크기의 별도 검토 화면(native modal dialog)이 열린다.
   - 처음에는 비어 있다. `검토 예제 열기` 또는 `제안 JSON 가져오기`를 사용자가 직접 눌러야 내용이 생긴다.
3. 왼쪽 열: 제안 목록(최대3, 모두 `연결 대기` 표시)과 출처 사실.
   - 출처 사실: 출처 ID, 선택된 사건 범위, 들어 있지 않은 것, 원본 전체 해시(기록값·확인 안 함).
   - 역할 수: 사용자 지시 / 총괄 해석 / 배정 예고 / 실행 관측. 실행 관측이 0이면 경고 문장을 붙인다.
4. 오른쪽 열: 제안 읽기.
   - 관측·보정/미확인·범위·이름/동일성·담당 변화·빠진 연결을 보여 준다.
   - 근거 발췌마다 행·역할·잘림 표시와 `원문 읽기`가 있다.
5. `원문 읽기`는 같은 열을 100% 글자 크기(16px, 줄바꿈 anywhere)의 텍스트 패널로 바꾼다. 지도 배율은 상속하지 않는다.
   - 발췌 문자열 해시와 원본 행 해시를 함께 보여 준다.
   - `이 발췌를 근거로 쓰는 제안`으로 제안에 돌아갈 수 있다.
   - 위·아래 `← 제안으로 돌아가기`는 원래 스크롤과 그 `원문 읽기` 버튼으로 초점을 돌려준다.
6. `닫고 돌아가기` 또는 Esc로 닫으면 홈의 같은 스크롤 위치와 진입 버튼으로 돌아간다.
   - 검토 상태는 이 탭 메모리에 남아 다시 열면 이어진다. 새로고침하면 사라진다는 문구를 머리말에 상시 둔다.
7. 적용·수신·연결 버튼은 없다. 없는 이유를 제안마다 한 줄로 적는다.
   - 프로젝트·초안·지도 memo·localStorage·sessionStorage를 읽거나 쓰지 않는다.

## 분리·제외·다시 검토·중복의 의미

- **제외**: 그 항목을 목록 아래 `제외한 제안`으로 옮긴다.
  - 알림의 `되돌리기`, 목록의 `되돌리기`, 화면의 `제외 되돌리기`로 언제든 복원한다.
- **다시 검토 표시**: 그 항목에 표시만 켜고 끈다. 판정이 아니다.
- **근거별로 분리**: 근거가 2개 이상인 묶음에서 옮길 발췌를 체크해 새 묶음으로 나눈다.
  - 원래 refs의 분할(partition)일 뿐이다. 복제가 아니며, 한 제안의 묶음 수는 근거 수를 넘지 못한다.
  - 최초3개 제한은 제안 수 기준으로 유지된다.
  - 나뉜 묶음에는 원래 해석을 사실로 붙이지 않는다. `원래 묶음의 해석 · 참고용(이 묶음의 사실 아님)`은 접힌 채로만 둔다.
  - `원래 묶음에서 확인되지 않은 것`은 분리해도 그대로 둔다. C3의 E07 잘림·실행 근거 없음도 유지된다.
  - 원래 묶음의 제외·다시 검토 표시는 나뉜 묶음으로 복사하지 않는다.
  - `분리 되돌리기`는 원래 한 묶음으로 돌리고, 나뉜 묶음의 표시는 지운다.
- **같은 입력**(pure helper `sampleKey`): 파일의 모든 필드가 같고 excerpts/proposals/refs/missing 배열의 **순서만** 다른 경우다.
  - 재가져오기·예제 재열기는 새 검토를 만들지 않는다. 기존 검토(제외·분리 포함)를 그대로 보여 주고 그렇다고 알린다.
- **다른 입력**: 같은 sourceId·제안ID라도 quote·refs·해석·역할·해시 중 하나라도 다르면 별도 검토가 된다.
  - 이전 제외·분리를 조용히 재사용하지 않는다. `changedSameIds`로 그 ID를 알림에 적는다.
- 같은 발췌 해시(`sameSourceRange`)는 원문이 같다는 사실일 뿐 의미가 같다는 판단이 아니다.
- 제안은 기존 부분·작업·handoff ID와 어떤 필드로도 연결되지 않는다.
  - 파일에 taskId·status 같은 키가 있으면 거절한다.
- 한 탭에서 동시에 검토하는 표본은 3개까지다. 넘치면 거절하고 기존 검토는 그대로 둔다. `이 검토 내리기`로 비울 수 있다.

## 입력 형식과 거절

- `agentflow.source-proposals.1`, 64 KiB 이하, BOM 없는 UTF-8 JSON.
- 구성: source(id,label,nature,rawSha256,totalLines), range(label,omitted), excerpts≤12, proposals 1~3.
  - excerpts: ref,line,role,kind,lineSha256,quoteSha256,quote,truncated,note.
  - proposals: id,label,refs,observed,fidelity,scope,identity,roleChange,missing.
- 추가 키, 제어문자, 중복 발췌 ref, 제안 안 중복 refs, 없는 원문 참조, 중복 제안 ID, 4개 이상, 잘못된 해시 형식, 범위를 넘는 행은 거절한다.
- 다른 schemaVersion(프로젝트 백업·결과 파일)은 그 이유로 거절한다. 크기 초과는 내용을 읽기 전에 거절한다.
- 발췌 문자열의 SHA-256은 WebCrypto로 다시 계산한다. 한 글자 변조+옛 quoteSha256은 `HASH_MISMATCH`로 거절한다.
  - rawSha256·lineSha256은 원본 JSONL을 읽지 않으므로 기록값으로만 표시한다. 임의 rawSha256은 받아들이되 "확인하지 않았어요"로 표시한다.
  - "원본 검증 완료"라는 표현은 쓰지 않는다.
- 오류는 검토 화면 안의 alert로만 알린다. 열려 있던 검토·제외·분리 상태는 바뀌지 않는다.
- 파일 글자는 모두 textContent로 넣는다. label/quote의 HTML은 글자로 보인다.

## 검토 예제

`src/shared/source-proposals-example.ts`는 관측39의 실제8발췌(행·행/발췌 해시·quote)와 보정된3후보를 손으로 다시 치지 않고 그대로 옮긴 것이다. 약8.5KB다.

- 역할 매핑: E01·E03 사용자 지시, E02·E08 총괄 해석, E04·E05·E06·E07 배정 예고. 실행 관측은 0이다.
- E07은 `truncated:true`, E07/E08에는 성공·적용으로 보지 않는다는 note를 붙였다.
- `missing`은 각 후보의 fidelity/identity/roleChange에 이미 적힌 미확인 항목을 다시 적은 것이며 새 분석이 아니다.
- 큰 JSONL·키·개인 경로는 없다. 단위 검사가 manifest/candidates3와의 일치와 키·경로 부재를 확인한다.
- 예제는 버튼으로만 열리고 프로젝트 목록·새 프로젝트에 들어가지 않는다.

## 변경 파일

- 새 파일
  - `app/continuity/src/shared/source-proposals.ts`: 순수 검사·동일성·검토 상태 helper.
  - `app/continuity/src/shared/source-proposals-example.ts`
  - `app/continuity/src/client/source-review.ts`: UI.
  - `app/continuity/tests/source-proposals40.test.mjs`
  - `app/continuity/tests/source-proposals40_browser.py`
  - 이 문서.
- 수정 파일
  - `app/continuity/public/index.html`: 진입 한 줄과 dialog 껍데기.
  - `public/styles.css`: SOURCE40 블록 추가만.
  - `src/client/app.ts`: import와 init 호출 3줄.
  - `scripts/build-static.mjs`: 정적 복사 목록에 `source-review.js`.
  - `tests/static_browser.py`: 게시 파일 목록에 새3모듈, 정적 CSP에서 예제 열기·저장 불변 검사 1개 추가.
  - `.github/workflows/verify.yml`: SOURCE40 단계 추가. 기존 timeout은 바꾸지 않았다.
- domain.ts·storage.ts·validation.ts·return.2·서버·의존성은 바꾸지 않았다.

## 실행한 검사 (작성자 환경)

환경: Linux 컨테이너, Node v22.22.0(CI 기준 22.16.0과 다름), npm ci 잠금 TypeScript 5.8.3, Python 3.13, Playwright 1.57.0.
브라우저는 사전 설치 Chromium 153.0.8010.12(`BROWSER_EXECUTABLE`), 실제 local HTTP, AI_MODE=mock, 유료 호출0.
아래는 최종 소스 트리(이 문서만 다른 커밋)에서 실행한 결과다.

| 검사 | exit | 결과 |
|---|---:|---|
| `node continuity/scripts/check.mjs` | 0 | type/syntax/client boundary 통과 |
| `node continuity/scripts/build.mjs` | 0 | |
| `node --test continuity/tests/*.test.mjs` | 0 | 287/287. 새 source-proposals40 8개 포함 |
| `node continuity/scripts/build-static.mjs` / `--preview` | 0 / 0 | |
| `python continuity/tests/source-proposals40_browser.py` | 0 | 6/6. 1280×720·1440×900, 소창 900×560·760×520 |
| `python continuity/tests/entry37_browser.py` | 0 | 10/10 |
| `python continuity/tests/map-priority36_browser.py` | 0 | 12/12 |
| `python continuity/tests/home15_browser.py` | 0 | 21/21 |
| `python continuity/tests/static_browser.py` | 0 | 4/4. 새 정적 CSP 예제 검사 포함 |
| root `npm run check` | 0 | 이 작업 전 단계(SOURCE40 소스 포함, root 무변경)에서 실행 |
| root `npm test` | 1 | 278/279. 실패1 `retest-init006` I6R은 `process.version==='v22.16.0'`을 요구한다. 이 환경은 v22.22.0이다. root 코드는 바꾸지 않았다. 성공으로 세지 않는다 |

SOURCE40 브라우저가 실제로 실행한 흐름:

- 홈 → 진입 → 빈 화면(예제 자동 열림 없음) → `검토 예제 열기` → C1 → E01 원문(정확 quote, 16px, 배율 없음, 가로 넘침 없음, 두 해시) → C1(초점 복귀).
- 제외 → 알림 되돌리기 → C2 제외 → 목록 되돌리기.
- C3 다시 검토 → E07 분리(나뉜 묶음에 표시 미복사, 해석 dl 없음, 원래 해석 접힘, E07 누락 유지) → E07 원문 → 아래 돌아가기.
- Esc 닫기 → 진입 버튼 초점, 홈 scrollY 동일 → local/session storage 전체 바이트 동일.
- 다시 열면 상태 유지 → 닫기 → 실제 프로젝트 지도 transform 동일 → 다른 프로젝트 초안·revision·작업 수 동일.
- 가져오기: 정상, 순서만 바뀐 같은 입력과 예제 재열기는 재사용(제외·분리 유지).
  - 거절: 없는 ref, 중복 refs, 중복 발췌 ref, 70KB, BOM, 프로젝트 백업 schema, 제안4개, 한 글자 변조+옛 해시. 거절마다 검토·storage 불변.
  - 같은 ID·다른 해석은 새 검토(표시 미상속, 알림). 임의 rawSha256은 받아들이고 "확인하지 않았어요"로 표시. 4번째 표본은 거절.
- HTML label/quote가 글자로 보임(img/script/b 요소0, title 변화 없음).
- 6000자 무공백 원문의 마지막 글자까지 스크롤, 닫기 버튼 상시 보임, 작업 버튼 접근, Enter 열기/Esc 닫기 초점 복귀, 새로고침 후 검토 비어 있음.

실행하지 않은 것: CI(Ubuntu/Windows), 다른 기존 브라우저 suite 전체(FLOW·REPORT16·VIEWPORT30 등), Node 22.16.0 정확 버전 실행.
대표 화면은 총괄 반환으로만 전달하고 저장소에는 커밋하지 않았다(1280 제안·1280 분리·1440 원문).

## 미검증·남은 한계

- 사람이 이 검토 화면을 이해하는지, 분리·다시 검토의 의미가 직관적인지는 검증하지 않았다.
- 125%/임의 글꼴/IME 입력/다른 탭 동시 사용/스크린리더 실제 낭독은 확인하지 않았다.
- Windows·CI 실행은 하지 않았다. 새 CI 단계의 Windows 결과는 미확인이다.
- WebCrypto가 없는 환경(비보안 origin)에서는 해시를 계산할 수 없어 가져오기를 거절한다. 공개 Pages(https)와 localhost는 보안 origin이다.
- 실제 project/task/export와의 연결은 여전히 없다. 수신 dry-run은 계속 NOT_RUN이다. 이 화면은 그 공백을 메우지 않는다.
- 이름 후보·별칭·개명 판정(Q02)은 다루지 않았다. 동일성 불명을 보존하는 표시만 있다.
