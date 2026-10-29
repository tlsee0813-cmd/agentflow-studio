# 114 결과 — 정상 코드·검사 자료 입구 (구현·모델 없는 검증)

단일 작성자(Claude Code)의 구현 결과다. 수용은 총괄 판정이다. **모델/CLI 생성 호출 0**, 설치·계정·키·환경 변경 0. 결정은 [DESIGN.md](DESIGN.md).

## 판본

- 시작 71f473a05dadbb47686f97bc0973ec11ed21bea3 (app b042034bffffde23ff69ab53e648dbe4bafcb9cb), branch `work/experience114-source-entry`.
- 중간 검토 커밋 72b7e79a1d8cf20ec2a9930d135ac40a9f4c3c42. 최종 코드·검사는 이 문서를 담은 커밋이다(SHA는 보고에 적는다).
- 72b7e79 뒤 바뀐 것: 중간 검토 지적 3건 수리, 1280 화면 배치 보정, 저장 직후 자료 보기 순서, 정상 UI 검사와 그 증거.

## 바뀐 곳

- `src/shared/types.ts`: `SCHEMA=idea015.project.14`, `V13_SCHEMA`. 선택 필드 `PastedRecord.evidence = {kind:'code'|'test', name, version|null, origin|null}`.
- `src/shared/record-source.ts`(새 순수 helper): 정확한 메타 형태(name 120, version 80, origin 300, 한 줄, 앞뒤 공백·제어문자·키 모양 금지), 중복 identity, map basis/note 문구와 그 길이 경계, `decodeProvided`(바이트 상한 → fatal UTF-8, BOM 유지 → 기존 기록 규칙).
- `src/shared/validation.ts`: project.14 레코드(4키 또는 evidence 포함 5키), 도메인과 같은 identity로 중복 검사, code/test 대응 eligibility에 evidence 자료 ID 합집합. pre14 입력은 **모든 알려진 이전 schema**에서 migration 전에 4키·유일 텍스트를 확인한다. `migrateV13`은 marker만 바꾼다. 알 수 없는 미래 schema는 여전히 `UNSUPPORTED_SCHEMA`.
- `src/shared/domain.ts`: `pasteRecord`는 untyped끼리만 중복으로 본다. 새 `provideRecord`는 exact text와 exact declaration이 같을 때만 no-write 중복이다. `secretPasted`는 메타도 본다.
- `src/shared/map-reading.ts`: 일반 미독(unread)과 선택 RQ 비교가 같은 `normalSource`를 쓴다(typed는 kind `evidence`, untyped는 `pasted`). 메타는 basis/note에만 들어가고, 본문 span에는 원문만 들어간다. 선언 원문은 자르지 않는다. 8개 RQ id가 note 600자에 같이 들어가지 못하면 그 목록만 개수 표기로 바뀐다(typed만 해당, pasted 문구는 그대로). map.6에서 `matches[i].kind` source-kind를 어기면 `MapReplyError(path, 'source-kind', '<alias>:<kind>')`로 거절하고, map.1–5는 지금처럼 일반 `INVALID_RESPONSE`로 거절한다. eligibility 규칙 자체는 바꾸지 않았다.
- `server/map-prompt.mjs`: map.6에만 자료 종류·중복 occurrence·발언/원자료 구분을 더했다. 순수 코드는 보고 문장으로 다시 쓰지 않는다. evidence occurrence가 있으면 그 구간을 인용하고, 없으면 code/test 대응을 만들지 않는다. map.1–5 문구는 시작 SHA와 바이트가 같다(테스트로 고정). map.6 recipe id는 기존 hash 방식대로 `m6-6859b864664f`로 바뀌었다.
- `docs/cycles/2026-10-29-owned-cli-preview-102/preview/cli-executor.mjs`: JSON.parse 실패는 `JSON`, 유효 JSON의 일반 validator 실패는 `CONTRACT`, 구조화 오류는 path/rule/target으로 나눴다. final byte·UTF-8·deadline 처리는 그대로다. 같은 폴더 `check-ui-flow.mjs`는 새 prompt id 기대값만 바꿨다.
- `src/client/return-view.ts`: ‘코드·검사 자료 추가’ 양식을 붙였다. 종류는 명시적으로 골라야 하고 기본값이 없다. 파일 이름 표시, 선택 판본·출처, 읽기 전용 `<pre>` 미리보기, BOM·줄끝 표시가 있다. 양식은 엔트리별 메모리 초안(파일 전문이라 브라우저 저장소에는 두지 않음)이다. 비동기 읽기는 token으로 엔트리 소유를 확인한다. 저장 중에는 입력을 잠그고, 저장된 초안 전체가 그대로일 때만 비운다. 제공 자료 보기에서는 종류·이름·판본·출처(링크 아닌 글)와 ‘앱이 실행·검증하지 않음’을 원문 위에 둔다. 지도 행은 그 뒤에 온다.
- `src/client/app.ts`: `host.provide(key, …)`는 열린 엔트리가 key와 다르면 쓰지 않는다. 같은 진입점을 빈 지도, 부분 메뉴, 돌아와 읽기 머리, 고정 요청문 결과 행에 붙였다. `src/client/plan-view.ts`는 RQ 행 버튼을 담당한다(요청문은 바꾸지 않음).
- `src/client/digest-source.ts`, `src/client/plan-source.ts`: 자료 목록·팝업·plan 입력에 선언을 표시한다. digest/plan 종류는 `record` 그대로라 결과 권위는 바뀌지 않는다.
- `public/styles.css`: 양식과 머리 아래 진입 줄.
- 테스트: `source-entry114.test.mjs`(10), `source114-case.mjs`(작성자 fixture), `fixtures/source114/*`(**pre-114 빌드가 쓴** 합성 project.13 backup과 RQ bundle, `make-fixture13.mjs`), `fake-cli102.mjs`의 `file-delay` 모드. 기존 테스트는 현재 writer schema 기대값(13→14) 16줄과 102-E1 prompt id만 바꿨다. 이전 schema fixture 바이트는 바꾸지 않았다.

## 검사 (작성자 실행, Linux 원격 Node v22.22.0, `AI_MODE=mock`·키 없음)

컴파일러: PATH의 tsc가 **6.0.2**다(lock은 5.8.3, `node_modules` 없음). 1회 확인했고 재설치·수선은 하지 않았다. 6.0.2는 손대지 않은 시작 SHA에서도 `app.ts`의 `form.hidden`(DOM lib) 오류 1건을 낸다. 그래서 `build.mjs`/`check.mjs`/`deploy --dry-run`은 5.8.3 gate에서 멈춘다. 같은 tsconfig로 그 1건만 빼고 emit해서 continuity와 app dist를 만들었다(npm ci 근거 아님). 그 밖의 타입 오류는 0이다.

| 단계 | 결과 |
|---|---|
| continuity 전체 `node --test continuity/tests/*.test.mjs` | 606/606 |
| `source-entry114.test.mjs` | 10/10 |
| `node --check`(server/scripts/tests, 102 preview, 114 스크립트) · client 경계 grep | 통과 · 깨끗 |
| 102 `check-ui-flow.mjs`(Chromium) | 통과 |
| 114 `check-ui-114.mjs`(Chromium 1280×800, 아래 6관문) | 통과, `evidence/ui114.json` |

114 테스트 경계:
- 114-1 project.13을 열면 marker만 14가 된다. 기존 record/readings/요청은 같고 typed 메타는 만들지 않는다. BOM·CRLF·뒤 공백을 포함한 원문이 save·backup 왕복 뒤 그대로다. task·source는 0개다.
- 114-2 kind·키·한 줄·길이(name 121/version 81/origin 301 거절, 120/80/300 허용)·키 모양을 확인한다. 최대 선언도 basis 300과 note 600 안에 들어간다. 실패한 시도는 project 바이트를 바꾸지 않는다.
- 114-3 project.8–13 이름의 파일은 선언을 들여오지 못한다. 이전 형식은 그대로 읽는다. 같은 텍스트가 두 번 있는 이전 파일은 이전처럼 거절한다. 미래 schema는 `UNSUPPORTED_SCHEMA`다.
- 114-4 pasted와 typed는 같은 바이트여도 다른 ID다. 같은 텍스트와 선언이면 no-write다. 판본·출처·종류가 다르면 새 자료다. paste는 typed를 재사용하지 않는다. domain과 validation의 identity가 같다.
- 114-5 fatal UTF-8(잘못된 바이트·인코딩된 surrogate 거절), BOM 유지, 바이트 상한, 60000 UTF-16, 제어문자, 키 모양을 확인한다.
- 114-6 unread와 선택 RQ 두 ask에서 typed=evidence, 이전 보고=pasted다. 원문 span은 정확하고, 선언은 본문에 없으며, 전체 frozen RQ가 보존된다. 최대 선언에 이후 RQ 8개가 겹쳐도 note가 600 이하이고 origin이 그대로 남는다. pasted만 있는 project의 ask는 114 이전과 같다.
- 114-7 code/test는 typed에, reported·checked·describes는 이전 pasted에 반영되고 reload 뒤에도 받아들여진다. 인용 위치가 정확하고 이전 readings는 그대로다. 손으로 code 대응을 pasted로 옮긴 파일은 거절한다. 같은 코드를 pasted에서 code로 인용하면 `matches[1].kind / source-kind / N0x:pasted`로 전체 거절되고, map.5는 일반 거절이다.
- 114-8 digest와 plan에서 typed는 `record`이고, 선언은 글로 옆에 붙는다.
- 114-9 map.1–5 prompt hash가 시작 SHA 값과 같다. map.6만 새 문구를 갖는다(이전 ‘코드나 발언’ 문구 제거).
- 114-10 실제 executor와 fake CLI로 `JSON`, `CONTRACT`, `source-kind`(path/target)를 구분한다. 합법 wire는 ready → decode → apply까지 가고 code/test 2건이 반영된다. child는 4회이고 재시도는 없다.

정상 UI 6관문(`check-ui-114.mjs`, 실제 앱 + 102 launcher + **가짜 CLI fixture**, 응답은 그 ask에 맞춰 작성자가 쓴 것):
1. pre-114 project.13 backup을 정상 import하고 그 RQ sidecar를 넣었다. 고정 요청문 행에서 진입했고, 잘못된 UTF-8은 거절됐다. BOM·CRLF 코드 파일과 판본·GitHub 고정 URL 출처를 저장했다. 저장 직후 보기에서 파일·선언·원문이 첫 화면에 보인다. 머리 진입점으로 검사 파일을 저장했다(선언 없음 → ‘기록 없음’). backup 내보내기·가져오기와 reload 뒤 바이트가 같다. 이 사이 AI POST는 0이다.
2. 새 프로젝트 B(빈 지도 진입점): pasted와 같은 바이트의 typed는 별개다. 같은 선언이면 ‘새로 저장하지 않았어요’이고 seq가 그대로다. 판본이 다르면 새 자료다. 같은 글 paste는 pasted를 찾는다.
3. 저장된 A로 두 ask를 만들었다. typed 2개는 evidence, 이전 보고는 pasted이고, 원문 span이 정확하며 요청 전체가 보존된다.
4. ‘이 요청과 보고 읽기’ 첫 job(pasted code 인용)은 거절됐고 project 바이트는 그대로다. 둘째 job은 읽는 동안 홈으로 나갔다. ‘지도 정리 결과 도착’ 상태에서 readings가 그대로였고, 돌아와 ‘정리 결과 보기’로 **명시 반영**했다. reload 뒤 code/test는 typed ID에 있다. 부분의 요청 항목에서 code 근거로 갔다가 제공 자료 원문 표시 → 돌아오기를 했고, URL·포커스·scroll이 같다. backup은 reading과 선언을 보존한다. 같은 방문 안에 돌아온 결과가 바로 반영되는 기존 경로는 B의 첫 지도로 따로 확인했다(4b).
5. 선언을 넣은 project.13 이름 backup import는 거절되고 workspace는 그대로다. 양식 실패(180004 bytes, 제어문자, 키 모양 원문, 키 모양 출처)는 project를 바꾸지 않고 마지막 정상 파일을 유지한다. pre-114 빌드의 `parseProject`는 14에 `UNSUPPORTED_SCHEMA`이고, 그 store는 entry 0개로 열리며 raw를 보존한다.
6. A에서 파일 읽기를 붙잡은 채 B로 가서 초안을 입력하고 읽기를 풀었다. B의 초안·선택·포커스·바이트, A의 바이트 모두 그대로다. B 양식은 비어 있고 A 양식은 파일을 유지한다. 대기 중 읽기 뒤 큰 파일을 고르면 거절되고, 저장이 가능한 상태로 남으며, 늦게 온 읽기는 무시된다(검토 지적 1). 저장 중 입력 잠금을 관측했다(검토 지적 2). 키보드로 종류 변경 → 저장 → 자료 보기까지 했다.

전체 API: job POST 3과 ack 3(A 2, B 1), fake CLI 호출 3, direct map 0, page error 0. 실제 모델 호출 0.

## 중간 검토(72b7e79) 반영

1. `readFile`: 새로 고른 파일이 이전 읽기를 대신하므로 `reading`을 먼저 풀고, 큰 파일은 읽기 전에 거절한다. 늦게 온 이전 읽기는 token으로 무시한다. 저장 중에는 파일 선택을 받지 않는다.
2. `saveFile`: 저장 중 종류·파일·판본·출처·맥락 빼기를 잠근다. 성공 뒤에는 [token, text, name, kind, version, origin, context] 전체가 저장 시점과 같을 때만 초안을 비운다.
3. map.6 문구는 위 ‘바뀐 곳’대로 고쳤다. mixed prose의 reported/checked 의미는 그대로다.

## 최종 전 보정 (19a8d91 뒤)

- 판본·출처 입력의 HTML `maxlength`를 없앴다. 입력값 전체를 초안에 두고, 저장할 때 기존 `evidenceProblem`으로 80·300 초과를 명시 거절한다. 화면의 ‘80자/300자 이내’ 안내는 그대로다. 새 제한은 없고, 앞뒤 공백 trim(선택 필드 정리)도 그대로다.
- Root IAB 관찰 구분: paste/Control+V 도구 경로에서는 314자가 모두 들어가 실제 paste 절단은 재현되지 않았다. 다만 299자 뒤 20자 `pressSequentially`는 300자까지만 남았다. 보정은 브라우저별 입력 경로에 기대지 않으려는 최소 수리다.
- focused regression(`check-ui-114.mjs` 5관문): 두 입력에 maxlength가 없다. version 81자(`pressSequentially`)는 입력란에 81자 그대로 남고 ‘판본은…’으로 거절된다. origin 299+2자는 301자 그대로 남고 ‘출처는…’으로 거절된다. 두 경우 모두 project 바이트가 그대로다. 최종 코드에서 UI 6관문 전체와 `source-entry114` 10/10이 통과했다(`evidence/ui114.json` 갱신). 관련 없는 전체 검사는 다시 돌리지 않았다(마지막 전체 606/606은 19a8d91 코드 기준이고, 이번 변경은 `return-view.ts`의 입력 속성 하나다).

## 미확인·한계

- 잠긴 TS 5.8.3 build/check, Windows, 정확 CI, `deploy --dry-run`은 총괄 분담이다(위 컴파일러 사정). Root가 72b7e79에서 locked build/check를 통과했다고 알려 왔다. 최종 커밋에서는 다시 확인해야 한다.
- 실제 111/113 backup과 Root 스크린샷(`experience114-interim-source-hidden.png`)은 이 세션에 없다. UI 검증은 pre-114 빌드로 만든 합성 project.13 copy로 했다. 저장 직후 보기 순서 보정은 그 지적에 대한 수리이고, 실제 backup에서의 재확인은 Root 몫이다.
- 거절된 job의 화면 문구는 기존 일반 문구(‘AI 응답이 근거 규칙…’)다. 구조화 detail은 job error에 있지만 화면에 path로 보이지는 않는다(범위 밖으로 남김).
- 실제 모델이 새 map.6 문구를 따르는지는 미관측이다. typed 입구가 있어도 모델이 pasted 인용을 고르는 것은 막지 못하고, 그때는 거절된다(DESIGN의 한계 그대로).
- 113 원응답·원자료·111 실패는 다시 쓰거나 고치지 않았다. 113 진단 요약 문서도 이번 커밋에서 바꾸지 않았다.
