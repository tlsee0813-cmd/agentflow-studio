# 다른 세션을 위한 진입점

최신 구현은 `init-003/fix-review-regressions`의 [Draft PR #1](https://github.com/tlsee0813-cmd/agentflow-studio/pull/1)을 기준으로 한다. main은 최신 구현이 아니다. 현재 수용된 실행 대상은 **IDEA015 R3 위에 IDEA017을 반영한 이어서 만들기**이며 기존 INIT009 앱과 별도 진입점을 사용한다.

| 자료 | 위치 | 용도 |
|---|---|---|
| 현재 개발 흐름 | [continuity README](../app/continuity/README.md) | 요청·답변 → 작업문 → 돌아온 결과 → 다음 변경, 기준 편집과 저장·복구 |
| 현재 상태·한계 | [PROJECT_STATUS](PROJECT_STATUS.md) | 수용된 소스, Cloud 검증, 미검증 품질과 다음 작업 |
| 기존 INIT009 앱 | `app/src/`, `app/server/`, `app/public/` | `npm run demo`의 기존 화면과 계약·평가 도구 |
| 과거 탐색·합성 비교 | [IDEA012](../prototypes/idea012-rehearsal/README.md), [IDEA013 결과](research/idea013-results.md), [IDEA014 결과](research/idea014-results.md) | 현재 UI의 실제 모델 품질과 구분하는 연구 기록 |
| 제품·재사용 판단 | [IDEA015 제품 검토](research/idea015-product-review.md), [질적 조사](research/qualitative-findings.md), [재사용 후보](research/reuse-findings.md) | 판단 근거이며 고객 효용 입증 아님 |

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

## 검증과 다음 작업

2026-10-11 21:31 KST 통합 Cloud에서 클린 설치·기존/continuity 타입검사·빌드, 기존 Node279·continuity Node45·직접 HTTP 브라우저13이 실패/skip0으로 통과했다. 이는 mock/native HTTP/localStorage 실행 검증이다. persistent-profile 재방문 후 새 다운로드의 Chromium SIGSEGV는 미해결 제한이며 실제 DeepSeek 내용 품질·고객 효용·운영 준비는 미검증이다.

IDEA016~019의 실제 평가는 각 결과 문서에 보존하며 현재 공유 소스는 IDEA017이다. IDEA018·019는 채택하지 않았다. 구현 검사와 실제 응답 관찰을 구분하고, 최신 판단·미검증 한계·병렬 작업은 [PROJECT_STATUS](PROJECT_STATUS.md)에서 이어받는다.

## 주요 작업의 조사와 구현 판단

주요 기능·설계·UI 작업을 Pro에 맡길 때마다 기존 자료, OSS의 실제 코드, 커뮤니티 실사용 경험과 UI/UX를 조사해 재사용·차별화 판단을 함께 받는다. 기존 조사와 열람 근거를 재사용하며 작은 수정마다 전수 조사를 반복하지 않는다.

자료를 읽기 전에 고객의 근본 문제를 정리하고, 접근이 다른 대안을 세운다. 관련 제품이나 AI 개발 분야에 매몰되지 않고 분야를 가리지 않는 원리·메커니즘을 탐색한다. 원리와 우리 문제의 구조적 유사성, 실제 고객 상호작용, 성립하지 않는 조건을 설명하며 기능 확대를 당연시하지 않는다.

원문으로 확인한 사실·실사용 근거와 새 가설을 구분한다. 재사용 후보는 실제 읽은 코드 범위, 라이선스·고지 의무, 유지보수 상태와 현재 앱에 적용할 범위를 확인한다. 링크 모음에서 끝내지 않고 해결할 불편 → 기존 해결 구조 → 가져오거나 달리 만들 최소 범위 → 유지 비용과 배제 이유를 구현 결정에 연결한다. 조사에서 접근하지 못한 자료를 읽었다고 주장하지 않는다.

기존 실험 원장·고정 ID·gate를 재시도/reset/새 경로로 우회하지 않는다. 키·private 자료·전체 채팅·원본 교재·live 출력·설치 패키지·dist는 공유하지 않는다. main 병합과 운영 배포는 이번 범위에 없다.

