# AF81 독립 원문 검토 실험 (review.81)

이 디렉터리는 운영 변경이 아니라 좁은 실험 도구입니다. 제품 UI, runtime, schema, 생성 prompt, provider, 저장, API는 바꾸지 않습니다.

## 무엇을 반증하려는가

지도를 매번 다시 생성하기 전에 한 가지를 확인합니다. 저장된 studio.map.6 후보 하나를 수정하지 않은 채, 별도 문맥의 검토자가 원문과 비교했을 때 의미 오류를 찾아내는지입니다. 찾지 못한다면 이 방향은 반증됩니다.

- **74·77과의 차이.**
  - 74는 구조→주장 분리이고, 77은 typed 첫 읽기입니다. 둘 다 생성 방식을 바꿉니다.
  - 81은 생성하지 않습니다. 이미 있는 후보를 원문과 대조해 지적만 냅니다.
- **하지 않는 것.**
  - 지도를 생성하거나 고치거나 적용하지 않습니다.
  - 후보를 실행·수정·apply하지 않습니다.
  - 기존의 invalid raw를 구제하지 않습니다.
  - 작성자에게 자동으로 후속 호출을 보내지 않습니다.
- **검토 결과의 지위.** 검토자의 판정은 제품 수용 판정을 대신하지 않습니다. `readReview81`을 통과했다는 것은 형식이 맞고 위치·구간이 실재한다는 뜻일 뿐, 지적이 의미상 옳다는 보증이 아닙니다.
- **자료의 범위.** 이 디렉터리의 코드와 테스트는 합성 자료만 씁니다. 실제 원문과 실패 raw는 root만 보관하며 author에게 보내지 않습니다.

## 파일

- `review81.mjs`: 독립 실행 모듈입니다. 모델을 호출하지 않습니다.
  - `buildReviewAsk(mapAsk, candidateText)`: 검토 요청을 만듭니다.
  - `reviewMessages(built)`: 보낼 메시지 배열을 만듭니다(호출은 하지 않음).
  - `readReview81(raw, built)`: 검토 응답을 읽습니다.
  - `resolvePointer(doc, pointer)`: candidate 안의 위치를 찾습니다.
  - prompt 관련: `REVIEW_PROMPT`, `reviewPromptId()`, 그리고 재-export한 `MAP6_PROMPT`, `MAP6_FIRST_PROMPT`, `map6Prompt`.
  - 상수와 오류: `REVIEW_ASK_MAX_BYTES`, `REVIEW_REPLY_MAX_BYTES`, `ReviewInputError`, `ReviewFormatError`.
- `review81.test.mjs`: 순수 Node 테스트입니다. 응답은 손으로 쓴 합성 응답이며 API를 쓰지 않습니다.

## 입력: `buildReviewAsk(mapAsk, candidateText)`

- **mapAsk.** studio.map.6 ask(`buildMapAsk(…, MAP6_SCHEMA).ask`)입니다.
  - project·parts·relations·records(span.2 `lead`+`spans`)·requests·priors를 보낸 그대로 복사합니다.
  - ask의 다른 필드는 의미 입력에 들어가지 않습니다. 외부 진단, 모델 추론, 실패 label, 파일명, 점수표가 여기에 해당합니다.
- **candidateText.** 저장된 후보 응답의 원래 JSON 텍스트입니다.
  - 정규화하지 않습니다. runtime validator 기준으로 invalid여도 JSON이기만 하면 검토 대상이 됩니다.
  - `JSON.parse` 결과를 그대로 `candidate`로 둡니다. 따라서 공백은 사라지고, 정수처럼 보이는 객체 key는 JS 규칙대로 앞으로 옮겨집니다. map.6 응답 key에는 그런 것이 없습니다.
- **생성 prompt.** `generationPrompt`는 `map6Prompt(mapAsk)`이며, 후보가 만들어진 생성 지시를 바이트 그대로 담습니다.
  - 첫 지도이면 `MAP6_FIRST_PROMPT`, 이후 지도이면 `MAP6_PROMPT`입니다.
  - 구간 alias 안내도 이 원문 그대로입니다. 검토 prompt에 alias 정규식 설명을 새 생성 규칙으로 덧붙이지 않습니다.
- **원본 보존과 자료 취급.** 두 입력 모두 변경하지 않습니다(`structuredClone`). 자료 안의 명령문은 자료로만 읽힙니다.
- **입력 거절.** 다음 경우 `ReviewInputError`를 냅니다.
  - studio.map.6이 아닌 ask
  - decode되지 않는 기록
  - JSON이 아닌 candidate, 또는 텍스트가 아닌 candidate
  - 상한 초과

| 상한 | 값 | 재는 대상 |
|---|---|---|
| `REVIEW_ASK_MAX_BYTES` | 1,048,576 | `JSON.stringify(ask)`의 UTF-8 바이트. map 자료와 candidate만 재며, 고정 prompt 두 개는 제외합니다. |
| `REVIEW_REPLY_MAX_BYTES` | 65,536 | 검토 응답 원문 전체의 UTF-8 바이트. 응답에 걸리는 유일한 자원 제한입니다. |

메시지 구성(`reviewMessages`)은 세 개입니다.

1. system: `REVIEW_PROMPT`
2. user: 생성 prompt 원문(자료)
3. user: `JSON.stringify(ask)`

ask의 모양은 `{ "schemaVersion": "review.81", "map": {…}, "candidate": … }`입니다.

## 응답 계약 (확정, 4필드 지적)

```json
{"status":"clear|issues|unable","issues":[{"where":"/parts/0/claims/0/text","refs":["N01.03-05"],"finding":"…","instruction":"…"}]}
```

- **최상위.** key는 정확히 `status`와 `issues` 둘입니다.
  - `clear`이면 `issues`는 `[]`이고 통과입니다.
  - `issues`이면 지적이 1개 이상이어야 합니다.
  - `unable`이면 확인한 지적을 남길 수 있지만 통과가 아닙니다.
  - 결과의 `passed`는 `status === 'clear'`일 때만 true입니다. 이는 검토자가 오류를 찾지 못했다는 표시이며, root의 실험 성공이나 제품 수용이 아닙니다. 알려진 오류를 가진 표본의 `clear`는 오히려 검출 실패일 수 있습니다.
- **지적의 key.** 정확히 `where`, `refs`, `finding`, `instruction` 넷입니다.
- **where.** candidate 안의 실제 RFC 6901 JSON Pointer여야 합니다.
  - 누락은 그 사실이 들어갈 상위 container로 가리키고, 마땅한 곳이 없으면 `""`(root)로 둡니다.
  - 자기 key(`Object.hasOwn`)와 범위 안의 정수 index만 따라갑니다. prototype chain은 거절됩니다(`/toString`, `/parts/constructor`, 문자열의 `length`). 앞자리 0, `-`, 잘못된 `~` escape도 거절됩니다.
  - 코드 실행이나 임의 속성 접근은 없습니다.
- **refs.** 1개 이상이어야 합니다.
  - 각각 기존 `resolveEvidenceRange`로 확인합니다. 같은 전송 기록의 실제 끝점 사이 정확한 연속 원문이어야 하고, 600 UTF-16 이내여야 합니다.
  - 결과에는 `ref`, `record`, `from`, `to`, `quote`를 남깁니다.
  - 긴 범위를 자동으로 줄여 통과시키지 않습니다.
  - 같은 refs를 가진 독립 지적을 텍스트 기준으로 합치지 않습니다.
- **finding / instruction.** 비어 있지 않은 문자열이어야 하며, 쓰인 그대로 반환합니다(escape나 markup도 데이터 그대로). instruction은 고칠 방향이며 새 지도가 아닙니다.
- **추가하지 않은 제한.** kind enum, 지적 개수 상한, 필드별 글자 수 상한, refs 개수 상한은 두지 않습니다. 77처럼 임의의 개수 제한 때문에 의미 검토가 실패하는 혼동을 줄이기 위해서입니다.
- **형식 오류의 처리.** 형식 오류(`ReviewFormatError` {path, rule})는 caller가 별도로 기록하며, semantic 점수로 세지 않습니다.
  - 대상은 malformed JSON, 코드펜스, 추가 key, 없는 위치·구간, 600 초과, 빈 issues, `clear`+지적, 잘못된 status, 상한 초과입니다.
  - 형식 통과도 의미가 옳다는 보증이 아닙니다.

## 검토 prompt가 지키는 것

- **일반 기준만 둡니다.** 특정 표본의 정답·이름·RQ 조건·기존 실패 진단을 하드코딩하지 않습니다. 테스트 81-P가 표본 이름과 alias 패턴이 들어 있지 않은지 확인합니다.
- **비교 기준.**
  - 주체
  - 근거 소유
  - 조건·예외·부정·판본
  - 누락
  - 근거 없음
- **프로젝트 자료와 내포 자료의 구분.** 이 프로젝트에 대한 진단과 기록 안의 다른 제품·예문을 문맥으로 가릅니다. 따옴표나 코드 블록 여부만으로 가르지 않습니다.
- **의미를 막는 지적만 냅니다.**
  - 현재형 역할 서술만으로 완료 주장이라 보지 않습니다.
  - 원문으로 뒷받침되고 의미·귀속·조건 손실이 없는 책임별 구성 대안 자체는 지적하지 않습니다.
  - 의미·귀속·조건에 영향이 없는 스타일·선호·노드 수·어미 자체는 지적하지 않습니다.
- **금지하는 것.**
  - 일반 면책, 자기 승인, 해 보지 않은 검사 결과
  - 새 지도나 고친 진술 전문

## 두 판단은 따로입니다

1. **먼저 blind review를 한 번 돌립니다.** 저장된 후보들을 정답지를 보여 주지 않은 채 검토합니다. 검토자에게는 위 세 메시지만 갑니다. 정답지와 기존 실패 진단은 root가 결과와 따로 대조합니다.
2. **통과해도 남는 한계가 있습니다.** 이미 실패를 아는 표본을 골랐다는 선택 편향이 있습니다. 따라서 새 파이프라인, 즉 "생성 → 검토 → 한 번 재생성"이 결과를 개선하는지는 여전히 미증명입니다. 이것은 별도 실험으로 판단해야 합니다.

root는 다음 중 하나라도 나오면 중단합니다.

- 알려진 의미 오류를 놓침
- 옳은 사실을 삭제하라는 지적
- 현재형 역할만으로 오류라고 지적
- 계약 또는 시간 실패

추가로 다음 원칙을 지킵니다.

- 기존 invalid raw는 구제하지 않습니다.
- API 실행은 root가 별도로 합니다. 이 디렉터리에는 호출 코드가 없습니다.
- 작성자에게 자동으로 후속 호출을 보내지 않습니다.

root의 실행 스케치입니다. 호출 부분은 root 환경의 것이며, 이 저장소에는 없습니다.

```js
import { buildReviewAsk, reviewMessages, readReview81, ReviewFormatError, reviewPromptId } from './review81.mjs';
const built = buildReviewAsk(storedMapAsk, storedCandidateRawText);   // 원문/raw는 root 보관본
const raw = await rootCallsModelSeparately(reviewMessages(built));    // root가 별도 실행
try { record(reviewPromptId(), readReview81(raw, built)); }
catch (e) { if (e instanceof ReviewFormatError) recordFormatFailure(e.path, e.rule); else throw e; }  // semantic 점수 아님
```

## 검사

- 저장소 루트에서 `node --test docs/cycles/2026-10-29-source-review-81/review81.test.mjs`를 실행합니다.
  - 먼저 `app/continuity/dist`가 빌드되어 있어야 합니다.
  - import는 모두 상대 ESM 경로이므로 Windows 경로에서도 같습니다. 파일 경로를 문자열로 조립하지 않습니다.
- **이 환경의 버전.**
  - Node v22.22.0
  - 잠긴 TypeScript 5.8.3은 없고 TS 6.0.2만 있어서, dist는 TS6으로 임시 빌드했습니다.
  - 잠긴 빌드는 root가 실행합니다.
