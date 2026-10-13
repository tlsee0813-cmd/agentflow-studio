# 다른 세션을 위한 진입점

최신 구현은 `init-003/fix-review-regressions`의 [Draft PR #1](https://github.com/tlsee0813-cmd/agentflow-studio/pull/1)을 기준으로 한다. main은 최신 구현이 아니다. 현재 수용된 실행 대상은 **IDEA017·UI001 rev1·IDEA022에 RETURN032/FRESH033 rev1·SELECT035·INTENT037 rev1·CONNECT039 rev1을 반영한 이어서 만들기**이며 기존 INIT009 앱과 별도 진입점을 사용한다.

| 자료 | 위치 | 용도 |
|---|---|---|
| 현재 개발 흐름 | [continuity README](../app/continuity/README.md) | 요청·답변 → 작업문 → 돌아온 결과 → 다음 변경, 기준 편집과 저장·복구 |
| 현재 상태·한계 | [PROJECT_STATUS](PROJECT_STATUS.md) | 수용된 소스, Cloud 검증, 미검증 품질과 다음 작업 |
| 기존 INIT009 앱 | `app/src/`, `app/server/`, `app/public/` | `npm run demo`의 기존 화면과 계약·평가 도구 |
| 과거 탐색·합성 비교 | [IDEA012](../prototypes/idea012-rehearsal/README.md), [IDEA013 결과](research/idea013-results.md), [IDEA014 결과](research/idea014-results.md) | 현재 UI의 실제 모델 품질과 구분하는 연구 기록 |
| 제품·재사용 판단 | [IDEA015 제품 검토](research/idea015-product-review.md), [질적 조사](research/qualitative-findings.md), [재사용 후보](research/reuse-findings.md) | 판단 근거이며 고객 효용 입증 아님 |
| 완료 조사·후속 인계 | [RESEARCH021](research/research021/README.md), [공유 범위](research/research021/REPOSITORY_SCOPE.md) | 출처 지도·재사용/실사용 원장·세 작업 인계·미실행 후속 조사; 실증 결론과 구분 |

## 비용 없는 실행

Node22.16.0 / npm10.9.2 / TypeScript5.8.3을 사용한다. 저장소 루트에서:

```sh
cd app
npm ci --ignore-scripts --no-audit --no-fund
npm run build
node continuity/scripts/build.mjs
node continuity/server/index.mjs --mock
```

`http://127.0.0.1:3000`을 연다. 규칙 mock이며 API 키가 필요 없다. 기존 `npm run demo`는 INIT009 화면이다. 두 서버를 같은 포트에 동시에 시작하지 않는다. 작업문 복사·저장은 CLI 실행이 아니며, 사용자가 붙여넣은 결과 보고는 실제 구현 검증으로 바뀌지 않는다.

기준을 직접 수정하면 사용자 결정으로 반영한다. 수정 전 AI 문구는 현재 작업문에서 제외하고 수동 작성은 보존한다. 저장은 같은 주소·브라우저 프로필의 localStorage이며 JSON 복구 파일을 지원한다. 여러 탭의 자동 병합이나 공개 사용자 인증은 제공하지 않는다. 상세 지원 범위는 continuity README에서 읽는다.

수용된 RETURN032/FRESH033 rev1은 결과 입력 전에 실제 연결 예정 대상과 기준 기록을 안내한다. 낡거나 시점 불명인 질문은 참고 기록으로 보존하며 현재 답변 적용을 막는다. imported 비단조 이력이 새 응답 시점 안으로 들어오면 이력을 지우지 않고 재정리 후 답변할 수 있다. 정상 질문·중복 보호·미제출 초안 예외, 독립 F1 해결 판정 및 Cloud Node39/native1 검증·CI 확인 범위는 [PROJECT_STATUS](PROJECT_STATUS.md)의 제품 반영 항목을 따른다. 실제 AI 품질·고객 효용은 미검증이며 PILOT2는 미채택이다.

수용된 SELECT035는 결과 제출 전에 내보낸 작업을 선택한다. 여러 대상이 있으면 선택하기 전 결과를 보내지 않고, 미제출 입력 편집 중에는 선택을 유지한다. 본문 전체 교체를 초안 동일성으로 추측하지 않는다. 선택은 새로고침/가져오기/종류 전환/성공 제출 뒤 초기화하며 1개/없음과 무인자 domain의 기존 동작은 유지한다. Cloud Node58/native 선택3/UI001 11, 독립 domain 탐침·UI 정적 검토와 별도 합성 CI fixture native3 검증은 [PROJECT_STATUS](PROJECT_STATUS.md)의 반영 항목에서 구분한다. 기존 실제 자료는 공개 fixture에 포함하지 않으며 새 커밋 CI 결과는 Actions에서 확인한다.

수용된 INTENT037 rev1은 현재 요청의 계획/조사/수정 수준을 보존한다. 수정 요청을 조사에서 끝내지 않고 최소수정·관련 검증까지 인계하며, 보류된 선택을 대신 정하지 않고 독립 범위를 유지한다. 파일 변경 금지를 필요한 읽기·관찰·재현 금지로 확대하지 않는다. 변경은 continuity/server/prompt.mjs 한 파일뿐이다. 직전 후보의 실제12건과 rev1 추가3건의 원문·검증 범위·ZIP 식별자는 [PROJECT_STATUS](PROJECT_STATUS.md)에 구분했으며 schema/buildBody/validator/provider/UI·기존 CI 게이트는 그대로다. 좁은 개선 수용이며 일반 AI 품질·고객 효용 보장은 아니다.

수용된 CONNECT039 rev1은 선택적 결과 파일 교환이다. 파일용 인계 후 결과 JSON을 읽고 원래 작업/인계 preview를 확인한 뒤 명시적으로 가져오며 붙여넣기 기본 경로도 유지한다. 저장은 v3로 이관한다. 덮어쓸 브라우저의 구형 원문만 정확히 백업하고 선택한 복구 파일은 별도 localStorage 사본을 만들지 않는다. 백업 실패 차단·기존 백업 불변·원문/초안/수동값 보호는 유지한다. 자동 CLI·실시간 연결·외부 검증·사람 효용 입증이 아니며 prompt/API는 그대로다. 원래97+11과 rev1 좁은7+storage3+native02/05·합성quota 전후 검증, 새 커밋 CI 상태는 [PROJECT_STATUS](PROJECT_STATUS.md)에서 구분한다.

## 검증과 다음 작업

2026-10-11 21:31 KST 통합 Cloud에서 클린 설치·기존/continuity 타입검사·빌드, 기존 Node279·continuity Node45·직접 HTTP 브라우저13이 실패/skip0으로 통과했다. 이는 mock/native HTTP/localStorage 실행 검증이다. persistent-profile 재방문 후 새 다운로드의 Chromium SIGSEGV는 미해결 제한이며 실제 DeepSeek 내용 품질·고객 효용·운영 준비는 미검증이다.

UI001 rev1은 현재 작업 중심 화면·기준/기록 패널·상세 조정·내보내기 후 변경 표시를 반영했다. UI와 AI 변경은 별도로 검토했고 저장·provider는 보존한다. Cloud UI Node9/9·native UI9/9 통과는 규칙 mock을 사용한 UI 검증이다.

IDEA016~019의 실제 평가는 각 결과 문서에 보존하며 현재 공유 앱은 IDEA017 + UI001 rev1 + IDEA022다. IDEA018·019는 채택하지 않았다. 구현 검사와 실제 응답 관찰을 구분하고, [IDEA022 결과](idea022-results.md)는 무상44검사·실제17회 수용과 품질 보류를 기록한다. IDEA022 + UI001 rev1의 통합 Cloud Node87/87·native13/13·UI9/9 검사가 통과해 기록 근거 기능을 채택했다. 실제 AI 내용 품질은 보류다. [IDEA023 실측](idea023-results.md)은20회 수용과 남은 품질 문제를 기록하며 해당 소스는 미채택이다. [QUALITY024](research/quality024/README.md)는 공식 추론 근거·평가 기준·최소 대조 계획을 보존한다. C02·Q03은 질문 여부만으로 실패를 단정하지 않고 원문 재판정 대기다. QUALITY024-T1 실행 도구는 구현 중이며 실호출0이다. 최신 판단·미검증 한계·병렬 작업은 [PROJECT_STATUS](PROJECT_STATUS.md)에서 이어받는다.

## 주요 작업의 조사와 구현 판단

주요 기능·설계·UI 작업을 Pro에 맡길 때마다 기존 자료, OSS의 실제 코드, 커뮤니티 실사용 경험과 UI/UX를 조사해 재사용·차별화 판단을 함께 받는다. 기존 조사와 열람 근거를 재사용하며 작은 수정마다 전수 조사를 반복하지 않는다.

자료를 읽기 전에 고객의 근본 문제를 정리하고, 접근이 다른 대안을 세운다. 관련 제품이나 AI 개발 분야에 매몰되지 않고 분야를 가리지 않는 원리·메커니즘을 탐색한다. 원리와 우리 문제의 구조적 유사성, 실제 고객 상호작용, 성립하지 않는 조건을 설명하며 기능 확대를 당연시하지 않는다.

원문으로 확인한 사실·실사용 근거와 새 가설을 구분한다. 재사용 후보는 실제 읽은 코드 범위, 라이선스·고지 의무, 유지보수 상태와 현재 앱에 적용할 범위를 확인한다. 링크 모음에서 끝내지 않고 해결할 불편 → 기존 해결 구조 → 가져오거나 달리 만들 최소 범위 → 유지 비용과 배제 이유를 구현 결정에 연결한다. 조사에서 접근하지 못한 자료를 읽었다고 주장하지 않는다.

기존 실험 원장·고정 ID·gate를 재시도/reset/새 경로로 우회하지 않는다. 키·private 자료·전체 채팅·원본 교재·live 출력·설치 패키지·dist는 공유하지 않는다. main 병합과 운영 배포는 이번 범위에 없다.


CONNECT039 rev2의 v3 기대값 교정과 rev3의 구형 fixture 두 줄 교정을 수용했다. rev3는 UI001/FRESH033의 v1 입력에서 v3 전용 resultFile만 제거하며 제품·validator·CI는 불변이다. 이전 CI 실패 기록은 보존하며 제품 기준5cfe11b의 [CI38327519595](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/38327519595)는 양 OS 전체 필수 게이트·CONNECT039까지 성공했다. Work의 Linux22개와 CI 결과는 별개다. 상세 범위는 [PROJECT_STATUS](PROJECT_STATUS.md#connect039-rev3--구형-fixture-필드-교정)를 따른다.

USE040의 합성 예제 파일 왕복(제공 로그11 pass·정확 부모 연결/raw 보존)과 LIVE041 기본 AI 두 응답(HTTP200·원ticket·deepseek·retry0)을 총괄이 수용했다. USE040 초안은 mock+수동편집이며 자동CLI 연결은 아니다. LIVE041은 A 수정 없는 검토/B AND 조건 변경과 나머지 조건 보존의 좁은 내용 수용으로, 일반 품질·실사용자 효용은 미검증이다. DELIVER042로 코드 파일 미포함·필요 자료 접근 준비·같은 작업 결과 JSON 가져오기 안내3문구를 반영했다. 화면 도움말만 변경했고 실제 실수 감소·효용은 미측정이다. 준비 오류·사전중단과 수용 범위는 [PROJECT_STATUS](PROJECT_STATUS.md#use040--live041--단일-파일-왕복과-기본-ai-두-응답-수용)에 구분한다.
