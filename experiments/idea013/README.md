# IDEA-013 — 중요한 제품 선택을 찾는 DeepSeek 실험 준비

**상태: 요청 자료 준비 완료 / 실제 API 실험 미실행.** 기존 제품 소스를 수정하지 않는 독립 묶음이다. 설치·비밀키·이전 전체 소스가 필요하지 않다. Pro가 준비했고, 실제 호출은 기존 DeepSeek 연결과 비밀 주입을 가진 Codex Cloud가 맡는다. Cloud에 전달하거나 실행한 상태는 아니다.

이번 질문은 '예약 예시를 잘 재연하는가'가 아니라, 다른 작은 업무 앱의 요청에서도 중요한 해석 차이를 찾고, 필요할 때만 짧고 균형 잡힌 장면으로 보여줄 수 있는가다. 질문이 필요 없는 변경과 정보가 부족한 요청도 비교한다. 이 결과로 제품 방향을 바꿀 수 있으며 리허설 제품을 영구 확정하지 않는다.

## 바로 넘길 것

GitHub에서 전달할 때는 이 브랜치의 정확한 커밋과 `experiments/idea013/` 경로를 사용한다.
ZIP 없이 같은 준비 자료를 읽을 수 있다. 독립4사례는 이 저장소 밖에서 따로 전달한다.

이 폴더 전체와 `CLOUD_HANDOFF.md`를 기존 Cloud에 전달한다. `requests/development.jsonl`에 **6사례 × 두 프롬프트 = 12개의 실제 messages**가 이미 조립되어 있다. JSONL 각 행의 `messages`만 기존 호출 경로에 넣는다. requestId·promptId 등은 로컬 결과 연결용이며 모델 입력이 아니다.

별도 Claude의 미공개 4사례는 **이 묶음에 없고 읽거나 만들어 대신 채우지 않았다.** Cloud에서 같은 입력 형태로 8개 요청을 추가하면 첫 비교 20회가 된다. 필요하면 실제 첫 질문에 대한 명시적인 시험답변으로 후속 약 4회를 더한다. 이는 첫 실험 크기이지 지출 상한이나 영구 호출 제한이 아니다. DeepSeek 유료 사용 승인은 이번 사용자 지시로 주어져 있으며 재승인 절차를 추가하지 않는다.

## 내용

| 파일 | 용도 |
|---|---|
| `prompts/baseline.md`, `prompts/enhanced.md` | 유능한 일반 제품기획 전략과 결과 차이 중심 전략. 기본안도 다른 사람 관점·예시·적절한 비질문 진행을 수행한다. |
| `contracts/OUTPUT_CONTRACT.md`, `output.schema.json` | 두 전략에 동일한 JSON 계약. 앞 파일은 공통 system 내용으로 붙고, schema는 로컬 구조검사용이다. |
| `cases/development.json` | 예약 외 6개 한국어 개발용 가상 고객 입력. 실제 고객조사 기록이 아니다. |
| `requests/development.jsonl` | 같은 사례의 user 입력은 동일하고 system 전략만 다른 12개 준비 요청. |
| `scripts/assemble.mjs` | Node 22 내장 기능만 사용한 초기/한 번의 후속 messages 조립과 작은 구조·출처 검사. 통신·자동 재시도·키 접근 없음. |
| `review/` | 사람이 볼 기대 관찰과 비교 양식. 모델로 전송하지 않는다. |
| `examples/followup-answer.template.json` | 일부러 비워 둔 후속 답변 양식. 질문·제공자·답변을 명시하지 않으면 조립을 거절한다. |
| `scripts/structure.test.mjs`, `CHECK_RESULT.md` | 무상 구조검사와 실제 실행 결과. 모델/앱 품질 검증이 아니다. |

모델에는 `baseline 또는 enhanced 전략 + 공통 계약`이 system으로, 고객 사례 JSON이 user로 들어간다. 평가 메모·기대 경로·시험용 구조 fixture는 조립하지 않는다. 첫 요청은 서로 독립적이며 사례마다 두 전략의 실행 순서를 번갈아 둔다.

## 로컬 명령

압축을 푼 최상위 폴더에서 실행한다. npm 설치나 제공업체 SDK가 필요 없다.

```sh
node --test scripts/structure.test.mjs
node scripts/assemble.mjs initial --cases cases/development.json --out work/development.jsonl
```

두 번째 명령은 요청 파일 생성만 하며 API를 호출하지 않는다. 이미 같은 출력 파일이 있으면 실패한다. 기존 파일을 덮거나 지우지 말고 필요한 경우 새 출력 이름을 사용한다. 실험 전 전체 과거 제품 테스트를 다시 실행할 필요는 없다.

## 판단 범위와 한계

출력의 핵심은 `route`, 원문 인용, 같은 상황의 대안 행동/결과, 필요한 고객 판단, 확정·제안·추정·미정, 작은 다음 행동이다. `fork`는 2~3개 대안, `proceed`는 장면 없이 또는 하나의 기준장면, `need_info`는 장면 없이 최소 정보 질문을 반환한다. 보류는 자동 동의가 아니며 시험답변은 `test_only`다.

구조검사는 JSON 형태·ID·인용 부분 문자열·일부 상태 조건을 확인한다. 인용이 주장을 실제로 뒷받침하는지, 두 해석이 모두 합리적인지, 중요한 충돌을 빠뜨리지 않았는지는 사람이 읽어야 한다. 출력은 기존 결정 원본의 대체본이나 적용 가능한 패치가 아니다. diff·보고된 단위 검사·가정 장면은 실제 서비스 동작의 증명이 아니다.

이번 지시와 제공된 MASTER_SPEC·REQUIREMENTS_INTERVIEW_PROMPT·DOT_ORCHESTRATOR_PROMPT·WORKER_REVIEW_TEMPLATES의 확정/제안 구분, 좁은 작업 범위, 정직한 검증 원칙을 참고했다. 최신 IDEA-013에 따라 노드그래프·effort·MCP·실시간 감시는 이번 실험의 확정 기능이 아니다. 기존 통합 명세 전체의 승인·폐기나 제품 코드 재설계는 수행하지 않았다. IDEA-011/012는 이번에 전달된 요약만 사용했고 다른 세션의 실제 HTML·작업 폴더를 읽었다고 가정하지 않았다.
