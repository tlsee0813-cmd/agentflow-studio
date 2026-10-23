# 35 독립 미리보기 — 작성자 보고 (Claude Code)
작성 2026-10-23 KST. 시작 product/isolated-preview-35 = 1cf046eff96c48d167ad85338513dee663208d09 (원격 head 일치 확인). 제품 소스는 수용33 그대로이며 34 후보(e059ec6d 등)는 가져오지 않았다. **공개 배포하지 않았고, 이 빌드가 게시됐다고 주장하지 않는다.** 아래는 작성자 검증이며 독립 화면·정확 CI·전체1흐름 검증은 별도다.

## 구현 선택
- 기존 `build-static.mjs`의 명시 browser MOCK target을 그대로 쓰고 `--preview` 인자 하나만 추가했다. 출력은 `continuity/static-preview-dist/`. 인자 없음은 기존 `continuity/static-dist/` 그대로. 그 외 인자는 거절한다. 서버 빌드(`build.mjs`)·`runtime.ts`·`app.ts`·`storage.ts`는 변경 없음.
- `runtime-static.ts`에 하드코딩되던 접두사/표시 문구를 build-selected 작은 모듈로 분리했다: `static-target.ts`(기존 데모 값, 바이트 동일한 문구) / `static-target-preview.ts`(미리보기). 빌드가 선택한 하나만 `client/static-target.js`로 복사된다. 같은 tsc 타입(`StaticTarget`)으로 검사되며 미리보기 쪽은 type-only import라 데모 모듈을 싣지 않는다. 문자열 치환 방식은 타입검사 밖이라 택하지 않았다.
- 결과: 두 산출물의 차이는 `client/static-target.js` 한 파일뿐(index.html·CSP·나머지 모듈 동일, 검사로 단언). 앱/런타임 복제 없음.
- HTML `<title>` 교체는 시도했으나 앱이 런타임에 `document.title`을 덮어써 로드 전 잠깐만 보이므로 제거했다. 지속 표시는 상단 `#mode` 라벨이다.
- 처음 `app/.gitignore`에 산출물 경로를 추가했으나 이 파일이 `fixtures/init009/init008-source.sha256` 고정 기준에 포함되어 I9.01 BASELINE_CHANGED를 일으켜 되돌렸다. 산출물은 명시 stage로 제외한다(`continuity/static-dist/`는 기존 `continuity/.gitignore`가 이미 제외).

## 저장 키 계약
| 대상 | 접두사(고정, 빌드마다 불변) | 표시 |
|---|---|---|
| 서버 개발 모드 | 없음 | 기존 |
| 기존 정적 데모 | `agentflow.studio.browser-demo:` | `브라우저 MOCK · AI 아님` (기존 그대로) |
| 미리보기 | `agentflow.studio.preview:` | `미리보기 · 브라우저 MOCK · AI 아님` |

접두사는 `runtimeStorage` 한 곳에서 localStorage와 per-tab sessionStorage의 모든 키에 붙는다: `agentflow.idea015.workspace`, `agentflow.idea015.project.v1`(이전 키, 읽기만), `…v1.legacy-original`/`…v2.legacy-original`(백업), per-tab `agentflow.workspace.open|place|map`. 충돌 확인은 같은 접두사 키의 envelope seq 비교다. 다른 대상 키를 읽는 fallback·자동 복사 없음. 자료 이동은 기존 ‘백업 파일 불러오기’(새 사본, origin import)뿐이다. 미리보기 설명문은 실제 AI·서버 실행이 아니며 기존 데모와 섞이지 않고 백업 파일로만 옮긴다고 적는다.

**접두사로 분리되지 않는 것(같은 origin 공유):** localStorage 용량 한도 하나, Web Lock 이름 `agentflow.idea015.workspace`(두 대상이 서로 직렬화될 뿐 자료 교환은 없음), `navigator.locks` 자체. 용량 관리 기능은 추가하지 않았다.

## 변경 파일
- `app/continuity/src/client/static-target.ts` (신규), `static-target-preview.ts` (신규), `runtime-static.ts`
- `app/continuity/scripts/build-static.mjs` (`--preview`, 산출파일 sha256 출력)
- `app/continuity/tests/static_browser.py` (기존 검사 유지 + 2개 추가)
- `.github/workflows/verify.yml` (미리보기 빌드 단계 1개, 정적 검사 단계 이름만 변경; 기존 CRLF 유지)
- 이 AUTHOR.md

## 실제 실행 (이 Claude 원격 컨테이너, 임시 127.0.0.1 정적 서버·headless Chromium)
환경: Node v22.22.0(엔진 범위 >=22.16.0 <23 안, CI 고정 22.16.0 아님), npm 10.9.4, TypeScript 5.8.3(lock), Python 3.13.16, playwright 1.57.0, Chromium 141.0.7390.37(사전설치 실행파일 지정; playwright 1.57 번들 브라우저 아님). 종료코드는 파이프 없이 child 값을 기록했다.

| 명령 | 종료 |
|---|---|
| `npm run check` | 0 |
| `node continuity/scripts/check.mjs` | 0 |
| `node continuity/scripts/build.mjs` | 0 |
| `node --test continuity/tests/*.test.mjs` | 0 (pass275 fail0) |
| `node continuity/scripts/build-static.mjs` / `--preview` | 0 / 0 |
| `python continuity/tests/static_browser.py` (3 tests) | 0 |
| `npm test` (app 루트) | 1 — fail1 `I6R … fingerprint`(INVALID_EVAL_OPTIONS). 시작 commit 1cf046e 별도 worktree에서도 같은 1건으로 실패(pass278 fail1)하여 이 변경과 무관. 이 환경 Node 버전 차이 추정, 미확정. |

static_browser.py 내용:
1. 기존 `test_static_subpath_exchange_reload_and_isolation`: 단언 유지. 기대 파일 집합에 `client/static-target.js` 추가, 모듈/CSP 검사를 두 산출물에 같은 helper로 적용.
2. `test_preview_same_origin_storage_isolation`: 한 HTTP origin에 데모 `/agentflow-studio/`, 미리보기 `/agentflow-studio/preview/`(데모 폴더는 그대로, 경로 매핑). 각 대상에 이름이 다른 합성 project.1 이전값과 서버 키 sentinel 설치(합성 probe). 확인: 각자 자기 이전값만 1회 이전·백업 정확복제·원키 미기록; 데모 탭1·미리보기 탭2에서 프로젝트 생성·이름 수정 교차 저장, 매 단계 상대 접두사 키 바이트 불변, `#storage-error` 없음; 3탭 새로고침 후 각 탭 선택(entryId) 유지, sessionStorage 키는 자기 접두사의 open/place/map만; 데모 백업 파일→미리보기 명시 가져오기로 origin import 사본(내용 동일), 데모 불변; 최종 키 집합 = probe + 각 접두사의 workspace/legacy-original만; 요청은 전부 GET이며 각 대상의 하위경로 안(미리보기→`/agentflow-studio/preview/`만), API·비GET 0, pageerror 0; 미리보기 목록 1280/1440 가로 넘침 없음(스크린샷은 커밋 안 함).
3. `test_preview_write_failure_keeps_existing_values` (표시된 fault injection, 실제 용량 측정 아님): 작은 `toLegacy(cycles(2))`. 데모가 먼저 정상 이전한 뒤 미리보기의 setItem 한 키만 QuotaExceededError로 던지게 함. (a) 미리보기 workspace 실패: 자기 이전값 보존, 백업은 정확 원본으로 남음(기존 순서: 이전값 읽기→백업 쓰기→envelope 쓰기, 삭제/덮어쓰기 없음), envelope 미작성, 데모·서버 값 바이트 불변, 이어서 새 프로젝트 쓰기 시도 시 `브라우저 저장 공간이 부족해…`(QUOTA) 표시·아무 키도 바뀌지 않음. (b) 미리보기 백업 쓰기 실패: 백업·envelope 모두 없음, 이전값·데모·서버 불변.

변이 확인: 미리보기 접두사를 데모 값으로 바꿔 빌드하면 (i) 산출물 문자열 검사에서 실패, (ii) 그 검사를 임시로 끈 사본에서도 미리보기 목록에 데모 카드가 보여 카드 수 단언으로 실패(종료1). 원래 값으로 재빌드 후 해시 동일 확인.

## 관측과 한계 (해결됐다고 하지 않음)
- **공유 용량 실관측:** 기존 `legacy-68.json`(약 126만 자)을 두 접두사에 넣은 첫 시도에서, 먼저 연 탭은 자기 백업만 쓰고 envelope 쓰기에 실패해 읽기 전용 이전 카드로 남았고, 다음 대상 탭은 아무 키도 쓰지 못했다. 다른 실행에서는 envelope가 들어가는 등 경계값이라 결정적이지 않아 검사로 고정하지 않고 위 fault injection으로 순서만 검증했다. 작은 fixture 성공은 공유 한도 문제가 해결됐다는 뜻이 아니다. 큰 데모 자료가 미리보기의 저장 여유를 줄이며 그 반대도 같다.
- **기존 저장 오류 문구 한계(이번 빌드 범위 밖):** 이전값 이전이 QUOTA/LEGACY_UNPRESERVED로 실패해도 목록 렌더링의 새 `workspace.read()`(app.ts 1251행 부근)가 원인 코드를 지워, 이전 카드를 열면 일반 `LEGACY_READONLY` 문구가 보인다. 서버·데모에서도 같은 기존 동작이며 공용 앱을 고치지 않았다. 자료는 보존된다.
- Web Lock 이름·origin 용량 공유는 위 계약표대로 남는다.
- 서버 기본 동작: 관련 소스 무변경이고 `npm run check`·continuity node 검사로만 확인했다. 서버 모드 브라우저 검사(`continuity/tests/browser.py` 등)와 다른 UI 전체 검사는 이번에 재실행하지 않았다.

## 미실행 / 넘김
- INPUT 검증3의 PC1280/1440 전체 1흐름(프로젝트 카드→설명/기록→이어가기→N 수정→정확H 인계→합성 파일 검토/수신→지도 복귀)을 미리보기에서 실제 입구로 수행하지 않았다 → Cloud.
- CI 정확 Node 22.16.0·Windows·playwright 번들 Chromium 미실행 → 총괄 CI.
- 기존 `static_browser.py` 1번 검사는 원래대로 일부 details를 코드로 연다. 발견성 근거로 쓰지 않는다.

## 재현 정보
후보 commit(이 파일을 포함한 커밋)에서 `cd app && npm ci --ignore-scripts && node continuity/scripts/build-static.mjs --preview`. 이 환경의 산출 sha256:

```
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  .nojekyll
fae95ee032d5fd50a6472699a0cc3e3a3d28368b21dc246c17dda6d3bb16c5ca  client/app.js
4c874b471b1c782c18d6d4870455b2474308e180ed302f22bdc37b338828f88d  client/presentation.js
d368c64b881ed766a2eba49d96ae40d92912008a8d6b37bb0660380e0492a092  client/runtime.js
0d847d744ce6dd680cf0d601faf77789973907e89c288cbbe85f8061056ddac9  client/static-target.js
5f622d96851a402e209dbb4434d2d98eb6962ab6bd27747bb8c3e82d881205b9  index.html
6c3871cb2e2ec839e172747fbed4b9c6354868514c13c4ef1768822d4be8a072  shared/attention.js
f8559b0a01a633385bea417ae76f797f9051b109e300a43b6becc3c9cd1bdcbd  shared/domain.js
c5286ea81a5878635a931bb2cc459925991085113ca99fa6603cfcf906cf08c5  shared/guidance.js
5d09d7c3eac8e75b012eb69c086dfdd84db645c9318140b5e82b883b9d919624  shared/hierarchy.js
c1504250a298a86efcbab8de932218cd38e2772d79a0759403dc497f829bc9ef  shared/mock.js
c230973c7021a31ffd27d0a0a389cf978e3df501ba6f98817a14bd27f8c100e8  shared/outcome.js
33f23f4ef8ed4009d6f2b64e30e26e367b83302146cedbc85ae910b5ca889c45  shared/plan-facts.js
0e93961873c3df88cbb0e37ca23cce7d4592bb40bd7b2a1ff38da4e49e136f38  shared/storage.js
d1dd2c914e0332a57bb6875e4cbd660d95ec529e2038e04a2e69c585c4deaf53  shared/types.js
5c1c5f2ed79435a3250fe31fa3d8c43442f080d757368b157da97b22572960b4  shared/validation.js
8e4c3847129348deffadbdd7e317a8af76f603b8b2b7020241508a25f8ff1084  styles.css
```
데모 산출물은 `client/static-target.js`만 `bded42aab4b5f5cee8df6fdd6b3c6f1cc9c200aa8071a146e1e6317a0a093657`로 다르고 나머지는 같다. 산출 폴더·스크린샷·node_modules는 커밋하지 않았다.
