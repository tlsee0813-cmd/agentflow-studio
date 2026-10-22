# 33 비교 준비 — exact729의 현재 작업·읽기·인계·수신 코드맵

읽기 전용 정리다. 제품 `72940a043d7a7fdc225a9582ce48831fa0418cc0`의 app.ts SHA256 `7c63a494627b1ce2da8f089573f4116b17ba04e4af4531f6e2d315ccacee2e0e`, index.html `c3981c397ba764554da7416f488443ea248e6c51c6891313d01b51b568e525d0` 기준이다. 아래 줄 번호는 `app/continuity/src/client/app.ts`이며 HTML은 `app/continuity/public/index.html`이다. 새 UI 설계·실제 화면 실행은 하지 않았다.

## 문서 순서와 길이

HTML48–78행의 순서는 `#work-view` → `#work-place`/pending → `.context-bar`(`task-number`, `context-title`, `next-actions`, 최근결과) → `#outcome-home` → `#workspace .main-column`의 `#work`/`#current-work` → `#compose-panel` → 그 내부 `#result-file-panel`이다. `#context-panel`은 workspace의 별도 aside다.

`#next-actions`는 renderWork가 채우므로 복사·저장·재정리·파일용 인계 입구가 상단에 있다(1028–1040). 반면 실제 U/S/N/C 편집은 그보다 아래 current-work의 `#edit-work`에 있다. 그 사이 outcome-home에는 전달 전 확인, 다른 최신 요청/다른 작업 보고, 현재 목표·요청·직전 방향, 원문·기준·보고 목록이 조건에 따라 쌓인다(551–667). current-work에도 원문, U/S, 질문/답변, N·완료조건, 고정 배경이 편집보다 앞선다(969–1034).

따라서 관측의 편집 y3757·파일 확인 y5827은 코드의 고정 위치가 아니다. 앞선 조건부 내용과 열려 있는 details·원문·4개 textarea 높이가 누적된 문서 위치다. 이 정적 검토에서 그 관측 숫자 자체를 재계산하지는 않았다. work 전체를 한정 높이로 읽는 전용 body는 없고 문서 스크롤을 쓴다. 일부 `.source-raw`는 최대360px 내부 스크롤이며, 열린 소유 부분 설명은 별도 bounded `.work-reference-body` 하나에서 읽는다. 동일한 상태·열림·원문 길이 없이 y만 비교하면 원인을 분리할 수 없다.

## 실제 연결 경로

| 기능 / 조건 | 함수·DOM·의미 |
| --- | --- |
| 현재 작업 B | `project.currentTaskId`를 `render`가 taskOf로 읽어 renderOutcome/renderWork/renderPlace에 전달한다(2485 부근). `#task-number`, `#work-place`, `#current-work`의 TASK 번호/작성주체가 B를 표시한다(527–538,969–977,2437–2450). 지도 선택이나 별개 draft의 대상은 이 ID를 대신하지 않는다. |
| 별개 미전송 A | `project.draft/draftKind/space.draftTarget`이며 `#draft`, `#source-kind`, `#compose-area`에 표시한다(2453–2463 및 HTML58–66). summary의 `#compose-draft-status`는 ‘작성 중인 입력 있음’만 표시한다(521). reader의 `#task-next-action`은 draft가 있으면 새 요청 대신 ‘작성 중인 요청 열기’를 제공하고 `#task-next-target`에 실제 대상이 나온다(2295–2308). |
| 보고 읽기 | 수신 receipt의 `#received-result-open`은 `openReceivedReport` → `openTaskView(request, exactReport, caller)`다(762–765,435–441). `#space-view`의 task reader로 가며 `#task-pointed`/`#task-report-*`/`#task-view-work`에서 정확 보고·당시 사본·현재 네 값을 구분한다. 읽기 자체는 current를 고르지 않는다. 반면 outcome-home의 ‘이 결과 열어 이어가기’는 openTask이며 명시 current 변경이다(570–579,480–482). |
| 읽던 작업 명시 이어가기 | `#task-view-continue`는 별도 보조 행동이다. `continueTarget`의 설명을 거쳐 continueTask를 호출한다(2193–2197,2310–2314). 같은 요청의 현재 보고는 유지하고, 다른 작업이면 읽던 요청 ID로 바꾼다. 결과 화면 이동점은 editor가 아니라 `#outcome-home`이다(444–453). notice00은 별도 확정 표시 결함이며 이 맵에서는 수정하지 않았다. |
| U/S/N/C 직접 수정 | 닫힌 `#edit-work`를 명시적으로 열고 `#work-understanding/scope/next/checks`를 수정한다(1011–1027). 각 input은 editTask의 정확한 t.id·key만 commit(false)하고 refreshPreview한다. 직접 쓴 값은 재정리에도 보존한다. #retry-work는 같은 t.id의 generate이며 ‘편집창 열기’가 아니다. |
| 일반/파일 인계 | 상단 `#copy-work`/`#download-work`, 접힌 `#file-return-options`의 `#copy-file-work`/`#download-file-work`가 exportWork다(1028–1040,704–719). 파일용은 정확 H와 exportAnchor를 만들고 같은 본문을 clipboard/download와 markHandoff에 쓴다. 일반 복사는 H=null이다. 복사·저장은 외부 실행/완료가 아니다. |
| 파일 선택 → 미리보기 | `#home-file-result`는 compose/result details를 열고 `#select-result-file.click()`만 호출한다(665). 직접 선택 버튼도 hidden input을 누른다(2538). change는 읽기중 안내 → size/UTF8 검사·entry epoch/project/read 확인 → 메모리 resultSelection → renderResultFile이다(2539–2549). 선택만으로 보고/current/draft를 바꾸지 않는다. |
| 미리보기 → 명시 수신 | `#result-file-preview`는 exact task/H, 당시4값, 보고/검사 원문, 함께 온 설명과 마지막 `#accept-result-file`을 생성한다(767–792). 누르면 project/epoch/revision 재확인 뒤 importResultFile, 정확 T/H receipt, 저장이 된다(794–815). domain63–75/150–163상 수신 대상이 현재 작업/그 현재 보고 경로면 새 보고가 current가 되고, 다른 작업의 결과면 기존 current를 유지한다. draft·원tasks·bases는 보존한다. |

## 미리보기의 기존 이동 정책과 재사용 가능한 동작

파일 선택 후에는 preview나 확인 버튼으로 이동시키는 focus/scroll 정책이 **없다**. change와 renderResultFile에는 focus·scrollIntoView가 없고 HTML의 preview에는 `aria-live="polite"`만 있다. 높은 outcome-home의 `#home-file-result` 입구에서도 두 details를 열고 멀리 있는 버튼을 프로그램으로 click할 뿐, viewport를 그 버튼/preview로 맞추지 않는다. 직접 아래 선택 버튼을 사용한 경우에도 report/당시 내용 뒤에 생기는 확인 버튼의 초기 완전 노출을 보장하지 않는다. 명시 수신 후 await 저장완료도 메시지/receipt만 갱신하며 사용자가 고른 화면을 이동시키지 않는다(813–814).

기존 동작으로는 다음이 있다. `openComposer`는 초안의 kind/대상을 몰래 바꾸지 않고 compose를 열어 draft.focus한다(484–492). `writeInArea`도 draft가 있으면 기존 입력을 열며 새 대상을 덮지 않는다(456–470). `#next-preview`는 handoff-preview를 열어 nearest scroll한 뒤 textarea에 preventScroll focus한다(1031). `#next-answer`는 question-box를 center scroll하고 answer-draft에 focus한다(1032). continueTask/openTask는 outcome-home을 start로 이동한다(453/482). nav-work는 context-title을 nearest로 이동한다(2616). focusFirst는 preventScroll 초점 helper일 뿐 가시 위치까지 이동하는 helper는 아니다(329–331). 현재 직접편집 details나 파일 preview/accept 전용 jump helper는 없다.

미전송 입력 열기·읽던 작업 이어가기·수신 보고 읽기는 서로 다른 행동이다. 전자는 A의 draft를 보존하고, 두 번째만 명시 current를 바꾸며, 세 번째는 exact report를 읽기만 한다. `#task-return-origin`/`#work-return-origin`의 restoreOrigin은 출발 보기·초점·읽기 위치를 복구하되 그 사이 사용자가 고른 current나 새 요청을 rollback하지 않는다(389–431). 후속 UI 비교에서 이 구별이 가려지면 기존 보호 동작을 새 흐름 성공으로 오인할 수 있으므로, 각 입구의 실제 대상과 명시 확인 조건을 함께 읽어야 한다.

