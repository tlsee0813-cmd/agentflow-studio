# AREA17 checkpoint — 미완성 중간 인계 (WIP)

사용량 한도 때문에 중단한 시점의 상태를 그대로 보존한다. 제품 후보가 아니다. 원격 push·PR·배포는 하지 않았다.

## 기준
- base: `77aed39a4e2e32be40c370772ab4e7d048a02240` (checkpoint/2026-10-15 최신 docs commit, 제품 소스는 e2bfbe2·a0f0ae78과 동일)
- 로컬 브랜치: `cycle17/area-understanding` (커밋 없음, 작업 트리 변경만 있음)
- 적용 방법: base에서 `git apply area17-wip.diff`. 또는 `changed/`의 파일 3개를 같은 경로에 덮어쓰기.

## 포함 파일
- `area17-wip.diff`, `diffstat.txt`, `git-status.txt`, `base-sha.txt`
- `changed/app/continuity/src/shared/{types,validation,domain}.ts` — 변경된 원본 전체
- `samples/` — 저장소 과거 커밋에서 꺼낸 표본 원본(수정 없음)
  - `powertoys.json` (6643323 · shared-map-11)
  - `p13-v0.json` (e8b28f5 · session-input-14 v0)
  - `p13-fix1.json` (c562d86 · session-input-14 fix1)
- `logs/continuity-check.log` — 패키징 시점에 실행. exit=0

## 완료된 것 (shared 3파일만)

**types.ts**
- `SCHEMA`를 `idea015.project.6`으로 올리고 `V5_SCHEMA`를 추가했다.
- `RESULT2_SCHEMA`(`agentflow.return.2`)와 `UnderstandingInput`을 추가했다.
  - 필드: `understanding.1`, `areaId`, `basedOn`, `summary`, `changes`(최대 3개), `proposal`, `origin`.
  - 상태·검증 필드는 없다.
- `PlanStamp`는 해시 없이 정확한 값으로 비교한다.
  - `note` 원문.
  - `brief`: 목적을 쓴 횟수.
  - `decisions`: 이 영역 또는 영역 미지정 작업에서 나온 confirmed/deferred/answered 기준의 `D#@revision` 목록.
- `ExportAnchor`(`anchor.1`)와 `ExportRecord.anchor`를 추가했다.
- `UnderstandingEntry`, `AreaUnderstanding`, `Space.understanding`을 추가했다.

**validation.ts**
- `parseResultFile`이 return.1과 return.2를 모두 받는다. return.2는 `understanding` 키가 필수이고 값은 null이거나 엄격한 형태다.
- ExportRecord에 `anchor` 키를 추가했다. returnId가 있을 때만 값이 있고, 존재하는 영역만 가리킬 수 있다.
- `space.understanding` 구조를 검증한다.
  - 적용된 revision은 1..N 연속이다.
  - held 항목은 revision과 stamp가 null이다.
  - user 항목은 `corrects`가 자기 revision보다 작다.
- `understandingRefs`: external 항목은 실제 반환 Task의 return.2 파일을 가리켜야 하고, 한 Task는 한 번만 연결된다. 적용된 항목은 같은 areaId여야 한다.
- 마이그레이션을 `migrateV4 → migrateV5`로 이었다.
  - 영역 설명은 빈 `{}`로, 모든 기존 export의 anchor는 `null`로 둔다.
  - 기존 값을 추정해 소급 생성(backfill)하지 않는다.

**domain.ts**
- `createProject`에 `understanding:{}`를 추가했다.
- duplicate 판정에 understanding 동일성을 포함했다. 같은 returnId라도 정리가 수정된 파일은 새 수신으로 본다.
- `importResultFile`은 기존 `placeReturn` 다음에 `fileUnderstanding`을 호출한다.
  - 보고 원문은 항상 보존한다.
  - 대상이나 기준이 맞지 않으면 설명만 held 처리한다.
  - 영역 없는 작업이면 어디에도 기록하지 않는다.
- `markHandoff`는 returnId export일 때 `exportAnchor`를 export 시점에 캡처한다.
  - 기존 `background`(요청 시점 사본)는 그대로 보존하고 기준으로 쓰지 않는다. 총괄 지시 B를 따른 것이다.
- `understandingVerdict`의 판정 순서:
  1. `area-mismatch`
  2. `no-anchor`
  3. `area-moved`
  4. `file-basis` (파일의 basedOn이 export 기록과 다름)
  5. `area-archived`
  6. `plan-changed` (export 기록의 stamp와 현재 stamp 대조)
  7. `superseded`
  - 예외: 같은 returnId의 수정본은 그 사이 다른 갱신이 없을 때만 대체를 허용한다.
- `proposal`이 있어도 summary는 적용한다. 제안은 미채택으로 별도 보존한다(총괄 지시 A).
- `adoptUnderstanding`은 넣지 않았다(총괄 지시 C).
- `correctUnderstanding`은 설명 정정 전용이다(총괄 지시 E).
  - `Area.note`는 바꾸지 않는다.
  - revision을 올려 옛 입력이 들어와도 superseded로 막는다.
- `areaDescription`·`returnUnderstanding`으로 current(valid 여부)·previous·held를 계산한다.
- `handoffText`(총괄 지시 D):
  - 유효한 현재 설명은 "참고 설명 · 앱 미검증"과 출처를 붙여 넣는다.
  - 미채택 제안은 "실행·반영하지 말 것"으로 표시한다.
  - 낡은 설명은 넣지 않고, 넣지 않았다는 사실만 적는다.
  - 영역 작업의 return 템플릿은 return.2(areaId·basedOn 포함)이고, 영역 없는 작업은 기존 return.1 템플릿 그대로다.

## 미완료
1. **기존 단위 시험 12건 수정 필요.** 아래 "현재 막힌 지점" 참고.
2. **client/app.ts는 아직 손대지 않았다.** 만들 것:
   - 현재 이해 박스: `areaPanel`, `renderArea`
   - 지도 카드의 탭 메모리 표시 "새 설명"
   - 가져오기 뒤 "지도에서 변화 위치 보기" (선택만 바꾸고 transform은 유지)
   - `pointedSection`에 이 결과의 정리 반영/보류 한 줄과 정리 원문 펼침
   - 설명 정정 UI (`spaceInputs` 버퍼, 요청 draft는 건드리지 않음)
   - `styles.css`
3. **새 검사가 아직 없다.**
   - `understanding17.test.mjs`
   - `understanding17_browser.py` (PC1280/1440)
   - 실제 재서술 2건 + 명시 합성 반례 fixture (return.2)
   - `verify.yml` 단계
4. 증거 원시 로그와 대표 PNG가 없다.

## 실제 실행한 검사
- **변경 전 기준(e2bfbe2):**
  - npm ci, check, continuity check, build, static-build: 모두 0
  - continuity 단위: 210/210
  - report16_browser: 13 OK, exit 0
- **변경 후, 이 WIP:**
  - `continuity/scripts/check.mjs`: exit 0. 타입 검사 통과, client는 미변경.
  - continuity 단위(부모 build 후): 210 중 198 통과, 12 실패.

## 현재 막힌 지점 — 12건 실패 원인
**원인 1: 시험이 현재 스키마 문자열을 고정으로 단언한다.** 기대값 `idea015.project.5`, 실제값 `.6`.
- `connect039` 9
- `domain` 38, 42
- `idea022` 184
- 의도된 스키마 상향이다. 기대값을 `project.6`으로, space 모양에 `understanding:{}`를 반영하면 된다.
- 브라우저 시험 `browser.py:263`, `connect039_browser.py:96`, `flow090_browser.py:96/99/396`에도 같은 단언이 있다.

**원인 2: INVALID_DATA.** `SCHEMA` 상수(이제 project.6)로 project.5 모양의 객체를 손으로 만드는 시험들이다.
- 위치:
  - `connect039.test.mjs:82`
  - `flow049.test.mjs:58`
  - `flow090.test.mjs:20, 107, 121`
  - `flow091c.test.mjs:86, 111`
  - `connect039` 12, `flow090` 100도 같은 계열로 추정
- 추정: space에 `understanding`이 없거나, handoff에 `anchor`가 없거나, 표준 project.5 바이트를 `schemaVersion=SCHEMA`로 다시 쓰는 시험이다.
- 각 줄을 확인하지 못했다. 시험 쪽 수정인지 마이그레이션 쪽 결함인지 다음 담당이 줄 단위로 판정해야 한다.

## 정직한 한계
- 앱은 summary 문장이 사용자 의도와 반대인지, 다른 영역 이야기인지 언어적으로 판별하지 못한다. 앱이 보장하는 것은 대상·기준·중복·사용자 값 비변경이라는 구조적 조건뿐이다.
- 표본의 의미 정리는 연구 전제다. 자동 추출이 아니다.
- 사용자 의도와 반대인 실제 외부 주장은 표본에 없다. 반례는 합성 경계로만 써야 한다.
- 다른 탭 실시간 반영 반례 2건은 기존 그대로 미해결이다.
