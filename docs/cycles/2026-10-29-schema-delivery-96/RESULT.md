# 완성 첫 지도 CLI 출력 스키마 경로 96 — 수용하지 않음

실제 지시 자료 한 건에서 89초 선택 마감까지 최종 응답이 없었다. 이 경로는 수용하지 않는다. 같은 호출을 재시도하거나 응답을 수선하지 않았으며, 미실행 micro·Zephyr 사례도 실행하지 않았다. 새 스키마의 실제 강제 여부·출력 의미·품질 개선은 관측하지 못했다. 제품 공급자 변경·UI 통합·병합·배포는 없다.

## 무엇을 새로 확인했나

[95 오프라인 판정](https://github.com/tlsee0813-cmd/agentflow-studio/blob/d6edeeff5e33336388b03ee4497b791944c87006/docs/cycles/2026-10-29-map-output-contract-95/RESULT.md)에서 만든 완성 FIRST map.6 JSON Schema를 설치된 CLI의 최종 응답 옵션에 추가했다. 원자료, 전체 ask, 지도 지시와 wrapper, Sol High, 의미 수용 기준은 보존89 실행과 같았다. 바뀐 출력 형식을 만들거나 답을 채워 넣지 않았다. CLI 옵션 지원과 오프라인 구조 적합은 실제 backend 효력의 증거가 아니다.

이 후속 실행은 총괄의 별도 선택이다. Astra의95 권고는 오프라인 대응 판정까지였으며 실제 호출을 권고한 것으로 해석하지 않는다. 74 DeepSeek strict나 완료된91/92 실험을 재실행하지 않았다. 이전 지연이 형식 때문이었다는 인과 주장도 하지 않는다.

## 단일 호출 결과

| 관측 | 결과 |
|---|---|
| 코드 기준 / app tree | d6edeeff5e33336388b03ee4497b791944c87006 / 501a7a1faa4b50c182e56ad0cd3a21ac65ed6e5d |
| 모델 / 설정 | 설치 CLI 0.164.0-alpha.11.1, gpt-6.1-sol / high |
| 실제 호출 | actual-order 한 건, top-level invocation 1회 |
| 관측 이벤트 | thread.started, turn.started만 관측 |
| 선택 마감 | 89,000ms, SELECTION_DEADLINE |
| capture 반환 / 최종 수용 검사 | 89,082.103ms / 89,934.8609ms |
| 종료 / 보존 | SIGTERM, close 확인, 보호 파일·원문·source 보존 통과 |
| 최종 응답 / 적용 | 파일 ENOENT, 응답·적용 없음 |
| 후속 / 수선 / 제품 통합 | 모두 0 |

원본 실행 영수증에서 뽑은 [공개 요약](evidence/execution-summary.json)은 고정 입력·원문·runner·schema의 해시를 포함한다. 비공개 원문·모델 대화·raw 진단·로컬 절대 경로는 공개하지 않는다. 해시는 바이트 식별 근거이며 의미의 증명이 아니다. CLI 내부 전송 재시도 전체 횟수는 이 실행기로 관측하지 못한다.

90초는 후보 검증·보존·산출물의 수용 기준이다. raw 진단과 최종 receipt 저장은 별도로 측정했다(시작 89,938.4563ms). 운영체제·backend 종료 또는 모든 디스크 작업이90초 안에 끝난다는 보장이 아니다. 후보 파일이 있더라도 최종 applied·preservation·budget·cleanup 관문 없이 수용할 수 없다. 이번에는 후보가 생성되지 않았다.

## 실행 전 수리와 독립 검토

처음89 실행기를 바탕으로 만든 초안에는 UTF-8 분할 바이트 처리, 출력·close 대기 상한, 사후 원본 보존을 수용 조건으로 삼는 검사 세 가지가 빠져 있었다. 모델 호출 전에 독립 검토로 발견했다. 기존91/92의 raw buffer·fatal UTF-8 검증을 회수하고, 단일 호출의250ms 종료 대기 상한과 최종 보존 관문을 더했다. 최초 초안과 검토 기록은 로컬에 보존했다.

총괄이 바뀐 경계의 fake-child/raw-file 반례10개를 실행했다. [검사 기록](evidence/guard-probe.json), [단일 CLI capture 코드](evidence/experience96-cli-capture.mjs), [독립 변경 검토](evidence/preflight-delta-review.json). 이 검사는 실제 provider·OS 종료·의미 수용의 증명이 아니다. 독립 담당은 소스와 기록을 대조했으며 동일 테스트·CLI·모델을 재실행하지 않았다. 최종 두 줄 metadata 정정은 수용 조건을 바꾸지 않았다.

기존734 로컬 빌드, 동일한 전체 src tree와 이미 확인한 runtime5개 해시를 대조하고 실행 전후 shared JS 전체를 고정했다. 새95/96 로컬 빌드를 했다는 주장은 없다. 코드 변경 없는 이번 경로에 제품 CI나 이전 UI 검사를 다시 실행하지 않았다.

[독립 종료 대조](evidence/independent-result-review.json)는 frozen/started/result의 결속, 보호35파일, 원본source/app과 clean 상태, 접수 이벤트 대응을 확인했다. 최종·parsed·backup 파일 부재와 후속 두 사례의 started 기록 부재도 대조했다. 독립 담당이 새 모델·CLI·UI 검사를 실행한 것은 아니다. 총괄은 이 근거로 현재 전달 경로를 반려한다.

사전검토 문서의 root prepare1/run0은 당시 전달된 진행 상황이며 이후 이 문서에 기록한 단일 호출1회와 구별한다. reviewer execution0은 독립 담당의 실행 횟수다.

## 남은 판단

공개 수용73, 미수용74, UI 범위 수용75 및693d0c7 수리를 유지한다. 첫 지도 Q02/Q06과 인수인계5·8절의 전체 의미·전달 관문, 실제 세 자료·복잡한 배치·최종 PC 경험은 미완료다. 결과 없는 이번 호출로95 오프라인 판정을 실제 성공으로 승격하지 않는다. timeout 연장·동일 호출 반복·후발 결과 대체는 선택하지 않았다. 다음 작업은 완료 증거와 남은 제품 문제를 대조해 별도로 선택하며, 전체 목표는 활성 상태다.
