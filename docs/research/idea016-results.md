# IDEA016 rev1 실제 baseline 결과

2026-10-11 23:17 KST Cloud 완료 보고 기준. 실제 앱의 buildRequest·prompt·provider·state·handoff 경로로 합성 고객 6흐름을 시험했다. 완료 보고와 회수된 C02·C03·C05·C06의 실제 요청·응답·작업문 발췌를 대조해 보완했다. 실행 원문 전체의 독립 재검토나 실제 고객 효용의 입증으로 읽지 않는다.

## 실행 결과

실제 호출은 **14회**다: 최초 batch9회 + C02 후속2회 + 미시도 C06의 별도 첫 실행3회. 모두 HTTP200, `deepseek-flash`, `finish_reason=stop`, usage 기록이 있었지만 앱은 **13회 수용, 1회 INVALID_RESPONSE**였다. HTTP 성공과 앱 계약 수용·작업문 품질은 별개다.

기존 max_tokens2048·timeout15초를 유지했다. Cloud의 Node TLS 전송 실패 뒤 기존 curl proxy의 전송 경로만 사용했다. 자동 재시도·키 반향·원격 쓰기는 없었고 종료 시 paid=false로 돌아갔다. 검증 ZIP의 기준169파일과 실험9파일, 총178개 원문은 불변이었다.

| 사례 | 상태·호출 | 완료 보고의 관찰 |
|---|---|---|
| C01 | complete·2회 | 질문 없이 진행. 돌아온 보고와 실측·독립 검증을 구분했다. |
| C02 | complete·3회 | 합성 confirmation의 test_answer 출처를 유지했다. 첫 질문 option은 ‘회신 대기’와 자리 확정 표현이 모순됐지만, 답변 직후와 최종 advice는 회신 후 확정을 올바르게 명시했다. |
| C03 | complete·2회 | 사용자가 수동 scope·checks의 명시적 이어받기를 요청했고 previousWork에 전체 값이 전송됐다. 현재 checks는 입력 원본 불변 조건을 생략했으며, 전체 manual checks가 남은 직전 작업에는 ‘현재 지시 아님’ 표제가 붙었다. |
| C04 | complete·3회 | 미검증 시험·추천을 확정 기준으로 승격하지 않았다. |
| C05 | failed·1회 | checks의 배열/문자열 계약 불일치로 INVALID_RESPONSE. 예정된30→60 변경 단계는 실행되지 않았다. |
| C06 | incomplete·3회 | 질문이 남은 채 사례 상한에 도달했다. 원문의 ‘별명만’ 조건은200자 발췌에서 빠졌지만 과거 AI의 ‘연락처 미포함’ 재진술은 전송됐고 모델이 보존했다. |

## 해석의 한계

complete는 도구의 진행 상태이며 품질 합격이 아니다. 질문 수·HTTP200·계약 수용 수만으로 최소 수고나 유용한 작업문을 입증할 수 없다. C02의 모순과 C05의 계약 실패를 성공 집계로 감추지 않는다. C05의 미실행 변경 단계와 C06의 남은 질문은 평가 가능한 범위를 제한한다.

C03의 수동 scope·checks는 실제 provider user content의 previousWork에 모두 있었다. 현재 understanding은 ‘그대로 유지’라고 하지만 현재 checks에서는 입력 원본 불변을 반복하지 않고, 전체 manual checks는 ‘과거 기록 · 현재 지시 아님’ 아래에 남았다. 따라서 완전 유실이나 전송 누락으로 볼 근거는 없으며, 명시적으로 이어받으라는 요청과 현재 작업문의 적용 우선순위가 불명확한 문제다. 모든 과거 수동값을 일괄 강제 승격하는 정책으로 일반화하지 않는다.

C06의 ‘별명만’ 조건은 마지막 전송에서 requested 원문을200자로 발췌하는 단계에 빠졌다. 이 조건을 모델이 읽고도 무시했다는 근거는 없다. 연락처 제외 조건은 previousWork의 과거 AI 재진술로 전달됐고 마지막 scope·checks에 반영됐다. 로컬·handoff의 원문 보존과 provider 전송 발췌는 서로 다른 경계다. 남은 질문에는 답하지 못해 budget-ended로 끝났다.

IDEA015 R3의 Cloud 앱 검사279/279·45/45·브라우저13/13 및 [608d4753의 GitHub CI 성공](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/38140619804)은 별도 구현 검증이다. 이번 실호출은 실제 고객 관찰·운영 준비의 증명이 아니며, persistent-profile/Blob 다운로드 제한의 해결도 검증하지 않았다.

## 다음 판단

IDEA017 후보1개를 준비했고 독립 scratch 환경의 좁은 검사13/13을 통과해 Cloud 실제 평가 대상으로 수용했다. 별도 후보 묶음은179파일(172개 동일·6개 변경·1개 신규)이며 production 변경은 context·type·validation·prompt의4파일이다. C03은 이전 수동값 참조를 항상 제공하되 명시적 재사용 요청이 있을 때만 적용하도록 지시한다. 의미 탐지를 보장하거나 모든 과거 수동 기준을 강제 carry하는 변경이 아니다. C06은 기존 문맥 예산 안에서 원문 전체를 우선하고, C05는 문자열 계약을 명확히 하며 C02는 선택지 표현을 보완한다.

Cloud에 같은6사례의 실제 재평가를 전달했다. 새 실제 호출 수와 결과는 아직 미확인이며 후보 품질·고객 효용은 미검증이다. 위14회 baseline 기록은 그대로 유지한다. 후보 소스는 실제 결과 수용 전까지 저장소에 게시하지 않으며, 이번 반영은 문서2개뿐이다. 현재 수용 앱·CI·main은 변경하지 않았다.

현재 구현·진행 상태는 [PROJECT_STATUS](../PROJECT_STATUS.md), 실행 경로는 [START_HERE](../START_HERE.md), 실험 원문은 [IDEA016](../../experiments/idea016/README.md)에 있다.
