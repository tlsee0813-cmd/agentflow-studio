# INIT009 Cloud 인계 — 준비 후 총괄 검토 대기

## 현재 준비 수준

단일 FULLSOURCE ZIP의 `source/`에서 시작한다. 입력 source87은 byte 불변이고 새 평가 코드/fixture/tests/docs만 추가했다. ZIP 루트의 source/runtime identity와 manifest를 먼저 확인한다. `diff/INIT009.patch`는 비교용이므로 FULLSOURCE에 다시 적용하지 않는다. Git 복원이나 이전 overlay 적용은 필요 없다.

고정 두 사례의 준비, 원장/HTTP 실행, 질문 회수, 고정 사실 답변 draft, follow-up 준비, keyless review-only, 안전 결과 수집, 별도 generation-free 항목 기록이 구현되어 있다. Pro의 신규25(단위19+native localhost HTTP6)와 기존 경계6은 무상 검증이다. 실제 DeepSeek 질문·새 prompt 효과·p01 오류 원인·실제 고객 수용은 미검증이다.

Pro에서 `npm ci --offline --ignore-scripts --no-audit --no-fund`는 TypeScript 캐시 미존재 ENOTCACHED로 실패했다. 재시도/외부 복원은 하지 않았고 이미 설치된 정확한 Node22.16/npm10.9.2/TypeScript5.8.3으로 check/build를 수행했다. 클린 설치 성공으로 읽지 않는다. 직접 브라우저 검사는 이번 도구 변경 범위에서 실행하지 않았다.

## 다음 순서

1. 총괄 6.1SolHigh가 새 코드·고정 계약·manifest와 무상 검사 근거를 독립검토한다. 그 후 기존 Cloud에서 `ALLOW_PAID_AI=false`로 clean install/check/build, 신규 두 test 파일과 필요 경계만 확인한다. 옛 INIT005/006/007 CLI나 전체178/parity/wholeUI를 다시 실행하지 않는다.
2. 최종 소스를 고정한 상태에서 `node scripts/init009/run.mjs --prepare-firsts`로 첫 요청 두 개의 실제 새 ID/상태/최종 본문을 고정한다. 이것은 keyless/generation0이고 live 원장을 만들지 않는다. 출력의 `reviewTemplate`과 `freshEvidenceTemplates`를 기반으로 실제 공식 가격·지원 캡처, legacy inventory, preflight를 준비한다. 현재 live-ready 자료는 ZIP에 들어 있지 않다.
3. 총괄이 그 실제 본문·4슬롯 예약<=USD0.12·공식 근거·원래 legacy identity·기존 Network-secret 경로와 preflight를 검토하고 `firsts-review.json`의 hash를 전달한다. `--review-only`가 먼저 keyless 근거를 검사한다. 실제 호출은 **기존 Cloud의 총괄 배정이 있을 때만** `--firsts`로 수행한다. 사용자에게 키/비용 허용을 다시 묻는 단계가 아니다.
4. `--questions`와 `--answer-draft`로 실제 검증 질문과 사실 답변 후보를 회수한다. draft의 `questionFactMatchReviewed:false`는 미검토다. 총괄은 질문 의미와 고정 사실이 맞는 행만 true로 검토하고, 맞지 않는 행은 `action:skip`, `answerDocument:null`, flag false로 둔다. p01 사실 원문/직접 입력, p03 unknown→deferred 두 행을 바꾸거나 새 사실을 넣지 않는다. 최종 파일은 고정 control의 `answers.json`이다.
5. `--prepare-followups`가 동일 firsts 원장/state/question과 답변 문서를 기준으로 최종 후속 본문을 고정한다. `followups-review.json`에 실제 plan/answers/원장 head와 fresh 근거를 묶어 총괄이 별도로 검토한다. `--review-followups` 후 총괄 배정하에 `--followups`를 수행한다. p01/p03 각각 최대 한 번이며 skip/실패 슬롯을 새 질문이나 재시도로 채우지 않는다.
6. `--collect`로 안전 합성 결과를 수집한다. 항목 상태 기록은 `--items-draft`로 생성한 별도 `items.json`을 총괄이 검토한 뒤 `--record-items`로만 처리한다. 이 단계에는 generation이 없고 내용 품질이나 실제 고객 승인을 자동 판정하지 않는다.

## Hash 규칙과 입력 파일

일반 파일·source manifest는 파일 bytes의 SHA256이다. review/plan/answers/원장 객체의 hash는 기존 B와 같은 `sha(JSON.parse(file))`, 즉 **파싱 후 JSON.stringify한 UTF-8 bytes**의 SHA256이다. whitespace는 달라도 되지만 key 순서가 바뀌면 hash가 달라질 수 있다. 일반 `sha256sum review.json` 결과를 검토 hash와 혼동하지 않는다. 다음은 keyless 계산 예이며 자동 승인이 아니다.

```sh
node --input-type=module -e "import {readJson,sha} from './scripts/init009/policy.mjs'; console.log(sha(readJson('/workspace/validation/init009/control/INIT009-KO-20261011-01/firsts-review.json')))"
```

`AFS_INIT009_REVIEW_SHA256`은 총괄이 전달한 해당 단계 hash, `AFS_INIT009_ITEMS_SHA256`은 별도 항목 문서 hash다. 기존 `AFS_INIT007_*` 값이나 과거 review/answers/preflight/price를 그대로 가져오지 않는다. 기존 legacy 자료는 수정하지 않고 원본 identity로 검증한다. `legacy.originalINIT007`의 source/runtime/fixture/reviewHash/ledgerHead는 실제 원본을 읽어 기록하며 새로운 제품 지문으로 치환하지 않는다.

모든 입력은 고정 control 경로의 파일이다. 파일이 없거나 stale/mismatch/불확실하면 거절한다. 첫 단계와 후속 단계 plan은 write-once다. 본문이나 지문 변경 시 자동 교체, 다른 경로 실행, lock 삭제, ledger reset으로 통과시키지 않는다. 변경 또는 불확실한 기록은 보존하고 총괄에게 보고한다. 기존 두 source 위치 중 정확한 원본 007 위치나 과거 report 위치를 확인하지 못하면 legacy gate를 완화하지 않는다.

## 실제 실행 직전 운영 조건

Linux/Node22.16.0, 고정 purpose/run, `ALLOW_PAID_AI=true`, `AFS_INIT009_ASSIGNMENT=INIT009-KO-20261011-01`, `AFS_INIT009_APPROVED_USD=0.12`, `AFS_INIT009_CREDENTIAL=network-secret`, 기존 프록시/Network-secret 경로만 사용한다. 실제 키나 전체 환경을 출력·등록·공유하지 않는다. 호스트 추가는 없다. 공식 지원/가격을 확인하지 못하면 live gate는 닫힌 채로 둔다. 4슬롯 예약 상한은 계정 청구 hard cap이 아니다.

무상 mock은 `--mock-firsts`, `--mock-answer-draft`, `--mock-followups`, `--mock-collect`가 별도의 로컬 mock/control 경로를 사용한다. mock draft에도 합성 운영자의 명시적인 검토 flag가 필요하다. 이 자료를 live firsts/answers로 복사하지 않는다. 이번 native HTTP 검사에는 주입 upstream과 가상 시계를 사용했으므로 새로운 실제 12초 전체 시간 측정이나 실제 API 준수 증거라고 하지 않는다.

보존 범위: 원래 005/006/007 source·lock·ledger·review·answers·report. 새 산출물 공유 시 키/.env/비밀/개인 자료/node_modules/dist/.git/옛 paid ledger/거절 raw/전체 입력 로그를 제외한다. 준비·제출과 독립 수용·실제 배정·실행·고객 승인 상태를 구분한다.
