# AgentFlow Studio — 새 단일 총괄 인수인계

2026-10-24 KST 확인본. **제품 수용 기준은 35, 반환 대기열은 36 fix2와 37 구현본이다.** 두 후보는 아직 통합·체험본 반영 전이다. 이 문서는 인계 시점의 판단과 회수 지도이며, 이후 현재 진행은 [ACTIVE](cycles/ACTIVE.md)만 갱신한다. 질문별 축적은 [QUESTIONS](QUESTIONS.md), 제품·배포 기준은 [PROJECT_STATUS](PROJECT_STATUS.md)에 둔다.

## 1. 시작과 총괄의 책임

새 Codex 앱 로컬 총괄은 설치된 **`$agentflow-coordinator`**를 적용한다. 스킬 옆 runtime.json이 가리키는 기존 Ops 하네스를 사용한다. [Ops 시작 문서](https://github.com/tlsee0813-cmd/agentflow-ops/blob/main/docs/NEW_CODEX_SESSION_KO.md)와 [채널 상태](https://github.com/tlsee0813-cmd/agentflow-ops/blob/main/docs/STATUS.md), [Ops 작업 장부](https://github.com/tlsee0813-cmd/agentflow-ops/blob/main/docs/COORDINATOR_STATE.md)를 필요한 범위만 읽는다. 하네스는 **이 총괄에 적용**하며 외부 워커에게 전체 스킬·총괄 대화를 복제하지 않는다. 이미 준비된 채널을 다시 설치하거나 일괄 연결 시험하지 않는다. 사용자의 최신 지시대로 계정 전환은 제품 인계 작업에 포함하지 않는다.

읽는 순서는 이 문서 → ACTIVE의 이후 변경 여부 → 필요한 QUESTIONS 행 → [제품 방향 2~6절](PRODUCT_DIRECTION_AND_RESEARCH_PLAN_KO.md)이다. 초기 NEW_COORDINATOR_START의 첫 연구부터 반복하지 않는다. 원격 브랜치와 반환 커밋이 아래보다 바뀌었다면 차이만 확인한다.

총괄은 큰 사용자 경험을 붙잡고 문제를 좁히며, 외부 답변을 코드·근거와 대조해 채택/수정/보류하고 충돌을 해결해 통합한다. 검사 수, 문서 수, 사이클 수를 발전의 대리 지표로 쓰지 않는다. 독립적인 조사·구현·검증 준비는 병렬화하되 같은 파일의 작성자는 한 명으로 둔다.

## 2. 만들려는 경험과 지금 있는 제품

사용자는 기존 AI 세션에서 개발을 계속하고, AgentFlow에서 프로그램의 구성·관계·변경·미결을 이해하며 필요한 부분만 조정·인계하려 한다. PC 중심으로 **프로젝트 카드 홈 → 층위가 있는 지도 → 필요한 한 부분 → 조정·인계/돌아온 기록 → 전체로 복귀**가 연결되어야 한다. 구성 부분, 작업, 담당 세션을 같은 종류의 노드로 섞지 않는다. 특정 부분만 더 깊게 펼칠 수 있어야 하며 확대 배율과 구조의 상세 층은 다른 조작이다.

Dify는 프로젝트 진입, 비율, 탐색, 기본/상세 분리와 행동 명확성의 비교 기준이다. 실행 워크플로 엔진을 복제하는 것이 목적은 아니다. 다른 사이트·오픈소스의 더 좋은 메커니즘도 실제 결정에 맞게 비교한다. 짧은 현재 설명·중요한 변화·필요한 판단을 기본으로, 정밀한 원문과 근거는 필요할 때 읽게 한다. 사용자에게 지도 관리나 긴 검토 보고서 읽기를 새 업무로 주지 않는다.

현재 제품은 `app/continuity`에 있다. 프로젝트 홈(15), 보고 연결(16), 현재 설명과 보류 이유(17), 실제 포함·접기 `project.7`(18), 기록 읽기와 복귀(19/20), 빈 프로젝트 인계(21), 사용자 정정의 다음 요청 반영(23/27), 설명 참고(29), 지도 높이 복귀(30), 접힌 하위 기록(31), 읽는 작업에서 행동으로 연결(33), 별도 정적 체험본(35)을 수용했다. 연구 HTML·합성 사례는 `docs/cycles`의 근거이며 제품 구현과 구별한다.

현재 중심 자산은 `return.2`·`UnderstandingEntry`·`HeldReason`이다. 대상·기준·중복을 확인하고 사용자 구상과 외부 설명을 구별하며 정정의 출처를 남긴다. 그러나 **일반 외부 세션의 기록을 수집·정리해 처음 지도를 만드는 담당은 아직 없다.** 수신·원문 보존은 의미 정확성이나 외부 작업 완료 증거가 아니다. GUIDE107 실제 AI 의미 품질 HOLD는 유지한다.

## 3. 정확한 Git·체험 기준

저장소: `tlsee0813-cmd/agentflow-studio`. 아래 checkpoint는 인계 문서 작성 직전의 기준이며, 이 문서를 담은 후속 커밋은 문서만 바꾼다.

| 대상 | 확인한 SHA / 상태 |
|---|---|
| checkpoint/2026-10-15 | `87c81748e1bf8a70e7262b518399ef52c08eb90d`; 수용35, app tree `775a33991c4b81104737ac1f0ec5b924c979a975` |
| 수용35 병합 | `a6ea322a3147b0bee64e32752ec22bdcefcf6c82`; PR19 병합됨 |
| product/map-priority-36 | `38beb55922e3e982f0f32fddacd5e18a5e157a15`; [PR20](https://github.com/tlsee0813-cmd/agentflow-studio/pull/20) draft·미병합 |
| product/project-entry-37 | `20bffe5fe33f11b29870a9025d2ac0089837abfb`; 구현 반환, PR 없음·미수용 |
| delivery/ui02-fix3-evidence | `fd79e7e74b0956bcb8eb9878cfdaa62254688c49`; 실행·화면 근거 |
| main | `896dcf3848fec70357d0f9bd4fd6c09cab70db37`; 최신 제품 기준이 아님 |
| 기존 공개 gh-pages | `63f5540d062861439f0932cd7311c6c5510e227c`; USE106 유지 |

[별도 PC 체험본](https://agentflow-studio-pc-preview-20261023.eagerllama11.chatgpt.site)은 35 기준 owner-private Sites이며 소유자 ChatGPT 로그인이 필요하다. MOCK·브라우저 저장이고 실제 AI·계정 동기화·외부 자동 실행은 없다. [35 결과](cycles/2026-10-23-isolated-preview-35/RESULT.md) 및 [검증 정적 17파일](https://github.com/tlsee0813-cmd/agentflow-studio/tree/3a008c596cb6c109bd91b20657eb15bfcda66aa1/docs/transfer/isolated-preview-35/validated-v0). Sites project `appgprj_6adaae8408a48191b9af587755a94261`, 게시 소스 `99d4502b979461cf6ff2b5f6739763c854e1db60`, deployment `appgdep_6adab37fa4608191b8a0d139cd84340f`. 새 후보가 만들어졌다고 이 체험본도 최신이라고 말하지 않는다.

허용된 검증 환경에서 `app/` 기준 Node 22.16.0 / npm 10.9.2로 다음을 사용한다. `npm run demo`는 옛 앱 진입이므로 현재 continuity와 혼동하지 않는다.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run build
node continuity/scripts/build.mjs
node continuity/server/index.mjs --mock
```

기본 주소는 `http://127.0.0.1:3000`. 정적 체험용 빌드는 `node continuity/scripts/build-static.mjs --preview`이며 출력·저장 구분은 35 문서를 따른다. 실제 검사는 해당 커밋의 workflow와 README를 읽고 실행한다. 이전 총괄 세션의 로컬 서버 자동 승인 거절을 우회하지 않는다. 새 환경에서 실행 가능한 검증 경로는 Ops 상태와 현재 권한으로 판단하며 과거 Cloud 성공만으로 준비 완료라 단정하지 않는다.

## 4. 회수할 작업 — 새 요청보다 기존 반환부터

| 채널·주제 | 실제 세션 / 기준·산출물 | 인계 시 상태와 다음 행동 |
|---|---|---|
| Claude 36 지도 정보 우선순위 | [AgentFlow Studio 사이클34 제품 검토](https://claude.ai/code/session_01HYWug65yLyrGuGvjjLkAa5), Opus 5.5 High. a17cbcf9 → 38beb559. [AUTHOR](https://github.com/tlsee0813-cmd/agentflow-studio/blob/38beb55922e3e982f0f32fddacd5e18a5e157a15/docs/cycles/2026-10-23-map-priority-36/AUTHOR.md) | fix2 반환·대화 확인. 양OS CI 성공. 최종 코드/화면 판정 후 통합 여부 결정. 구현을 처음부터 재배정하지 않는다. |
| Claude 37 홈·공간 예제 | [프로젝트 홈·비저장 예제 연결](https://claude.ai/code/session_01KJRKarPuyzvnMWCkvYQbW1), Opus 5.5 High. base80d9d11f → 20bffe5f. [AUTHOR](https://github.com/tlsee0813-cmd/agentflow-studio/blob/20bffe5fe33f11b29870a9025d2ac0089837abfb/docs/cycles/2026-10-23-project-entry-37/AUTHOR.md) | 구현 반환·미수용. 36 fix2 미포함. 반환 후 지도 가용 높이 문제 포함해 기존 주제에서 차이만 수정. |
| 기존 제품 Cloud | 제목 “agentflow-studio 설정”, thread `01a13fcb-e7e5-73b9-b4a3-cf9a2b95b0bb`, host `durable` | 현재 idle·최근 턴 completed. 아래 pre-fix2 실행 결과와143 재현 불가 결과가 반환됨. 진행 중으로 다시 기다리지 않는다. 새 실행 전 이 환경의 현재 접근 가능성만 확인. |
| Pro 36 지도 비교 | [기존 대화](https://chatgpt.com/c/6ada853c-ff1c-83ee-8258-965005014026) | 완료. 새 연구 요청 대기 아님. |
| Pro 37 진입·읽기 비교 | [기존 대화](https://chatgpt.com/c/6adab66c-4428-83ee-aac8-dec9d0914941), CUA 웹 5.6 Pro | 완료·회수됨. 37의 MECHANISM_REVIEW/PRO_RESPONSE/PRO_RECEIPT 참고. 현재 작업/초안 구분은 채택, 후속 작업문 없는 보고를 미답 질문으로 묶는 표현은 반려. 코드·문서 비교와 실제 화면 조작을 구분. |
| DeepSeek / DSH | Ops의 인증된 텍스트 워커 | 제품 배정 없음. 좁은 출처 추출·분류부터 사용 가능. |

Ops Cloud thread `01a168ed-bd09-7102-a483-781946e370b6`는 위 제품 Cloud와 다르다. Ops의 그 환경은 관리 프록시 문제로 최신 GitHub 직접 조회·제품 실행 준비가 안 된 상태였다. “Codex Cloud”라는 이름만으로 둘의 가능 범위를 합치지 않는다.

## 5. 먼저 끝낼 한 흐름: 36 판정 → 37 결합 → 실제 첫 진입과 복귀

**36의 실패와 현재 성공을 구별한다.** a17cbcf9의 Ubuntu CI는 MAP36 01~03 × 두 PC 총6개가 실패했다. fix2는 이유 항목별 `white-space:nowrap`을 제거하고 이유 줄에 `word-break:keep-all`을 둔 CSS 수정이다. 글자 폭에 따라 세 줄이 되어 구상 본문을 밀던 문제다. 글자 축소·신호 삭제·단언 완화로 덮지 않았다. 작성자는 Chromium141와 CI 유사 글꼴로 재현했으며 정확143 실행은 못 했다.

총괄은 Code Review로 **정확 head38beb559의 run39886454270, Ubuntu/Windows success**를 확인했다. 두 로그에서 MAP36 12개와 정적3개 통과를 확인했다. 로그는 각각 tail120000자로 전체 원문 회수는 아니다. [검사 스냅샷](handoffs/2026-10-24/VERIFIED_STATE.json). [기존 Cloud154 독립 결과](https://github.com/tlsee0813-cmd/agentflow-studio/tree/15dbd3103c5d65f57408065d3213419acfd67b88/docs/transfer/map-priority-36/validated-merge65cd/v0)는 **pre-fix2 합성merge65cd96d9** 실행이며 최신38 화면 검증으로 재사용하지 않는다. [Cloud143 재현 불가](https://github.com/tlsee0813-cmd/agentflow-studio/blob/fd79e7e74b0956bcb8eb9878cfdaa62254688c49/docs/transfer/map-priority-36/ci-linux-repro/v0/REPORT.md)는 캐시 없음·공식 다운로드403으로 NOT_RUN인 완료 보고다. CI 실패가 지금도 계속된다는 뜻은 아니다.

**37은 후보이지 완료품이 아니다.** 정상 첫 방문을 프로젝트 홈으로, 비저장 예제는 상위2+하위2 영역·관계1개와 부분/작업/지도를 연결한다. 기존 유효 세션·legacy·저장 오류·WebLocks 없는 메모리 fallback을 보존한다. 예제는 실제 목록·지도 기억12칸을 오염시키지 않아야 하고, 내 프로젝트 시작에 예제 ID/작업문이 넘어가면 안 된다. 작성자 환경 Node22.22에서 루트 검사278/279(정확 버전 I6R 실패), continuity279 통과이며 주요 브라우저 검사와 새37 8개 통과를 보고했다. 부모와 후보의 MAP36 6개 실패는 36fix2 미포함 상태의 기록이다. 작성자 PNG13장은 37 브랜치에 있고 모든 원시 로그가 GitHub에 있는 것은 아니다.

특히 작성자도 **“작업01에서 이어가기” 안내가 지도 복귀 후 남아 1280에서 지도를 밀고 하단 두 카드가 화면 밖으로 나가는 장면**을 남겼다. 카메라 좌표가 같다는 검사만으로 복귀 성공을 선언하지 않는다.

첫 완료 조건은 다음과 같다.

1. 36 fix2의 좁은 코드·현재 화면 확인으로 수용/잔여 한계를 결정하고, 최신 checkpoint 문서를 보존해 통합한다. 아직 병합하지 않은 후보를 수용 기준으로 쓰지 않는다.
2. 37에 정확36 fix2를 포함한다. 통째 app 복사로 CSS 수정을 떨어뜨리지 않는다. Claude37에는 결합 기준과 위 복귀 반례만 전달하고, 독립 담당은 최종 SHA에서 같은 장면을 실행한다.
3. PC1280·1440에서 **첫 홈 → 예제 지도 → 부분/작업 → 이어가기 → 지도 복귀 → 예제 닫기 → 내 프로젝트 시작**을 하나의 흐름으로 확인한다. 실제 화면의 가용 높이·이름/이유 읽기·호출 위치·초안 보존, 예제 비저장, 재방문 세션 복원을 포함한다. 이동 좌표만 같고 카드가 가리면 실패다.
4. 변경 구간의 독립 검사와 최종 결합 SHA의 양OS CI를 통과시킨다. 36 CI 성공을37 성공으로 옮기지 않는다. CI 진단은 Code Review 경로만 사용하고 막히면 다른 Actions 경로로 우회하지 않는다.
5. 수용/보류·남은 위험·근거를 기록하고, 수용한 최종 정적 파일만 기존 비공개 PC 체험본에 반영해 실제 진입을 확인한다. main/기존 공개판 승격은 이 흐름과 별개다. 완료는 커밋 반환이 아니라 연결된 사용자 경험이다.

## 6. 외부 검토의 수용·수정 판단

사용자가 붙여 넣은 검토 본문을 실제 코드·원격 상태와 대조했다. 별도 “9.4kB 전체 파일”은 이번 입력에서 회수하지 못했으므로 그 전문까지 읽었다고 주장하지 않는다.

| 제안 | 총괄 판단 / 적용 범위 |
|---|---|
| 정리 담당 공백, v0 탐색 | **수용하되 수신 계약 해석 수정.** 36/37 뒤 별도 좁은 탐색. 아래 조건으로 원문→관측 후보→기존 계약 연결 가능성을 검사한다. |
| 지도 가독성의 제약 변경 | **수용.** 24/26/28/34 반례와36 넘침 수정을 넘어, 기본 전체맞춤·180px 고정 가정을 다시 비교한다. 최상위 접힘+1배율 또는 저배율 이름/핵심 신호 표현은 후보이며 즉시 전역 채택하지 않는다. 사용자 시야/접힘 기억, 미결 집계와 관계 실제 끝점 접근을 지킨다. |
| 독립 QUESTIONS | **이번 인계에 적용.** 원문 Q01~18 의미를 유지한 근거 색인. Q02/06/12/18을 포함해 부분 구현과 미탐색을 분리하며 승인된 일괄 목록으로 만들지 않는다. |
| 증거 분리·축소 | **향후 정책 수용.** 확인 시점 delivery의 docs/transfer는8,728파일·319,893,736바이트(약305MiB). “한 주240MB 증가·팩97MB”는 독립 확인 안 됨. 별도 브랜치는 Git 이력 용량 분리가 아니다. 새 실행은 manifest·환경/SHA/종료·해시·대표PNG 최대4장, 큰 원자료는 접근 가능한 Releases/별도 증거 저장소로 분리하는 경로를 마련한다. 아직 이전·생성하지 않았다. 기존 파일 삭제·이력 재작성 없이 새 위치 회수 확인부터. |
| CI 계층화 | **설계 수용, 지금 gate 삭제 안 함.** 36/37 종료 뒤 변경별 검사와 병합 전 전체 양OS를 나눈다. 공통 app.ts/styles/browser harness·schema/storage/build/workflow 변경 또는 영향 불명은 전체. skipped를 pass로 세지 않는다. |
| 사용자15분 체험 | **선택 입력만.** 사용자에게 숙제를 요구하거나 사람 사용성 검증을 진행 관문으로 삼지 않는다. Dify 실제 조작 비교를 사용자 선호 기준으로 활용하되 AI 평가를 사람 실험이라고 쓰지 않는다. |
| 왕복v1 / 관측v2 명명 | 현재 공백을 설명하는 표현으로만 참고. 공식 출시·목적 축소·새 대형 로드맵을 선언하지 않는다. |

### 정리 담당 v0의 다음 좁은 범위

사용 허용된 실제 JSONL 한 표본과 고정 project 사본으로 **세 관측 후보**를 만든다. 가능하면 시안 검사 기록이 아닌 요구 변경→두 부분 영향→작업 수정→담당 교체 기록을 사용한다. 출처 위치·관측 범위·빠진 구간·불확실성을 함께 남긴다. 자동 수집기·UI·범용 엔진부터 만들지 않는다.

수신 코드를 확인한 결론은 다음과 같다. 기존 handoff가 없으면 `return.2`는 `RESULT_TARGET_MISSING` 거절이다. 유효 handoff와 같은 영역은 있지만 anchor가 없으면 설명은 `no-anchor` 보류이고, 기존 영역 자체가 없으면 설명 entry를 만들지 않는다. 보고 보존과 설명 적용은 별개다. [domain 판정](https://github.com/tlsee0813-cmd/agentflow-studio/blob/87c81748e1bf8a70e7262b518399ef52c08eb90d/app/continuity/src/shared/domain.ts#L136) · [저장 분기](https://github.com/tlsee0813-cmd/agentflow-studio/blob/87c81748e1bf8a70e7262b518399ef52c08eb90d/app/continuity/src/shared/domain.ts#L720).

따라서 기존 handoff와 실제 anchor 유무를 확인하고, 연결 가능한 후보는 project 사본의 실제 수신 함수로 dry-run한다. anchor가 없는 유효 handoff의 보류도 관측한다. handoff 연결이 없으면 **별도 제안 관측 기록**으로 남긴다. 가짜 returnId·과거 anchor·기준을 만들어 통과시키거나 HeldReason/엄격한 return 키를 임의 확장하지 않는다. 출처 manifest는 sidecar다. 원본 project와 그 적용 revision은 변경하지 않고 사본에서 일어날 변경만 관측한다. 적용/보류뿐 아니라 거절·영역 미배치, 원문 의미 충실도·잘못된 소속·중복·명칭 변경을 보고한다. 세 건의 성공은 일반 품질 입증이 아니다. [14 수동 실제기록 탐색](cycles/2026-10-16-session-input-14/RESULT.md)을 재사용하되 자동 정리 완료로 읽지 않는다. 결과를 보고 Q02/06의 다음 제품 범위를 정한다.

## 7. 하네스와 워커를 실제로 쓰는 배정 방식

| 담당 | 맡길 일과 입력 | 받아야 할 결과 / 맡기지 않을 일 |
|---|---|---|
| 웹 ChatGPT Pro | 최신 비교·대안·반례. 예: 지도 기본 보기 두 후보, 외부 기록 정리의 출처/동일성 메커니즘. 현재 사용자 흐름, 고정 소스, 해결할 질문1~2개, 이미 버린 후보를 짧게 제공 | 공식 원문 링크/확인 날짜, 작동 원리, 우리 목적과 차이, 채택 후보·트레이드오프·반례. 문서 조사와 실제 조작 구분. 최신이라는 말만 믿지 않고 총괄 대조. 구현 대기 중 독립 조사 가능. |
| Claude Code 웹 | 좁은 제품 구현. 당장은 기존37에36fix2 결합과 복귀 반례 수정. 고정 base SHA·관련 파일·수정 경계·재현·완료 조건 | 전용 브랜치/commit, 변경 설명, 수정 전 실패→후 통과, 실행 환경/미실행, 최소 공유 증거. 최종 수용·타 워커 변경 통합은 총괄 담당. |
| Codex Cloud / 독립 검증 담당 | 작성자와 분리해 최종 고정 SHA 실행, PC 실제 흐름·회귀·반례. 입력과 기대 불변량은 주되 클릭 정답만 따라가는 관측으로 만들지 않음 | 실제 환경·정확 SHA·종료 코드·가림/복귀/표시 여부·실패 장면. 준비된 Cloud 사용; 현재 접근이 막히면 허용된 로컬 독립 담당으로 한정 전환. 환경 복구만 전담 보조에 맡기고 총괄이 매몰되지 않음. |
| DeepSeek / DSH 워커 | JSONL 발췌의 사건 분류, 이름/대상 후보, 원문 인용 위치, 누락·중복 후보, 비교표 초안. 비식별화한 작은 텍스트와 닫힌 분류 기준 | 출처 포인터와 불확실성을 가진 후보. 실제 실행·도구 구현·최종 동일성 병합·수용 판정은 맡기지 않음. 총괄/검토자가 원문 대조. |
| 내장6.1 Sol High | 좁은 코드·원자료 대조, 독립 검증 준비, 환경 문제의 제한된 진단 | 근거 있는 차이·위험·검사 결과. 큰 조사/구현을 계속 내장 에이전트로 대체하지 않음. |
| 내장Astra High | 수신 계약·정체성·상충하는 근거 등 어려운 판단 한정 | 반례·판단 이유. 같은 검토를 여러 보조에게 무조건 중복시키지 않음. |

Ops `prompts/WORK_ORDER.md`에 **목적·질문·기준 SHA·입력·수정 범위·금지할 확대·완료 조건·반환 형식**을 채워 전달한다. 이번 첫 흐름은 회수된 Pro37 판단의 재사용·필요한 차이 검토와 Claude37 후속, 독립 담당의 검증 준비를 병렬로 하고, 최종 실행은 결합 SHA가 나온 후 한다. DeepSeek는 승인된 다음 JSONL 표본의 분류 초안처럼 독립적인 준비에 활용한다. 모든 채널을 쓰기 위해 불필요한 일을 만들지 않는다.

**세션은 일의 단위로 관리한다.** 같은 문제의 짧은 수정·반례 확인은 기존 세션에서 이어간다. 주제가 달라지거나 대화가 길어져 오래된 가정·다른 파일 범위가 섞이면 새 주제 세션으로 나누고 고정 SHA/결정/남은 문제만 인계한다. 매번 새 세션을 강제하지 않으며 한 세션에 여러 연구와 구현을 끝없이 섞지도 않는다. 총괄이 여는 Pro·Claude·Cloud 작업과 필요한 총괄 문맥 인계 모두 이 원칙을 따른다. 각 새 작업 전에 채널·주제·요청과 접수 상태를 기록하고, 생성된 URL/ID·반환 커밋·다음 회수 행동을 즉시 남겨 중복 제출을 막는다.

Pro는 Ops Oracle CLI의 로그인된 경로를 사용하고 submit 부모 실행을 완료까지 유지한다. Oracle sessionId·실행 도구 session_id·기존 CUA 대화 URL은 서로 다른 식별자다. 원래 ID로 status/result를 회수하고, 접수 불명 시 재전송하지 않는다. Claude는 기존 웹 Code 환경이며 로컬 CLI 설치와 별개다. DSH는 인증된 좁은 텍스트 워커로 셸/웹/파일 도구가 활성화된 구현 담당이 아니다. 채널 문제가 생기면 좁은 진단을 보조에 맡기고 다른 독립 작업을 계속한다. 거절된 권한·네트워크 정책을 우회하지 않는다.

## 8. 보존과 불확실성

로컬 인계용 깨끗한 sparse checkout은 기존 작업공간 아래 `work/product-handoff-20261024`이며 app·상위 docs·ACTIVE만 선택했다. 필요한 cycle 디렉터리는 sparse 범위를 추가해 읽는다. 이전 `work/product17-author`~`product31-author` 중 여러 scratch checkout에는 수정·미추적/삭제 상태가 남아 있다. 이전 총괄 작업 흔적으로 보존하며 내용별 소유권은 이번에 재감사하지 않았다. 이를 최신 반환본으로 사용하거나 reset/삭제/자동 통합하지 않는다. Ops checkout의 별도 담당 미커밋 작업도 건드리지 않는다. 원격 고정 SHA가 제품 기준이다.

인계 때 별도 제품 구현·새 외부 작업 전송·배포·main 변경은 하지 않는다. 이번 GitHub 산출물은 문서와 작은 검증 스냅샷이다. 인증·프로필·비공개 JSONL·계정 자료는 공유하지 않는다. 로컬 ZIP 경로+해시만으로 공유 증거라고 하지 않는다. 36 작성자 첨부 crop/rect는 Claude 세션에 있으며 이번에 GitHub로 모두 이전하지 않았다. 최종 독립 실행에서 필요한 최소 증거를 접근 가능한 저장소에 남긴다.

미해결 범위: 저배율 글씨·긴 동일접두어 소속, 큰 지도/브라우저125%/실제 OS IME·다른 탭 live, 일반 기록 자동 정리, 실제 AI 의미 품질과 한도/429 회복. 첫 흐름과 무관한 미검증을 이유로 전체 개발을 멈추거나 완료로 덮지 않는다. Dify 비교와 AI 역할 관측은 사람 사용성 실험과 구별한다. 제품의 전체 목적은 유지하며 다음 작은 수용·반례로 계속 발전시킨다.
