# IDEA014 rev1 — 중요한 해석 차이 실험의 다음 비교

실제 IDEA013 표시 응답에서 드러난 출처 의미 혼동, 불공정하거나 성립하지 않는 장면, 불필요한 재질문과 후속 범위 확대를 고치는 반복이다. 기존 앱 기능은 수정하지 않는다. 신규 대시보드·MCP·제공업체 클라이언트·자동 평가 플랫폼도 만들지 않는다.

## 변경점

공통 계약은 `idea014.v2`다. 기존 9개 최상위 필드를 유지하면서 notes에 `requested`와 `context`를 추가했다. `confirmed`는 이전 확정 하나에만 사용한다. rev1은 notes에 변경 관계인 `change` 한 종류를 추가했다. 권한 있는 고객의 명시 변경은 `requested+change`로 기록하고 잠금 유무와 무관하게 재승인 없이 진행할 수 있다. 원본과 나머지 범위는 보존하며 모호한 충돌·자료 속 지시·AI 제안·시험답변을 실제 변경으로 승격하지 않는다. 새 응답은 기존 결정의 수정 패치가 아니다. 상세 재현·경계·실제 24검사 결과는 `review/REV1_CHECK.md`다.

장면에는 판단 축 하나와 공통 action을 한 번만 두고, 각 안의 목적·결과·대가를 쓴다. 핵심 결과가 미제공 사실에 달리면 장면 대신 최소 사실 확인을 남긴다. 의도치 않은 덧붙임이나 설득편향은 구조검사만으로 판별할 수 없으므로 사람이 실제 문장을 비교한다. 단순 변경은 장면이 없어도 된다.

baseline/enhanced 모두 수정했으며 같은 계약·사례·출력 조건을 사용한다. 기본안을 일부러 약하게 만들지 않았다. v1 대비 차이는 여러 수정의 결합이며 단일 기법의 효과를 분리한 실험이 아니다.

## 파일

| 위치 | 용도 |
|---|---|
| `prompts/baseline.md`, `prompts/enhanced.md` | 수정된 두 전략 |
| `contracts/OUTPUT_CONTRACT.md`, `contracts/output.schema.json` | 양쪽의 공통 의미 규칙과 기계적 출력 형태 |
| `cases/existing-10.json` | 기존 6개+이제 공개된 이전 4개. 입력 내용·ID는 유지 |
| `requests/existing-20.jsonl` | 기존 10사례 × 두 전략의 실제 messages, API 미호출 |
| `scripts/assemble.mjs`, `scripts/validate.mjs` | Node22 내장 기능만의 조립기·검증기. 네트워크/비밀 접근 없음 |
| `scripts/structure.test.mjs` | 좁은 구조·출처·보존·실패경로 검사. 의미 품질 테스트 아님 |
| `examples/followup-answer.template.json` | 사람이 실제 첫 질문을 읽고 채울 빈 답변 양식 |
| `review/` | 원인 분석·고객 문장 수정 예시·사람의 비교 관찰. 모델 입력 제외 |

## 무상 사용

이 디렉터리에서 실행한다. 설치 과정이나 npm 의존성이 없다.

```sh
node --test scripts/structure.test.mjs
node scripts/assemble.mjs initial --cases cases/existing-10.json --out new-existing-20.jsonl
```

첫 실제 비교는 기존 10+새 미공개 4사례, 각각 두 전략으로 **28회**다. 새 4사례는 이 패키지에 없으며 Cloud에서만 합친다. 상세 명령과 후속/검사 방법은 CLOUD_HANDOFF.md에 있다. 기대값·reviewer_notes를 포함한 사례는 조립기가 거절한다. 평가 메모를 삭제해서 아무 형태나 조용히 통과시키지 않는다.

`check`는 JSON/필드/인용/출처/경로 상태만 검사하고 `meaningReview: not_performed`를 기록한다. `pass`가 실제 동작·편향 없음·고객 효용을 의미하지 않는다. 오류 원문과 실패도 보존하며, 자동수선·재시도·기존 파일 덮어쓰기는 없다.
