# 140 결과(작성자) — 일반 부분 전체 읽기

기준은 0dd12a7(app 78f6842)이다. 이 문서는 작성자 보고이며 수용 판정이 아니다. 선택, 실제 PC(139 저장본) 검증, 독립 검토, 수용은 Root가 한다. 전체 제품 완성이나 배포를 주장하지 않는다.

## 구현

- **전체 읽기 면.** 일반 선택 렌즈는 그대로다. 명시적인 ‘전체 읽기’(sheet, 기존 `#panel`과 `renderPanel`/`understoodSection`)만 지도 위의 읽기 면(`.panel.reading`)이 된다.
  - 폭은 창의 64%이고 `--insp-w`~900px 사이다. 본문은 최대 720px 한 문단 열에 놓인다.
  - 제목, 경로, ‘요약으로’ 텍스트 단추, ×(Esc)가 보인다.
  - 출처·판본, 설명 근거, 현재 주장, 이력, 관계, 원문의 의미와 순서는 그대로다. 줄 수 제한(line clamp)이나 요약은 없다.
  - 전역 `--insp-w`, 렌즈, 변경 구상, 126 요청 전용 넓은 읽기는 바꾸지 않았다.
- **지도 영향 없음.** 지도 영역 계산(`paneWidth`/`mapArea`)은 바꾸지 않았다. 그래서 여닫을 때 카메라 이동은 기존과 같고, 새 pan·fit·zoom이나 저장 배치 변경은 없다.
- **배경 오작동 방지.** 읽기 면이 열린 동안 왼쪽 지도와 지도 조작 단추는 `inert`다. 휠, 클릭, 끌기, Shift+Tab 초점이 닿지 않고 `/` 찾기도 열리지 않는다.
- **복귀와 재렌더.**
  - ‘근거 이력’ 접힘과 그 안의 근거 단추에 identity를 줬다. 원문에서 돌아오면 접힘이 다시 열리고 같은 단추에 초점이 간다. 현재 주장 원문과 관계 따라가기→뒤로는 기존 장면 복원을 그대로 쓴다.
  - 같은 부분이 다시 그려지면(늦은 상태 도착, 답, 저장) 초점, 입력 caret·selection, 아직 저장하지 않은 고치기 양식의 글을 유지한다. 이전에는 고치기 초안 글이 지워졌다.
  - 이름·설명 고치기와 설명 바로잡기 저장이 늦게 끝나면, 그 사이 옮겨 간 다른 프로젝트나 부분을 다시 선택하지 않는다.
- **주장 잘림 제거(Root 보정 지시로 범위 확대).** `shared/map-reading.ts` `partUnderstanding`의 `claims.slice(0, 12)`를 없앴다. 유효한 현재 주장을 조용히 빠뜨리지 않는다. 전체 읽기의 `claimList(…, 12)`도 전체 길이로 바꿨다(렌즈는 이미 전체 길이를 썼다).
  - 현재/이력 판정, replaces, 중복 제거, 정렬, state, role, schema, validate, apply, prompt는 그대로다.
  - 다른 소비자는 지도 ask(`buildMapAsk`의 current 6)와 변경안 원자료(`plan-source`의 6)인데, 둘 다 같은 순서에서 자기 6개를 가져가므로 영향이 없다.

## 실행한 검사 (작성자 환경)

환경은 Node v22.22.0, PATH TS 6.0.2(잠금 5.8.3 없음, 재설치 안 함), Playwright 1.63.0이다.

- **타입.** `tsc --noEmit` 결과 기존에 알려진 TS6 DOM-lib 오류 1건(`app.ts` `form.hidden`)만 나온다.
- **`part140-flow.mjs`(새 보조 흐름, CI 아님) 7/7 통과.** fixture `part140-case.mjs`는 작성자 fixture다(139 엔진 모양, ‘[스텁]’ 표지). 엔진 부분은 네 번의 읽기로 13개 현재 주장을 갖고, 마지막 읽기가 한계다. eval 안에 Parser·Compiler·VM이 있다.
  - **1280×720.** 렌즈 346px → 전체 읽기 819px, 본문 720px. 렌즈와 전체 읽기 모두 13개 주장이 전부 보이고, 한계 문장과 12개 잘림에서 빠지던 첫 읽기의 첫 주장이 원문 그대로 보인다. 줄 수 제한 없음, 가로 넘침 0. 열 때 카메라와 주소 불변.
  - **배경.** 휠, 클릭, Shift+Tab, `/`가 지도에 닿지 않는다.
  - **원문 왕복.** 빠지던 주장의 원문을 열면 그 정확한 줄에 표시가 붙는다. 돌아오면 같은 면, scroll, 단추로 온다. 이력 접힘의 근거도 같은 방식으로 돌아온다(접힘 열림 유지).
  - **관계와 Esc.** VM 관계를 따라갔다가 뒤로 오면 같은 면, scroll, 카메라다. Esc로 렌즈(카메라 유지, 지도 다시 사용 가능), Esc로 선택 해제.
  - **늦은 상태 재렌더.** 초점 단추와 scroll, 고치기 입력의 글·caret·selection(backward)이 유지된다.
  - **좁은 창.** 1000×700(면 640px)과 700×800(전폭)에서 맞고, 닫기가 보이고, 가로 넘침이 없다. 읽기·닫기·새로고침 전후 workspace와 plans 저장값이 바이트 그대로다.
- **`claims140.test.mjs`(node) 2/2.** 13개가 전부 읽힌다. replaces로 대체된 주장은 이력으로만 남고, 같은 말은 하나이며, 대체한 주장이 앞에 온다. 지도 ask current는 같은 6개다.
- **기준 대비(별도 worktree, 0dd12a7).** 같은 node 검사 2/2와 흐름이 실패한다(렌즈 주장 12개). 같은 저장 project를 두 빌드로 읽은 지도 ask와 변경안 원자료 ask·origins는 바이트 동일하다(14,490 bytes). 다른 것은 주장 수(12→13)뿐이다.
- **관련 회귀.** `partUnderstanding`을 쓰는 node 검사 7개 파일 92/92(current73, grounded74, map70, request71, role80, uncertainty76, claims140). `reading123-flow` 11 ok(123 설명→주장→관계), `connected126-flow` 19 ok(126 넓은 읽기).

## 후속 수리 2건 (Root·독립 Sol 코드 검토, 후보 d1f0e98)

1. **결함 — 근거 이력 단추 키 충돌.** 근거 이력 단추의 키가 `x.at`·index·record·from이었다. 시각, 인용, 위치, index가 같은 다른 reading 두 건(재대조·복사가 저장한 replay)이면 키가 같아서, 원문에서 돌아올 때 첫 단추로 갔다.
   - **수리.** 키를 저장된 history의 `x.reading` ID로 바꿨다. index·record·from 좌표는 유지한다.
2. **결함 — 다른 부분의 설명 바로잡기 폼이 지워짐.** A의 설명 바로잡기 저장이 끝날 때 `fixingRole = null`이 전역으로 실행됐다. 그 사이 같은 project의 B에서 바로잡기를 쓰고 있었다면, 다음 재렌더에 B의 저장 전 폼이 사라졌다.
   - **수리.** 바로잡기 상태를 {entry key, part}로 두었다(가져온 사본은 part id를 공유하므로 entry key가 필요하다). A의 저장은 지금 상태가 바로 그 A일 때만 닫는다. B의 폼, 글, caret은 기존 재렌더 보존으로 남는다.
- **검증(작성자 fixture, 원 fixture와 분리).**
  - T: `part140-case.mjs` `twins()`로 같은 시각·인용·위치·index의 두 reading을 만들고, 두 번째 원문을 연 뒤 돌아오면 그 두 번째 단추에 초점이 가고 접힘이 열려 있다.
  - S: 작업공간 lock을 잡아 A의 저장을 늦춘다. 그 사이 B에서 바로잡기를 작성(caret 5–12 backward)하고, A 저장이 끝나고 늦은 status가 도착해도 B의 폼·글·caret이 남는다. 저장된 것은 A의 정정 1건뿐이다.
  - 두 검사 모두 d1f0e98 별도 worktree에서는 실패하고(키 동일, B 폼 사라짐) 수리 후 통과한다.
  - 이 회차에는 `part140-flow` 9/9(`ONLY=followup`이면 T·S만), `claims140` 2/2, 타입 검사만 다시 돌렸다. 이미 통과한 다른 기존 회귀는 반복하지 않았다.

## 후속 수리 3 (최종 delta 독립 검토, 후보 d7b52a5)

- **결함 — 같은 A의 새 편집 세션까지 닫힘.** A의 설명 바로잡기 저장이 작업공간 lock을 기다리는 동안 폼을 취소하고, 같은 A의 바로잡기를 다시 열어 새 글을 쓰는 경우다. 옛 저장이 끝나면 {entry key, part}가 같다는 이유로 새 폼도 닫혔다. 이어지는 select(A) 재렌더에서 저장하지 않은 새 글이 사라졌다.
- **수리.** 폼을 열 때마다 별도의 편집 세션 객체가 생긴다. 제출 시 그 세션 객체를 잡아 두고, 저장이 끝나면 지금 상태가 그 같은 객체일 때만 닫는다. 다시 연 폼(새 객체)과 다른 부분·entry의 폼은 각자의 것으로 남는다.
- **검증(작성자 fixture).** S2: lock으로 A 저장을 늦추고, 취소한 뒤 같은 A를 다시 열어 새 글을 쓴다(caret 4–9 backward). 옛 저장이 끝난 뒤의 재렌더와 늦은 status 재렌더를 모두 지나도 새 폼·글·caret이 남는다. 저장된 것은 첫 세션의 정정 1건뿐이다.
  - d7b52a5 별도 worktree에서 실패하고(재렌더 뒤 폼 없음) 수리 후 통과한다.
  - 같은 코드 경로의 S와 S2만 다시 돌렸다(`ONLY=saves`, 2/2). 타입 검사는 기존 TS6 오류 1건뿐이다. T와 다른 회귀는 반복하지 않았다.
  - PR77/CI는 d7b52a5에서 실행 중이므로 이 후속 commit의 CI 결과는 주장하지 않는다.

## 후속 수리 4 (최종 CI 41006047177, 후보 a3cee3e)

- **CI 결과.** CI 41006047177 양 OS(windows 123901134268, linux 123901134471)에서 `studio_browser.py` main_flow 144행이 실패했다. 질문 ‘휴무일은 어디서 정해?’를 Enter로 보내고 두 번째 답이 온 뒤, `#ask-input`이 기대값 ''가 아니라 옛 질문이었다.
- **원인(140 회귀).** 140의 같은 내용 재렌더 보존(`renderPanel`의 typed 복원)이 질문칸까지 DOM 값으로 되살렸다.
  - `send()`가 보내는 중 렌더할 때 질문이 들어 있는 칸을 저장해 둔다.
  - 답이 온 뒤 `setDraft(…, '')`로 초안이 비워진다.
  - 이어지는 `renderPanel(false)`가 저장해 둔 옛 질문을 다시 써 넣었다.
  - 질문칸의 초안은 이미 `getDraft/setDraft`가 갖고 있는 상태이므로 DOM 보존 대상이 아니다.
- **수리.** DOM 값 보존을 저장 전 글이 다른 곳에 없는 양식(`edit-name`, `edit-note`, `fix-role`)으로만 한정했다. 질문칸은 초안 상태가 권한을 갖는다. 초점과 caret 보존은 그대로다. `studio_browser.py`의 기대값은 바꾸지 않았다.
- **검증.**
  - 이 환경에는 Python Playwright가 없어 main_flow를 직접 돌리지 못했다(설치하지 않음).
  - 대신 main_flow의 같은 단계(144행까지)를 `part140-flow.mjs` A로 옮겼다(stub 응답, 모델 아님).
  - a3cee3e 별도 worktree에서 144행 기대값으로 실패하고, 수리 후 통과한다.
  - 관련 지연 편집 경계도 함께 돌렸다(`ONLY=edits`, 5/5).
    - A: 답이 오면 질문칸이 비고, 답이 실패하면(stub fail) 질문이 남는다.
    - R: 고치기 입력의 글·caret이 늦은 status를 지나도 유지된다.
    - S·S2: 다른 부분이나 같은 부분을 다시 연 바로잡기 폼이 유지된다.
  - 실제 main_flow 통과는 CI에서 확인해야 한다.
- **수리하지 않은 관찰(기존 send의 한계, 140 수리 범위 밖).**
  - 순서: Q1 전송이 실패한다 → 실패 상태의 입력칸에 보내지 않은 Q2를 쓴다 → 오류 상자의 ‘다시 시도’가 원래 Q1을 다시 보낸다 → 성공한다.
  - 결과: 성공 뒤 `send()`의 무조건 `setDraft(…, '')` 때문에 Q2가 지워진다(질문칸 '', 표시된 답은 Q1).
  - 같은 fail fixture에서 1회 관찰했고 수리하지 않았다. 140 typed 회귀 수리로 해결했다고 주장하지 않는다. 후속 과제 선택은 Root가 한다.

## 후속 수리 5 (CI 41007155003, 후보 9628e98)

- **CI 결과.** main_flow 질문 회귀는 통과했다. 양 OS의 `studio_browser.py` workspace_flow 520행이 실패했다: 넓게 비교(`#plan-panel.work`)를 연 뒤 `#lens/#plan-strip/#viewport/.controls`가 inert여야 하는데 `#viewport`가 false였다.
- **원인(140 회귀, 직접 확인).**
  - plan-view `render()`가 `cover(workOpen())`로 `#space` 자식(UNCOVERED 제외)을 inert로 만든 뒤 `host.area()`, 즉 `syncMapArea`를 부른다.
  - 140이 넣은 `syncMapArea`의 `vp/.controls.inert = reading`이 읽기 면이 아닐 때 무조건 false를 써서 그 잠금을 풀었다.
  - 126 요청 넓게 읽기는 지도에 inert를 걸지 않는다(body의 aria-modal 대화창 + 자체 Tab 순환). 그래서 그쪽과 해제 순서가 충돌할 일은 없다.
- **수리(app.ts만, plan-view 불변).** 전체 읽기는 자기가 건 잠금만 표시(`data-reading-inert`)하고 풀 때도 그것만 푼다. 이미 걸린 잠금(변경 구상 넓게 비교의 cover)은 넘겨받지도 풀지도 않는다. 새 overlay 체계는 만들지 않았다. `studio_browser.py` 520행 기대값은 바꾸지 않았다.
- **검증(작성자 fixture와 예제 converter).**
  - `part140-flow` W: 예제 converter의 넓게 비교에서 네 요소가 inert(520행과 같은 검사)다. 다른 변경 선택(재렌더)과 창 크기 변경(`syncMapArea`)을 지나도 유지되고, ‘지도로 돌아가기’에서 plan이 스스로 푼다. 이어서 전체 읽기가 자기 잠금만 걸고 닫을 때 표시까지 지운다.
  - `connected126-flow` P에 두 확인을 더했다. 부분 렌즈의 넓게 읽기는 잠금을 남기지 않는다. 전체 읽기 위에서 연 넓게 읽기를 먼저 닫으면 읽기 잠금은 유지되고, 읽기를 닫아야 풀린다. 변경 구상 rail에서 연 넓게 읽기를 닫아도 넓게 비교의 cover가 유지된다.
  - 9628e98 별도 worktree: W는 520행 지점에서, 126 P는 rail 확인(‘the comparison keeps covering the map’)에서 실패한다. 수리 후 `part140-flow` 13/13, `connected126-flow` 19/19 통과.
  - 실제 Python workspace_flow 실행은 Root(잠금 환경)와 CI에서 한다.
- **기존 Q1/Q2 send 관찰**은 계속 수리하지 않은 별도 항목이다.

## 실행하지 않은 검사와 한계

- 잠금 TS 5.8.3, continuity 전체 node, Python 브라우저 회귀(75 관계 note 왕복 등 `studio_browser.py`), 75/126/129/139 전체 suite는 돌리지 않았다(지시대로). 새 AI 호출, 136 재시도, 생성도 0이다.
- 실제 139 저장본은 Root 로컬에만 있다. 위 결과는 작성자 fixture 검증이다.
- 실제 139는 한 번의 읽기(부분당 최대 4개 주장)라서, 그 자료만으로는 13개 이상 경계를 통과했다고 말할 수 없다. 그 경계는 fixture로만 확인했다.
- 지도에서 늦게 끝나는 고치기 저장 보호는 코드 가드다. 브라우저에서 그 경쟁을 재현하지는 않았다.

## Root 판단이 필요한 것

- 전체 읽기 면이 열린 동안 왼쪽 지도를 조작할 수 없게(inert) 한 선택이 맞는지. 지도 위 오작동 방지를 위한 것이고, 닫으면 바로 다시 쓸 수 있다.
- 실제 139 저장본의 엔진·VM 전체 읽기, 1280×720 화면과 왕복.

## 변경 파일

`app/continuity/src/client/app.ts`, `app/continuity/public/styles.css`, `app/continuity/src/shared/map-reading.ts`(`partUnderstanding` 반환 잘림 1줄), 새 검사 `app/continuity/tests/{part140-case.mjs(build, twins), part140-flow.mjs, claims140.test.mjs}`, 이 RESULT.
