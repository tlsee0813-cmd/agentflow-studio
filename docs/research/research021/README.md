# AgentFlow Studio · RESEARCH021

**의사결정 요약 · 2026-10-12 · 총괄 검토용 / 제품 미변경**

## 결론

**다음 구현의 중심은 ‘더 큰 에이전트 관리 화면’이 아니라, 현재 작업을 쉽게 고치고 정확한 기준으로 넘기는 작은 작업대다.** 별도 앱을 자주 왕복하지 않아도 되는 인계 출력은 유지한다. 요청·계획·보고·외부 관측의 불일치는 중요한 경우에만 드러낸다. 이는 고객 실증을 마친 결론이 아니라 실제 소스/공식 문서/경험 원문을 연결한 제안이다.

기준은 `init-003/fix-review-regressions`의 `6666c6bd35a1a01419d3a082b6dfc776ce3db717`, 고객 앱은 `app/continuity`다. IDEA017을 유지하고 018/019를 승격하지 않는다. 기존 코드에 이미 있는 수동값 보존·낡은 응답 배제·미검증 보고·백업 보호를 재구현하지 않는다. [P02][P04][P05][P08]

| 받는 작업 | 지금 적용할 판단 | 보류 |
|---|---|---|
| **UI001** | 현재 작업/다음 행동 우선, 수정 지점의 차이·근거, 실패·재개 안내 | 전체 캔버스, 범용 Undo, 새 상태 계약 선점 |
| **CONNECT001** | 관측과 새 실행 분리, 공식 경로 선택, event 영수증과 요구 완료 분리 | 독자 실행 엔진, 전 이벤트 AI 분석, 원격 공개 연결 |
| **IDEA020** | 요청/계획 반영/외부 사실의 대상 구분, 누락≠삭제, 증거의 버전·범위 연결 | 거대한 상태 머신, 모든 수정 재승인, 보고의 자동 사실 승격 |

각 행의 최대 세 개 구체안과 비용은 `handoffs/`에 있다. 다른 세션의 배정이나 구현을 변경하지 않았다.

## 근거가 바꾼 판단

공식 도구에 이미 있는 세션·스트림·중단·체크포인트는 연결하는 편이 우선이다. Codex 공개 TS 코드는 실행 wrapper 후보지만 `item.completed`에는 실패 종결도 포함된다. Claude 공식 문서는 green run과 실제 목표 달성을 구분한다. **도구 이벤트를 연결해도 고객의 완료 기준과 대응시키는 일은 남는다.** [K11][K13][C06]

jsondiffpatch는 안정 ID diff, OpenSpec은 변경의 누락/충돌 검증 원리가 유용하다. 하지만 현재 네 필드 비교나 JSON 원본을 위해 새 라이브러리/문서 병합 CLI를 통째 도입할 이유는 약하다. effortless는 수동 우선권과 실제 송신값 시험이 참고되지만, 읽은 A/B 평가기의 무파싱→동점 처리는 가져오지 않는다. [K01][K06][K19][K21]

개발 밖에서는 **장부 대사**, **인계 수신자의 짧은 재진술**, **공공 신청의 국지 수정 후 복귀**가 유용했다. 그대로 기능을 추가하는 대신 ‘기록과 실제를 구별, 필요한 예외만 판단, 이미 한 설명은 반복하지 않음’으로 옮겼다. [B04][B05][B07][A07]

## 비교한 다른 접근

H1 현재 작업대는 기본 후보, H3 인계 문서만으로 충분한지는 계속 유지할 대조군이다. H2 불일치 확인함은 관측 자료가 없는 현재에 전면 도입하지 않고 H1의 예외 영역으로 제한한다. 선택 근거·실패 조건은 `evidence/CROSS_DOMAIN_ALTERNATIVES.md`에 있다. 읽기 전 가설 원문도 보존했다.

## 읽을 순서

1. `02_PRODUCT_BASELINE.md`: 실제 반영 사실과 조사 적용 지점.
2. `handoffs/UI001.md`, `CONNECT001.md`, `IDEA020.md`: 각각 지금 적용 후보 세 개와 미룰 것.
3. `evidence/A_UI_UX.md` → `B_HANDOFF_RECONCILIATION.md` → `C_EVENTS_NATIVE_BOUNDARIES.md`: 순차 심층 조사.
4. `evidence/CODE_REUSE_LEDGER.md`, `EXPERIENCE_LEDGER.md`, `CROSS_DOMAIN_ALTERNATIVES.md`: 코드·실사용·다른 구조의 근거.
5. `01_SOURCE_MAP.md`/`sources.json`, `09_FOLLOWUP_PACKAGES.md`: 출처·정확한 pin/열람 범위·후속 코드 읽기.

## 신뢰 경계

기존 B1~B5·REUSE010 개별 원본은 확보하지 못했고, 저장소의 두 요약 파일만 재사용했다. 공개 demo/문서·코드 정적 읽기를 직접 제품 사용과 구별했다. Lovable 공식 화면 한 장은 시각적으로 읽었지만 현재 계정에서 작업하지 않았다. Instalanding·일부 Zenn 문서는 접근 제한이 있었다. 모든 한계는 출처 지도에 남겼다.

앱 테스트·provider 통합·유료 모델 호출·사용자 실험·비용 측정·독립 리뷰·배포는 수행하지 않았다. 이 ZIP은 **연구 문서**이며 제품 소스 ZIP이나 실행 가능한 연결 모듈이 아니다. 코드/원격 저장소/키/설정은 변경하지 않았다. 파일 목록과 SHA-256 manifest는 포함했다.


---
출처 링크(열람 범위·한계는 `01_SOURCE_MAP.md` 참조)

[A07]: https://design-system.service.gov.uk/patterns/check-answers/
[B04]: https://central.xero.com/0/article/Reconcile-your-bank-account
[B05]: https://central.xero.com/0/article/Transfer-money-between-your-bank-accounts-in-Xero
[B07]: https://www.ahrq.gov/teamstepps-program/curriculum/communication/tools/ipass.html
[C06]: https://code.claude.com/docs/en/routines
[K01]: https://github.com/benjamine/jsondiffpatch/blob/a60db8a232f92ee4b987c14f43f77402885d1a5a/packages/jsondiffpatch/src/filters/arrays.ts
[K06]: https://github.com/Fission-AI/OpenSpec/blob/9111a7654d7800391459431fff4eaf66e33a3d2e/src/core/specs-apply.ts
[K11]: https://github.com/openai/codex/blob/27065a91ccbf5ba8532844be3777fcf83b77820d/sdk/typescript/src/thread.ts
[K13]: https://github.com/openai/codex/blob/27065a91ccbf5ba8532844be3777fcf83b77820d/sdk/typescript/src/events.ts
[K19]: https://github.com/HeyCubit/effortless/blob/0690b9cf12b6d1d286a7ceb40ee7e97ce47dd6d6/bench/quality.mjs
[K21]: https://github.com/HeyCubit/effortless/blob/0690b9cf12b6d1d286a7ceb40ee7e97ce47dd6d6/tests/effortless.test.ts
[P02]: https://github.com/tlsee0813-cmd/agentflow-studio/blob/6666c6bd35a1a01419d3a082b6dfc776ce3db717/docs/PROJECT_STATUS.md
[P04]: https://github.com/tlsee0813-cmd/agentflow-studio/blob/6666c6bd35a1a01419d3a082b6dfc776ce3db717/app/continuity/src/shared/types.ts
[P05]: https://github.com/tlsee0813-cmd/agentflow-studio/blob/6666c6bd35a1a01419d3a082b6dfc776ce3db717/app/continuity/src/shared/domain.ts
[P08]: https://github.com/tlsee0813-cmd/agentflow-studio/blob/6666c6bd35a1a01419d3a082b6dfc776ce3db717/app/continuity/src/shared/storage.ts
