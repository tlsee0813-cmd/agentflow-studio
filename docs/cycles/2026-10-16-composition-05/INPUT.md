# cycle05 입력 — FLOW091-C

2026-10-16 · 입력 감사 시점. 현재 상태는 [ACTIVE](../ACTIVE.md).

입력은 앞서 확인한 고정 `5416decfbe9f38a45323de0badc4fc58ec6e4bcd`의 [FLOW091-C](https://github.com/tlsee0813-cmd/agentflow-studio/blob/5416decfbe9f38a45323de0badc4fc58ec6e4bcd/docs/flow091-background-contract.md)이다. 아래는 **과거 개발 문서가 명시한 계약과 검사 보고**의 대조이며, 현재 구현·실행·사람 사용성을 확인한 결과가 아니다. 추가 문서는 사용하지 않았다.

## 보존할 명시 사실 11개

| 번호 | 입력에 유지할 사실 | 고정 출처 |
|---|---|---|
| F1 | 정책은 ‘목적을 작업문에서 제외’에서 ‘분리된 배경 블록에만 포함’으로 변경됐다. 목적을 요청·출처·기준·지시로 취급하지 않는 성질은 유지한다. | [L52](https://github.com/tlsee0813-cmd/agentflow-studio/blob/5416decfbe9f38a45323de0badc4fc58ec6e4bcd/docs/flow091-background-contract.md#L52) |
| F2 | 명시적인 새 요청에서 목적과 **그 요청의 대상 영역 하나**를 사본으로 고정한다. 지도 선택 영역이 아니며 다른 영역·관계·좌표·목적 이력은 제외한다. 빈 값을 ‘미정’이라는 내용으로 만들지 않는다. | [L10](https://github.com/tlsee0813-cmd/agentflow-studio/blob/5416decfbe9f38a45323de0badc4fc58ec6e4bcd/docs/flow091-background-contract.md#L10) |
| F3 | 목적·영역 이름·구상 수정, 보관·재배치·작업 이동·재정리·재내보내기·탐색은 기존 사본을 바꾸지 않는다. 다음 명시 새 요청만 최신 구상을 사용하며 합성 시험답변은 이에 해당하지 않는다. | [L11](https://github.com/tlsee0813-cmd/agentflow-studio/blob/5416decfbe9f38a45323de0badc4fc58ec6e4bcd/docs/flow091-background-contract.md#L11) |
| F4 | 일반 보고는 정확히 연결된 대상 작업의 사본을 잇는다. 대상이 없으면 사본도 없다. | [L12](https://github.com/tlsee0813-cmd/agentflow-studio/blob/5416decfbe9f38a45323de0badc4fc58ec6e4bcd/docs/flow091-background-contract.md#L12) |
| F5 | 파일 반환은 일치하는 반환 식별자의 내보내기 기록에 있는 사본을 사용한다. 옛 기록에 없으면 최신 구상으로 메우지 않는다. | [L13](https://github.com/tlsee0813-cmd/agentflow-studio/blob/5416decfbe9f38a45323de0badc4fc58ec6e4bcd/docs/flow091-background-contract.md#L13) |
| F6 | 내보내기 기록은 당시 작업문에 넣은 사본을 보존하지만 작업문 전문 전체는 보존하지 않는다. 이는 외부 수신·수락 증거와 다르다. | [L14](https://github.com/tlsee0813-cmd/agentflow-studio/blob/5416decfbe9f38a45323de0badc4fc58ec6e4bcd/docs/flow091-background-contract.md#L14), [L55](https://github.com/tlsee0813-cmd/agentflow-studio/blob/5416decfbe9f38a45323de0badc4fc58ec6e4bcd/docs/flow091-background-contract.md#L55) |
| F7 | AI 입력의 배경은 출처·기준과 분리된 전용 필드다. 서버 검증기·공급자 프롬프트·MOCK 경로가 이를 받도록 정한 계약이며, 실행 범위는 이번 요청이 정한다. | [L15](https://github.com/tlsee0813-cmd/agentflow-studio/blob/5416decfbe9f38a45323de0badc4fc58ec6e4bcd/docs/flow091-background-contract.md#L15) |
| F8 | 작업문·미리보기·Markdown은 배경을 별도 블록으로 구분한다. 배경 전체 구현이나 미정 사항의 임의 확정을 지시하지 않으며 사본이 없거나 내용이 모두 비면 블록을 넣지 않는다. | [L16](https://github.com/tlsee0813-cmd/agentflow-studio/blob/5416decfbe9f38a45323de0badc4fc58ec6e4bcd/docs/flow091-background-contract.md#L16) |
| F9 | 배경을 출처·기준·새 사용자 결정으로 자동 승격하지 않는다. 사용자가 직접 고친 범위·다음 단계·검사 내용의 우선권은 유지한다. | [L17](https://github.com/tlsee0813-cmd/agentflow-studio/blob/5416decfbe9f38a45323de0badc4fc58ec6e4bcd/docs/flow091-background-contract.md#L17) |
| F10 | 구상이 뒤에 바뀌면 기존 사본은 그대로라는 안내를 한다. 옛 저장 형식에도 현재 구상을 소급하지 않고 사본 없음으로 이관한다. | [L18–22](https://github.com/tlsee0813-cmd/agentflow-studio/blob/5416decfbe9f38a45323de0badc4fc58ec6e4bcd/docs/flow091-background-contract.md#L18-L22) |
| F11 | ‘A 이후 변경 → B → 늦은 A 보고’에서 A 사본과 B의 포커스·요청·사본을 보존했다는 **검사 보고**가 있다. 실제 사용자 사건이나 실제 AI 처리 성공으로 바꾸지 않는다. | [L33–41](https://github.com/tlsee0813-cmd/agentflow-studio/blob/5416decfbe9f38a45323de0badc4fc58ec6e4bcd/docs/flow091-background-contract.md#L33-L41) |

## 명시 관계와 제안 구성의 경계

사본을 **언제 고정하고 어디로 전달하며 무엇을 보존하는지**는 위 계약으로 연결할 수 있다. 이를 설명하려고 AI가 기능들을 묶거나 한 부분을 세분화하는 것은 허용할 해석 제안이다. 완성된 포함 트리가 없다는 이유로 제안 자체를 막지 않는다. 다만 그 묶음의 이름·상하위 포함·소유 범위는 문서가 확정한 모듈 구조와 구별하고, 기능 사이 전달선을 포함선·실행 순서·자동 영향 전파로 바꾸지 않는다. 파일 위치도 제품 구성의 정답으로 쓰지 않는다. 이 구별은 전체 지도뿐 아니라 상세와 준비문, 전체 복귀 후에도 유지해야 한다.

입력은 실제 프로젝트의 과거 계약 및 MOCK 검사 표본이다. 원대화·사용자 승인·실제 인계 수신·수락은 확인하지 않았다. 실제 외부 AI 호출은 없었으며 공급자 경로는 가짜 호출로 검사했다고 명시한다([L4](https://github.com/tlsee0813-cmd/agentflow-studio/blob/5416decfbe9f38a45323de0badc4fc58ec6e4bcd/docs/flow091-background-contract.md#L4), [L37–41](https://github.com/tlsee0813-cmd/agentflow-studio/blob/5416decfbe9f38a45323de0badc4fc58ec6e4bcd/docs/flow091-background-contract.md#L37-L41), [L58](https://github.com/tlsee0813-cmd/agentflow-studio/blob/5416decfbe9f38a45323de0badc4fc58ec6e4bcd/docs/flow091-background-contract.md#L58)). 요청 A/B는 검사 속 순서이지 실제 사람의 발화 시각이 아니다. 이 입력으로 구성 제안과 의미 보존을 비교할 수 있으나 현재 기능 완성이나 실제 협업 성과를 입증할 수는 없다.

## 흐름에서 막을 의미 왜곡 반례 3개

1. **전체 → 변경 부분:** AI의 ‘배경 준비’ 묶음을 확정 모듈로 보이고, 그 아래 놓인 작업문·AI 입력·반환을 같은 소유 영역 또는 모두 변경된 기능으로 색칠한다. 설명용 묶음과 명시된 전달 관계가 합쳐지는 오류다.
2. **변경 부분 → 상세:** 최신 목적을 A 사본에도 반영하거나, 늦은 A 보고를 현재 선택된 B에 붙여 ‘정리’한다. 최신 보기와 요청 시점 사본을 혼동하여 보존 계약을 뒤집는다.
3. **상세 → 준비 → 전체:** 연구용 준비문에 제안 구성을 승인된 실행 범위로 적거나, 배경 속 아이디어를 새 지시로 승격한 뒤 전체에 ‘전달·완료’로 남긴다. 준비는 제안이며 실제 전달·수락·완료가 아니다. 필요한 판단이 기록에 없으면 사용자 승인 숙제를 만들어 채우지 않는다.

판단 범위는 위 사실을 유지한 구성 제안의 읽기와 준비 흐름이다. Cycle04 종료 근거를 늘리거나 새 엔진·기능 전체를 요구하는 목록으로 사용하지 않는다.


