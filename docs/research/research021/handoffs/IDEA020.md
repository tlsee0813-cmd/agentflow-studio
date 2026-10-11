# IDEA020에 전달할 참고안 — 지금 적용 후보 최대 3개

상태: **설계 참고 / 미확정 / 코드·prompt 수정 없음**. IDEA020의 실험 세부나 결과는 이 조사에 제공되지 않았다. 현재 accepted017 코드/상태 요약과 새 외부 근거만 사용했다.

## I21-1 · 하나의 완료 상태보다 서로 다른 주장의 대상 구분

**불편:** 고객이 ‘D1을 60일로 바꿔줘’라고 했을 때, 요청 접수·현재 계획값 변경·외부 파일 구현을 한 사건으로 읽음.

**기존 해결책:** Xero의 기록과 실제 이체 구분, 도구 run 종료와 목표 달성 구분. 현재 앱도 보고/인계를 미검증으로 구별한다. [B05][C06][P04][P05]

**최소 범위:** 출력 문장부터 ‘사용자가 요청한 변경’, ‘현재 앱 기준/인계에 반영된 변경’, ‘외부 코드에서 관측된 사실’을 구분한다. 이를 처음부터 세 개의 거대한 상태 머신으로 고정하지 않는다. 현재 스키마에서 증명할 수 있는 사실을 먼저 사용하고, 필요한 최소 추가 필드만 IDEA020이 판단한다.

**유지 비용/판단 사례:** 계획값 60일, 외부 관측 없음이면 ‘미구현 확정’이 아니라 ‘계획에는 반영, 코드 반영은 확인 자료 없음’. 보고만 있으면 ‘작업자가 반영했다고 보고함’. 실제 관측도 파일/검사 범위와 시점 안에서만 말한다.

**권한:** 사용자의 분명한 기준 변경을 다시 승인받게 하지 않는다. 외부 실행/과금/삭제/배포 승인은 별도 문제다.

## I21-2 · 언급 누락과 명시적 삭제를 다르게 처리

**불편:** 새 요청이 일부 기준만 언급하면 나머지 금지가 사라진 것으로 해석되거나, 명시적 수정에도 불필요한 재승인을 요구함.

**기존 해결책:** OpenSpec의 명시적 operation·중복/누락 guard와 near-miss 대조 검사. 현재 앱의 안정 ID/history/수동값 보존. [K06][K08][P04][P05]

**최소 범위:** 명시적 수정 대상만 갱신하고, 미언급 조건은 유지한다. ‘삭제/철회’는 해당 항목의 의도가 식별된 경우에만 적용한다. 원문에 필요한 정보가 없으면 아무 관련 없는 전체 작업을 멈추지 말고 영향을 받는 작은 범위만 표시한다.

**유지 비용/판단 사례:** ‘D1=60일’에 D2 금지가 언급되지 않았으면 D2 유지. ‘D2 금지를 없애줘’라면 그 의도를 별도 처리. ID의 내용 변경과 새 ID 생성, 다른 항목의 수동 수정 보존을 구별한다. 자연어의 모든 생략을 완벽히 분류하는 결정적 규칙이 있다고 주장하지 않는다.

**제외:** OpenSpec의 제목 기반 병합을 현재 안정 ID 대신 도입, 모든 수정마다 확인 카드 생성, IDEA018/019를 우회 승격.

## I21-3 · 증거의 대상·시점과 다음 행동을 함께 연결

**불편:** 오래된 PASS/‘다 됨’ 보고가 새 요구에도 유효한 것처럼 보이거나, 무엇을 더 확인해야 하는지 알 수 없음.

**기존 해결책:** 인계 수신자의 다음 행동 요약, Codex thread/turn 구분, 현재 ExportRecord/인계 snapshot. [B07][K13][P04][P05]

**최소 범위:** 보고가 어느 인계에 관한 것인지와 현재 요구 변경 이후에도 해당 증거가 유효한 범위를 보인다. 새 자료가 없으면 ‘코드가 틀림’ 대신 ‘이 변경에 대한 확인 필요’로 표현한다. 다음 행동은 구현, 확인, 질문, 더 할 일 없음 중 현재 근거에 맞는 것을 구별하되, 새 enum을 이 보고서가 확정하지 않는다.

**유지 비용/판단 사례:** 인계 v7의 검사 보고가 왔지만 현재 기준 v9에서 관련 요구가 바뀌었다면 v7 보고를 남기고 v9에는 자동 PASS를 주지 않는다. 관련 없는 요구 변경까지 모든 증거를 무효화하지 않는다. 원본 보고를 지우거나 작성자의 자체 검사를 독립 검토로 표시하지 않는다.

**제외:** code diff 존재만으로 요구 충족 추론, 전역 ‘verified=true’ 하나, 모델 확신도로 실제 구현 단정.

## 나중으로 미룰 것

대규모 사실 원장·전역 변경 영향 그래프·모든 외부 이벤트의 자동 의미 해석·암호학적 검증 체계. 현재 필요한 최소 사실 구분을 정하고, UI001은 그 의미를 표시하며 CONNECT001은 허용된 범위의 관측 자료를 제공하도록 총괄이 합친다.


---
출처 링크(열람 범위·한계는 `01_SOURCE_MAP.md` 참조)

[B05]: https://central.xero.com/0/article/Transfer-money-between-your-bank-accounts-in-Xero
[B07]: https://www.ahrq.gov/teamstepps-program/curriculum/communication/tools/ipass.html
[C06]: https://code.claude.com/docs/en/routines
[K06]: https://github.com/Fission-AI/OpenSpec/blob/9111a7654d7800391459431fff4eaf66e33a3d2e/src/core/specs-apply.ts
[K08]: https://github.com/Fission-AI/OpenSpec/blob/9111a7654d7800391459431fff4eaf66e33a3d2e/test/core/specs-apply.requirement-name-near-miss.test.ts
[K13]: https://github.com/openai/codex/blob/27065a91ccbf5ba8532844be3777fcf83b77820d/sdk/typescript/src/events.ts
[P04]: https://github.com/tlsee0813-cmd/agentflow-studio/blob/6666c6bd35a1a01419d3a082b6dfc776ce3db717/app/continuity/src/shared/types.ts
[P05]: https://github.com/tlsee0813-cmd/agentflow-studio/blob/6666c6bd35a1a01419d3a082b6dfc776ce3db717/app/continuity/src/shared/domain.ts
