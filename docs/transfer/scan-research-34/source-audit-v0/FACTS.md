# 34 준비 · 현재 지도 집계와 공개 T2의 사실

제품 기준은 `843ca3993615824452bfc80a6c0c4c65d35df376`이다. app.ts는 280,577B / SHA-256 `a104d3dc3210f841ac4275e8095b5a597a4d41e0d29809da338f672637bf6a09` / Git blob `42233d475b379b3fae36f4cae4a0b771eeae876f`이다. 지도 관련 코드는 729와 같은 경로다. 이 문서는 소스·JSON·기존 준비자의 검산 기록을 읽은 사실 정리이며, 제품·검사·도메인 API를 실행하거나 실제 화면을 새로 관측한 결과가 아니다. 구현안·새 요약·마지막 읽기 기준은 포함하지 않는다.

T2의 실제 경로에는 `input-v0/`가 있다. Tree API로 확인한 [공개 T2](https://github.com/tlsee0813-cmd/agentflow-studio/blob/24baf91fa2d519fd8cd33bb5ece28ec5b32323df/docs/transfer/reentry-judgment-32/input-v0/generated-v0/observer-input/T2.json)는 41,069B / SHA-256 `584bca013cdfcb3383a028b54dc5158ca438f8690e4a7e4420fe9a11a8b68fc7` / blob `9d449c0e8468cb300c827664a5527f9bcb772d21`이다. 합성 준비 자료이며 실제 구현·검사·사용자 증언이 아니다.

| 실제 카드·포함 프레임 | 자기 소유 요청 / 돌아온 결과 | 질문·설명의 실제 상태 | 초기 펼친 지도에서 카드가 만드는 정보 | 선택하거나 기록을 펼친 뒤 확인하는 것 |
|---|---|---|---|---|
| **읽기·검토** · 독립 부모. 프레임은 **미리보기**, **오류행 처리**를 포함 | 0 / 0. 자손까지 합하면 요청 2 / 결과 4지만 카드의 요청 수는 합산하지 않음 | 자기 질문·설명 없음. 하위 질문 2 = 답변 기록 1 + 현재 미답 1. 하위 유효 현재 설명 2 | `아직 요청 없음`, 하위 접기, `기록된 질문 2 · 현재 설명 2`. 프레임 제목은 `읽기·검토 안의 부분 · 접기` | 가지 신호를 누르면 해당 부모 패널의 기록 구역을 열고 초점을 보냄. 질문의 **실제 소유 부분**, 답변 상태, 정확 task/return 연결을 표시. 이 부모 자신의 새 요청과 자손의 기록은 별개 |
| **출력 준비** · 독립 부모. 프레임은 **내보내기**를 포함 | 1 / 0. 작업 **04**가 이 부모 소유의 현재 작업 | 자기 질문·설명 없음. 하위 질문 0, 유효 현재 설명 0, 보류 1, 이전 기준 설명 1 | `요청 1개`, `앱에서 이어갈 작업`, 하위 접기, `기록된 질문 0 · 설명 보류 1 · 이전 기준 1`. 프레임 제목은 `출력 준비 안의 부분 · 접기` | 하위 기록의 `설명 1`은 내보내기 **한 부분**에 설명 기록이 있다는 수다. 낡은 적용 설명과 보류 설명 두 항목을 한 개로 합쳐 현재 설명으로 만들지 않음 |
| **읽기·검토 › 미리보기** · 자식 카드 | 1 / 3. 작업 01, 반환 A1/A2/A3 | 질문 1은 `answered=true`, 적용 상태 `answered`. 헤더를 따로 표시한다는 **정상 answer 기록**이 현재 질문 원문에 정확히 연결됨. 현재 설명 r3은 유효, 데이터 **20행**. 이전 적용 설명 r2/r1도 보존 | 이름·소속·사용자 구상, `요청 1개 · 돌아온 결과 3개 · 앱 미검증`. 자식이 없는 카드이므로 자기 질문·설명 신호 버튼은 만들지 않음 | 소유 패널의 현재 설명, 접힌 이전 설명 r2/r1, 요청 01 및 정확 보고를 읽음. 질문은 `답변 기록 있음`. r3의 changes는 빈 배열이므로 예전 r2의 10→20 변화 문구를 최신 changes인 것처럼 새로 출력하지 않음 |
| **읽기·검토 › 오류행 처리** · 자식 카드 | 1 / 1. 작업 02, 반환 B1 | 질문 1은 `answered=false`, 적용 상태 `active`. **중단 / 제외 후 계속** 중 사용자 선택 기록 없음. 현재 설명 r1은 유효하며 ‘아직 선택되지 않음’을 설명 | 이름·소속·구상, `요청 1개 · 돌아온 결과 1개 · 앱 미검증`. 이 leaf 카드에 질문/설명 수는 직접 표시하지 않음 | 하위 기록에서 `답변 기록 없음 · 제품 선택 항목 있음`과 소유 부분을 확인. 요청 목록의 taskStatus는 보고 도착을 우선 표시할 수 있으나 질문은 별도 투영에서 남음. **보고 도착 + 유효 설명 + 미답 질문**이 동시에 성립 |
| **출력 준비 › 내보내기** · 자식 카드 | 1 / 2. 작업 03, 반환 C1/C_LATE | 질문 없음. 최신 **적용** 설명 r1은 `valid=false`. 늦게 받은 C_LATE는 `revision=null`, `held=plan-changed`로 한 번도 현재 설명이 되지 않음. 직접 scope는 **이번에는 CSV만 / XLSX 제외** | 이름·소속·구상, `요청 1개 · 돌아온 결과 2개 · 앱 미검증`. leaf이므로 낡음/보류 신호는 이 카드 자체에는 없음 | 패널에서 이전 설명을 현재 설명으로 쓰지 않는 이유를 표시. `이전 설명 · 반영하지 않은 정리`를 열면 낡은 r1과 늦은 보류 설명을 각각 읽음. 반환의 CSV/XLSX 주장을 현재 CSV 한정 조건으로 승격하지 않음 |

다섯 카드는 다섯 Area이다. 두 프레임은 같은 Area의 포함 관계를 보여 주는 파생 표현이며, 별도의 부분·작업·진행 단계가 아니다. 포함은 `space.containment.parents`, 업무 반환 연결은 `Task.parentTaskId`로 서로 다른 관계다. 관계 2건은 **미리보기 → 오류행 처리**(flow), **오류행 처리 → 내보내기**(needs)이다. 연결 때문에 질문 소유자를 복제하거나 부모 질문으로 옮기지 않는다.

질문 수는 `subtreeSignals`가 실제 소유 Area의 비반환 task에서 현재 저장된 question을 한 번씩 모은 수다. 답변 유무·적용 상태를 따로 보존하며, 기록된 질문을 새 의무·미결·완료 수로 바꾸지 않는다. 따라서 이 T2의 **질문 2를 미답 2로 치환하면 답변된 미리보기 질문을 다시 미답으로 만드는 오류**다. 여기서는 미답이면서 적용 가능한 질문은 오류행 처리의 1개다. 일반 데이터에서는 미답이어도 stale/unknown일 수 있으므로 `answered=false`만으로 현재 답변 의무라고 판정할 수도 없다.

설명 신호도 서로 다른 수다. `현재 설명`은 부분별 최신 적용 판본 중 valid인 부분 수, `이전 기준`은 최신 적용 판본이 있으나 invalid인 부분 수, `보류`는 revision이 null인 항목 수다. **미리보기의 이전 적용 판본 2개는 이전 기준 신호 2개가 아니다.** subtreePanel의 설명 수는 current 또는 held가 있는 부분 수라 출력 준비에서는 1이다. 복구 직후 `receivedAreas`는 비워지므로 `이번 탭 설명 갱신`은 T2의 영구 이력이나 미읽음 수가 아니다.

요청·반환 총수는 과거 기록 수다. 전체 T2에는 요청 4개와 report 반환 6개가 있다. 현재 `checkItems`가 골라 주는 ‘후속 작업문 없는 보고’는 각 연결의 최신 반환이며, 그 반환의 handoff와 후속 child가 없다는 조건이다. T2에서는 A3/B1/C_LATE 각 1개, 총 3개로 전체 반환 6개와 다르다. 이것도 실제 검토 여부·완료 여부를 추정한 수가 아니다. 부모 카드의 branch-signals에는 보고 수 자체를 넣지 않는다.

기존 데이터만으로 소유자·포함 경로·현재 task·질문의 정확 replyTo 답변 기록/적용 상태·설명 revision/stamp 현재성·보류 사유·요청 및 반환 수를 판정할 수 있다. 이 T2의 현재는 **출력 준비 작업 04**, 미전송 입력의 대상은 **읽기·검토**이다. 구별은 실제 ID로 가능하다. 앱은 이 값들로 외부 구현·검사 성공, 질문 내용의 의미적 해결, 어떤 작업을 먼저 해야 하는지까지 판정하지 않는다. 설명 valid도 출처/기준의 현재성이지 내용의 진실 검증이나 사용자 확정 조건 승격이 아니다.

근거는 다음 고정 소스와 준비 기록이다.

- [attention.ts](https://github.com/tlsee0813-cmd/agentflow-studio/blob/843ca3993615824452bfc80a6c0c4c65d35df376/app/continuity/src/shared/attention.ts#L40): checkItems, subtreeSignals, 실제 owner·answered·applicability 분리. blob `fffa5cafc552cbd765794d9ce654d1d1d0d2024a`.
- [domain.ts 질문 판정](https://github.com/tlsee0813-cmd/agentflow-studio/blob/843ca3993615824452bfc80a6c0c4c65d35df376/app/continuity/src/shared/domain.ts#L170), [설명 현재성](https://github.com/tlsee0813-cmd/agentflow-studio/blob/843ca3993615824452bfc80a6c0c4c65d35df376/app/continuity/src/shared/domain.ts#L789): 답변은 task의 현재 질문 text와 source.replyTo를 대조. 설명은 최신 적용 revision 및 live stamp를 대조. blob `71b7f4d027ac5f5c5615e4dcff4502496ab47b8e`.
- [카드·가지 신호](https://github.com/tlsee0813-cmd/agentflow-studio/blob/843ca3993615824452bfc80a6c0c4c65d35df376/app/continuity/src/client/app.ts#L1415), [선택 패널과 하위 기록](https://github.com/tlsee0813-cmd/agentflow-studio/blob/843ca3993615824452bfc80a6c0c4c65d35df376/app/continuity/src/client/app.ts#L1840), [설명 본문·이력](https://github.com/tlsee0813-cmd/agentflow-studio/blob/843ca3993615824452bfc80a6c0c4c65d35df376/app/continuity/src/client/app.ts#L1776). 프레임은 같은 파일 1471–1489, 소유 요청/직접 반환 총수는 1317–1334, subtreePanel은 1907–1919.
- [hierarchy.ts](https://github.com/tlsee0813-cmd/agentflow-studio/blob/843ca3993615824452bfc80a6c0c4c65d35df376/app/continuity/src/shared/hierarchy.ts#L1): Area 포함과 표시 투영. blob `3548ad1f1b6ab44742daad2ca0f5ea4a0354d6cd`.
- [기존 질문 신호 검산 기록](https://github.com/tlsee0813-cmd/agentflow-studio/blob/24baf91fa2d519fd8cd33bb5ece28ec5b32323df/docs/transfer/reentry-judgment-32/input-v0/generated-v0/sealed-answer/QUESTION_SIGNAL_PROOF.json)과 [준비자가 남긴 FACTS](https://github.com/tlsee0813-cmd/agentflow-studio/blob/24baf91fa2d519fd8cd33bb5ece28ec5b32323df/docs/transfer/reentry-judgment-32/input-v0/generated-v0/sealed-answer/FACTS.json)를 T2의 source/answer/수동값/설명 entries와 대조했다. 기존 Node24 준비 기록이며 이번 새 실행 결과로 세지 않는다.

위 내용의 화면상 실제 가독성·잘림·조작 가능성은 이번에 실행 검증하지 않았다. 제품·검사·원격 파일은 변경하지 않았다.

