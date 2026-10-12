# AgentFlow Studio 현재 상태 — IDEA022 + UI001 rev1 · RETURN032/FRESH033 rev1

최신 공유 기준은 `init-003/fix-review-regressions` / [Draft PR #1](https://github.com/tlsee0813-cmd/agentflow-studio/pull/1)이다. IDEA015 R3 앱 위에 IDEA017·UI001 rev1과 IDEA022 기록 근거 기능, RETURN032 결과 연결 안내·FRESH033 rev1 질문 적용 보호를 반영했으며 main 병합·운영 배포는 없다. 실행 명령은 [START_HERE](START_HERE.md)에 있다.

## 최신 설계 방향

목적은 고객이 작업을 이어갈 때 의도·기준·결정·변경을 잃고 다시 설명하는 손실을 줄이는 것이다. 이전 서비스/기능 구상은 필수요구가 아니다. 대시보드·노드그래프·실시간Codex/Claude연결·로그감지·모델/effort자동조절은 목적에 도움이 되는 가설로 평가하고 삭제·결합·제품형태 변경도 검토한다. 기존 문서와 충돌하면 이 최신 방향을 우선하며 기존 구현·자료를 자동 대체하지 않는다.

규칙을 하나씩 더 붙이는 패치에 매몰되지 않고 실제GitHub OSS 핵심코드·테스트·실사용 이슈와 분야 밖 메커니즘을 조사해 재사용/차별화 판단을 구현 결정에 연결한다. 단일 호출·가격 최소화·기존 실험 계약 자체는 제품 목표가 아니다. 공식 기능 문서만으로 실사용 문제가 해결됐거나 제품 기회가 없다고 추론한 총괄 판단을 정정한다. 기능 존재·지원 설명과 실제 개발자의 성공/실패·반복 노동은 별개다. 최근 원글·독립 반복 보고·성공 반례·OSS 핵심 코드/검사로 사용 맥락과 해결 범위를 확인하고, 원문 접근 한계와 설계 가설을 구분한다. 결정 변경 관리·FLOW029 카드뿐 아니라 기능 분할→의존성→맞춤 작업 구조→실행/재계획도 비교 후보이며 어느 쪽도 최종 정답으로 고정하지 않는다. 최소한의 완결된 고객 흐름과 관측할 성공조건으로 대안을 비교하고, 유지할 것/버릴 것/나중 검증할 것을 구분한다.

## RETURN032 / FRESH033 rev1 제품 반영 (2026-10-13 KST)

총괄이 RETURN032와 FRESH033 rev1을 수용해 기존 작업 브랜치의 기준 `875d983f49415d5e097d2be7bb70b5be93b43487` 위에 제품·검사 9경로를 반영했다. 최신 공유 문서와 다른 실험 소스는 보존했고 main 병합·배포는 없다. PILOT1의 모든 조건과 PILOT2는 제품 미채택이며 PILOT2 실호출은 보류다.

RETURN032는 결과 입력 전에 실제 연결 예정 작업·내보낸 시점·이후 기준 기록을 읽기 전용으로 보여준다. FRESH033은 기준 변경 뒤 낡거나 시점 불명인 질문을 참고 기록으로 남기고, 새 답변을 source/basis에 적용하기 전에 `QUESTION_NOT_APPLICABLE`로 거절한다. 정상 답변·중복 거절과 미제출 초안/이름/내보내기 예외는 유지한다. rev1은 imported 비단조 이력이 응답 경계를 가로지르면 unknown을 유지하지만, 새 응답이 해당 이력을 포함한 시점에서 수신되면 원문·이력·수동값을 변경하지 않고 답변 가능 상태로 회복한다.

Claude 최종 F1 검토는 해결로 수용됐다. 원래 A/B/C와 추가 탐침으로 숨은 미래 history의 unknown, 별개 실제 변경의 stale, 재정리 회복·원자성·기존값·중복 순서를 확인했다. 이는 Node22.22 타입 제거 사본 검토이며 Cloud Node22.16 빌드 실행과 구분한다.

Cloud 변경 영향 검증: 부모·continuity check/build, domain+FRESH033 Node39/39 및 native 신규1/1, compiled 재현과 기존 C 도메인 재확인 통과(fail/skip0). 새 입력/질문 ID·저장 스키마·provider·prompt 변경은 없다. 앞선 원래033의 Node53/native2/UI001 정상 경계8 및 별도 fault-injection3 통과는 그대로 보존하며 rev1 재실행 수치로 합산하지 않는다. CI Node wildcard는 신규 검사를 포함하며 workflow에 UI001 및 FRESH033 브라우저 실행을 추가했다. UI02/05/06의 지연·저장 실패·설정 응답 모사와 UI08 clipboard 훅은 순수 native 증거와 구분한다. 문서 작성 시점 새 커밋의 CI 결과는 미확인이며 해당 Actions 기록으로 별도 확인한다. 실AI 품질·고객 효용·병렬 결과 연결 일반 보장은 미검증이다. 이번 실행은 mock/paid=false이며 실API·키 접근0이다.

## 현재 구현

[app/continuity](../app/continuity/README.md)는 입력 → 필요한 질문 → 편집 가능한 작업문 → 돌아온 결과 → 다음 변경을 연결한다. localStorage 지속 저장·JSON 백업/복구, 기준 변경 뒤 낡은 AI 제외·수동값 보존, v1 이력, AI128KiB와 로컬 복구8MB 한도는 유지한다.

IDEA017은 이전 수동 scope·checks의 원문 참조를 현재 작업에 제공하고, 명시적 재사용 요청이 있을 때만 적용하도록 지시한다. 다른 과거 기준을 강제 적용하거나 의미 탐지를 보장하지 않는다. requested 원문은 문맥 예산 안에서 전문을 우선하고 문자열 출력 계약·선택지 지시를 보완한다. production 변경은 domain·types·request validation·prompt4파일이며 관련 검사3파일을 함께 반영했다. IDEA017의 AI 변경과 UI001 rev1의 화면 변경은 별개다. 저장 스키마·provider·실험 기록 보호·사례·gate·원장은 그대로다.

검증 후보179파일의 manifest SHA256은 `5c00511bf010b31f9bae7c443221cd3933fe01caff358ef7ac2fcc7c3df04850`다. baseline178개 중172개 동일·6개 변경·1개 신규이며, 공유 문서는 검증 ZIP과 구별되는 최신 상태 안내다. 실행 위치와 ZIP 전용 자료는 [REPOSITORY_SCOPE](../experiments/idea016/REPOSITORY_SCOPE.md)에 구분한다.

UI001 rev1은 현재 작업/다음 행동을 중심으로 화면을 재배치하고 기준·출처/기록 패널과 상세 편집을 제공한다. 전달될 전체 handoff의 문자수·digest로 내보내기 뒤 제안 text/why/포함 상태 변경을 감지하고 무관한 미제출 초안은 변경으로 표시하지 않는다. UI/client·presentation과 관련 UI 검사8경로만 반영했으며 UI 반영에서는 AI 경로를 보존했고 후속 IDEA022는 별도7경로로 통합했다. 저장·provider는 유지한다. 후보 source182 manifest SHA256은 `cc55fee16f6d3753130b9914874a0c54fbfcb32f4d18c2723c9b52fd56552d41`이다.

IDEA022는 현재 요청과 기존 basis/history에서 읽기 전용 planFacts를 파생해 handoff·AI 입력 appFacts에 같은 기록 근거를 제공한다. 요청 보존(input-retained)·기준 기록(basis-recorded)·이력 누락(version-only)을 구분하며 요청 전체 완료나 외부 구현 완료를 판정하지 않는다. API 입력은 `idea022.context.4`로 엄격히 검증하고 기존 저장 schema는 유지한다. prompt/domain/types/validation·신규 plan-facts와 관련 검사7경로를 수용했다. 통합184소스 = 기존169불변 +10수정 +5추가이며 UI8경로와 IDEA0227경로는 겹치지 않는다. Cloud 통합 source manifest SHA256은 `11ac3176493bf02a15e681a31c6a12ca4e4bd7487c5d505019fceaf6941691d1`이다.

## 검증과 실제 관찰

| 범위 | 확인 결과 |
|---|---|
| IDEA015 R3 Cloud 통합 (2026-10-11 21:31 KST) | 클린 설치·check/build, 기존 Node279/279·continuity45/45·직접 HTTP/localStorage 브라우저13/13 통과 |
| IDEA015 R3 GitHub CI | [608d4753 실행38140619804](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/38140619804) completed/success |
| IDEA017 독립 좁은 검사 | scratch13/13 통과 |
| IDEA017 Cloud 구현 검사 | 클린 설치·기존/continuity 타입·빌드·신규13/13 통과. 기존 전체 Node·브라우저는 반복하지 않음 |
| IDEA016 실제 baseline | 14회: provider200, 앱13수용·1INVALID_RESPONSE. C05 변경 미실행·C06 미완료 |
| IDEA017 실제 재평가 | 15회: provider/app 모두200,6흐름 완료, 오류·재시도·응답 수리·fallback0 |
| IDEA017 GitHub CI | [1e585241 실행38152906064](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/38152906064) completed/success |
| IDEA018 실제 재평가 | 13회: provider모두200·앱12수용/1INVALID_RESPONSE,4complete·C02failed·C06incomplete. 소스 미게시 |
| UI001 원본 Cloud | 클린 설치·check/build·continuity Node65/65·기존 native 브라우저13/13 통과. 신규 UI7통과/1오류(UI06 접힌 입력), 원본 실패 보존 |
| UI001 rev1 독립·Cloud | 내보내기 신선도 좁은 독립 회귀 수용. Cloud 클린 설치·build·continuity check/build·UI Node9/9·native UI9/9, fail/error/skip0. 변화 없는 기존 전체 검사는 반복하지 않음 |
| IDEA022 + UI001 rev1 통합 Cloud | 클린 설치·부모/continuity check/build·continuity Node87/87·native 브라우저13/13·UI9/9, fail/error/skip0. 새 실AI0·소스184검사 후 불변 |
| IDEA019 실제 평가 | 25회: 기존6흐름15회·동일 신규5입력017/019 각5회, 전부provider/app200·계약 수용. 소스 미채택 |

IDEA017의 C03은 명시적으로 이어받은 수동 조건의 현재 적용 참조가 분명해졌고, C06은 ‘별명만’ 전문 전달과 반영을 확인했다. C05는 checks 문자열 수용 뒤30→60 단계를 처음 실제 관측했다. [IDEA016 결과](research/idea016-results.md)와 [IDEA017 결과](research/idea017-results.md)는 구별해 보존한다. complete·HTTP 성공·검사 통과는 고객 효용이나 내용 품질 합격이 아니다.

C02의 선택지 축·미정 기한·실제 답변 출처 표현, C05의 이미 갱신된 기준을 next에서 다시 갱신하라는 표현, C06의 공개 명단보다 넓은 첫 금지 범위가 남았다. persistent-profile 재방문/Blob 다운로드의 Chromium SIGSEGV 제한도 해결됐다고 주장하지 않는다. 실제 고객 관찰·운영 준비는 미검증이다.

## 다음 작업

[IDEA018 결과](research/idea018-results.md)는 C05 마지막 상태/next 표현 개선과 C02 문자열 suggestions 계약 거절·혼합 선택지, C06 새 기술 질문·넓어진 금지 범위, C04 제외된 메일 제안 재노출을 함께 기록한다. 답변 적용·재시도·응답 수리는0이었다. 단일 실행의 정성 관찰로 인과적·통계적 효과나 고객 효용을 확정하지 않는다. IDEA018 소스는 게시하지 않고 현재 공유 앱은 IDEA017 + UI001 rev1 + IDEA022다.

### 진행 중인 독립 작업과 인계

현재 공유 상품은 IDEA017 + UI001 rev1 + IDEA022다. RESEARCH021 조사와 IDEA020 보충 검토를 회수했다. CONNECT001·IDEA023은 아직 상품에 승격하지 않는다.

- **Pro / RESEARCH021 — 조사 완료:** [조사 17문서](research/research021/README.md)를 원문대로 보존했다. [출처 지도](research/research021/01_SOURCE_MAP.md)·코드 재사용/실사용 원장·분야 밖 대안·[UI001](research/research021/handoffs/UI001.md) / [CONNECT001](research/research021/handoffs/CONNECT001.md) / [IDEA020](research/research021/handoffs/IDEA020.md) 인계·미실행 후속 연구를 제공한다. 현재 작업대와 작은 인계 출력, 요청/계획/외부 관측의 구분을 제안하며 고객 효용의 실증 결론은 아니다. 지정 커밋의 정적 열람·공식 문서·작성자 경험과 접근 한계를 기록했고 독립 연구 검증·앱 실행은 하지 않았다. 주요 작업의 [조사·구현 판단 원칙](START_HERE.md#주요-작업의-조사와-구현-판단)을 재사용한다.
- **Pro / IDEA020 — 보충 검토 완료:** Cloud B05는 실제 domain API로 구성됐지만 초기 R01은 정확한 입력·revision·응답 재현이 아니다. 실제 응답의 next ‘무작업’과 reviewBasisIds D1이 공존한다. requested 항목이 남았다는 사실만으로 항상 미반영이라고 단정할 수 없다. [설계 인계](research/idea020-connect001-handoff.md)에 구분하며 핵심 기록 파생은 IDEA022로 통합했다.
- **IDEA022 — 기록 근거 기능 수용·AI 품질 보류:** 독립 좁은 검토·무상44검사 후 UI001 rev1 통합 Cloud Node87/87·native13/13·UI9/9가 fail/error/skip0으로 통과해7경로를 반영했다. 실제17회는 모두 provider/app200·계약 수용이지만 B03 중복 변경/추가 확정, C02 중요한 선택 미질문, C06 제약 범위 확대 등이 남았다. [실측 요약](idea022-results.md)에 B05 조기 종료 회피와 새 구현 요청 구별도 기록한다. 기존 C02/C05/C06 원문은 읽기로 회수했고 통합 검사에서 새 AI 호출은 없다.
- **IDEA023 — 전체 채택 보류:** 독립 코드 검토·Cloud 구현41검사는 통과했다. 실제20회(A13/B3/새Q4)는 모두 provider/app200·계약 수용이며 C05·B03·계획/구현 요청 구별은 개선 관측됐다. C02는 채널 질문의 허용 답이 없어 대기했고 Q03은 질문이 없었다. 원문 보충 후 C02는 scope/question/next 모순·선택지 축 혼합으로 실패, Q03은 현행 담당자 전환 유지로 통과/표현 약함으로 재분류했다. 다음 단계 미실행은 하네스 한계다. C06은 next만 제약 범위를 넓혔고 Q02는 requested 기록을 코드 미반영으로 단정했다. [실측 요약](idea023-results.md)에 한계를 기록하며 소스는 미반영한다.
- **QUALITY024-T1 — blind 평가·좁은 재판정 회수:** [결과](quality024-t1-results.md)의 실제28회·기술 수용과 품질 판정을 구분한다. A OFF 수용은Claude7/14·Pro8/14, B ON/high는Claude10/14·Pro9/14다. 두 평가자 각각 전체17수용/11조건부/0부적합, 원판정 일치22·불일치6이며 원평가 집계는 그대로다. 모드 정보를 보지 않은6.1 검토로 불일치6+추가1을 좁게 재판정했고 실게시 검수 해석·최소 보관 단계 효용2건은 유보했다. 강제 단일 점수·최종 모드 승자는 없고 기본값을 변경하지 않는다.7입력×2모드×2반복의 탐색 관찰이며28독립 프로젝트·통계적 우월성·운영 안전 보증이 아니다. 관측 지연 중앙값은OFF3930ms·ON17377ms다.
- **QUALITY025 — 두 blind 평가·모드 결합 회수:** [후보 상태](quality025-status.md)에 실제28회 기술 완료와 Pro19수용/9조건부·Claude18수용/10조건부(부적합/P1둘다0)를 구분한다. T1각17/11 대비 원판정 수의 소폭 변화는7입력 반복·시간차·평가자 차이로 개선 입증이 아니다. 지정5표본 좁은 최종 검토는8ed/d796의 필드 모순·68의 계획 기록/구현 검수 혼합·505의 준비 메모 열람 누락을 확인했지만614의 전역 금지 확대는 모호하며 수동 유지 검수 삭제는 과하다. 최종 결합은A OFF 수용Claude7→8/14·Pro8→9/14, B ON/high Claude10→10/14·Pro9→10/14이며 원평가는 보존한다. 개별 판정 변동은Claude11/28·Pro14/28로 효과·기본 모드 우열을 확정하지 않는다. overall불일치7 중614는 적용범위 모호함으로 보존하고 나머지6은 미해결이다. QUALITY025는 미승격, 수용 제품은IDEA022 + UI001 rev1이다.
- **QUALITY026_IMPL — 실호출2회 후 관계검증 실패로 중단:** [설계·검증 이력](quality026-design.md)의 독립선택13·Cloud 신규25/기존31/연결7·mock20+8 통과와 실제 실패를 구분한다. F01 DIRECT025-A1수용·PLAN026-A1실패(provider200/stop, 앱502·PLAN_LINK_INVALID), 최초18미실행·후속8미배정·retry0이다. 정확 진단5CONTENT를 회수·바이트 확인했다. 실제wire에 이미named→work.constraintIds 연결 지시가 있었지만2개preserve가work에서 누락돼 구조 계약 위반을 관측했다. 계약 최적성·전체 방식 실패는 미확정이고 Sol최종raw검토는 대기다. 진단은기존raw 회수만/noAI, 입력/bodyhash·상태·승인소스와 기존5395파일 불변·종료paid=false다. 후보는 미승격이고 acceptedIDEA022 + UI001 rev1을 유지한다.
- **Pro / UI001 rev1 — 수용·반영:** 초기 UI06 검사는 정상 compose 클릭 후 입력하도록 수정했고 제안 수정 뒤 ‘내보냄’ 표시가 갱신되지 않던 결함을 고쳤다. 독립 좁은 회귀 수용과 Cloud UI Node9/9·native UI9/9 통과를 확인했다. AI 응답은 규칙 mock이고 실제 AI 호출0이다. UI09는 Markdown 다운로드로 재내보내기를 검사했으며 별도 reload/클립보드 성공 검사는 아니다. UI08 클립보드 지연과 UI06 설정 표시는 명시적 대역이다.
- **Claude / CONNECT001 rev1 — 좁은 검토 수용:** 두 결함을 수정한 합성 PoC의 독립 좁은 검토가 통과했다. 자체 session/turn 연결 우선·충돌/미연결의 수동 배치·같은 시각 보고의 단일 최신 후보를 확인했다. Windows Node24.19.0의 합성 회귀·hook runner 검사는 실제 CLI 발화·Codex stable 호환·다중 프로세스 append·앱 통합 검증과 구별한다. [설계 인계](research/idea020-connect001-handoff.md)를 이어받으며 실제 연결은 미검증이다.
- **QUALITY027 — 실호출2회에서 중단·미승격:** 준비 검증 뒤2송신/1수용/1실패, PLAN_SCOPE_CONFLICT·최초18미실행·retry0·paid=false다. Cloud는goal의context참조와validator의deliver요구를 보고했고 Sol예비검토는prompt≥1deliver/validator전부deliver의 차이를 확인했다. 실제실패raw가아직없어goal의전체참조/원인은미확정이다. 실패run은보존·재개없음, [설계·검증 이력](quality026-design.md)을 유지한다.
- **ARCH028-A/B — 조사·mock 설계 시연 완료:** 실제OSS 메커니즘과 독립 대안을 회수했으며 실AI품질·고객효용 증거는 아니다. 총괄은A형 현재작업카드+작은근거검토를FLOW029 첫 후보로 선택했다. B의 원문보존 원칙만 재사용하고 문장분류/writer·A대안D를 동시에 쌓지 않는다.
- **FLOW029 — PILOT1 실제18·조건 가림 평가 완료, 세 조건 미채택:**6고정자료×C0/C1/C2 각1회 reviewer-only 탐색을 완료했다. 계획/수신18·finish stop18, strict15/invalid3·retry0·terminal0·entry최소12007ms·종료paid=false, bodyhash18은동결일치다. 독립strict는C0 4/6·C1 6/6·C2 5/6이다. Claude18평가에서K2내부단계모순은세조건모두미검출·오지적도있었다. K5명시금지/K6정책미정핵심은각3/3내용관측이나K5C0 invalid는유효TP가아니다. K4C1필요질문오지적·K3C2경미오지적/invalid도남았다. C1형식전달개선은의미정확성보장이아니며일반품질/인과/제품수용은입증하지않는다. 다음제한설계/최소구현은지시예정·아직미시작이다. generation/pipeline0·rev4source229/accepted184·기존실패원장보존, 제품/프롬프트미승격이다.
- **Claude / FLOW029-CASES — 완료:** public2/holdout2, 합4가상에피소드를 회수했다. INPUTS/ORACLE을 분리하고 보류 사례·판정자료는 공개하지 않는다. 아직 실AI품질·사람사용성 증거가 아니다. FLOW029-PILOT1 후속 판단을 기다리며 이4에피소드의 실제 평가 완료를 뜻하지 않는다.

- **Pro / RESEARCH030 — A1/C1/B1/D1/D2 회수·연구 대기:** A1의GitHub이슈 편중과 최근1~2주 원글 우선/필요 시 한 달 확장·게시일/사건일 구분을 유지한다. 기록 변경과 실제 소비/검수 불일치는 후보 문제이며 새 장부/플랫폼 필요성은 미확정이다. D1은공통입력의 답변형 기대 때문에 표현/부담 비교로만 해석하고 숨은 누락 발견 효과로 세지 않는다. D2 flip-probe/회귀확인은 미채택 아이디어이며18회 제안은 다음배정으로 승인하지 않았다.3합성사례로 제품방향/원인을 일반화하지 않는다. 사용자연구·실AI 증거는 없고 FLOW실제실패를 반영한 좁은수정/후속비교를 먼저 기다리며 추가계획을 연속배정하지 않는다.
- **RESEARCH030-T — rev1/T2 회수·완료 보고 대기:** 최초 보고의 유일 경로·서버 없음·하네스 흡수·회사 종료 인과 단정을 철회하고 조건부 기술 근거만 보존한다. T2 자료를 회수했고 Claude의 완료 보고를 기다린다. 제품 방향·시장 효용·미래 로드맵은 미확정이고 계정정보/키·설치실행·실호출·제품편집은 없다. 원시자료는 공개하지 않는다.


FLOW029 baseline은정확수용commit `c2d03e816a8a6cb4731f8142b19e091b70a96408`의184파일 export다. ZIP SHA256 `382cedeaf38c884dbcdda594ec795636089cedb31d2a3966bc179487dd1abde3`, manifest `f605954bc71913b99994936e2c10a13a06254572f77d2a0d9f4b39be52dc0200`을 사용한다. Cloud snapshot11ac...와181blob은같고 workflow·START_HERE·PROJECT_STATUS의3공유메타만다르므로 전체동일이라고하지않는다. [설계 인계](quality026-design.md)에경로와구분을남긴다.


[IDEA019 결과](research/idea019-results.md)의 실제25회·계약 수용 기록은 유지하지만019는 채택하지 않는다. B05/B03 구성 코드·원문을 읽기로 회수해 설계 판단에 사용했고 추가 AI 호출은 없다. UI와 파생 사실 후보는 별도 변경으로 검토하고 연결 PoC를 실제 상품 연동 성공으로 해석하지 않는다. 앞선 `875d983f` 공유 반영은 FLOW029-PILOT1 실제18회·독립 구조 재현·조건 가림 평가와 후속 지시 예정 상태 문서뿐이었다. 당시 제품 소스는 수용된 IDEA022 + UI001 rev1 기준을 보존했고 IDEA018·IDEA019·IDEA023 소스는 포함하지 않았다. 당시 CI·PR 설정·main·배포는 변경하지 않았다.

과거 [IDEA013](research/idea013-results.md)·[IDEA014](research/idea014-results.md) 합성 비교와 [IDEA015 제품 검토](research/idea015-product-review.md)는 각 기록으로 남긴다.
