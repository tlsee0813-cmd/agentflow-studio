# 입력14 — 원본 정보 범위와 기존 지도 재사용
2026-10-16 15:05 KST 판단 시점. 현재 배정·진행은 [ACTIVE](../ACTIVE.md)에서만 갱신한다.

## 이번에 확인한 것
첫 실제 Cloud 발췌는 배정·명령/출력·완료 주장을 구별할 수 있었지만 프로그램 부분의 의미가 부족했다. [비연속8사건](https://github.com/tlsee0813-cmd/agentflow-studio/tree/1b83599f873888d8131e93c877b8c7d59b97acaf/docs/transfer/session-input-14/first-source)을 억지로 기능 지도에 넣지 않았다.

두 번째는 실제 제품13 배정·외부 작성자 반환·고정 코드·독립 보고를 대응했다. [입력과 재현](https://github.com/tlsee0813-cmd/agentflow-studio/tree/e8b28f5e85ae8319f4a4689678110c28e224bcfd/docs/transfer/session-input-14/product-v0)에5노드·1관계·7근거를 공유했다. 총괄/보조 AI가 해석한 보기 묶음이며 사람 원발화나 전체 도구 전사를 확보한 것은 아니다. 파일/검사/세션을 프로그램 기능 노드로 바꾸지 않았다.

기존 C11의 index/style와 fix1 engine을 고정하고 JSON만 교체했다. 기존 validate는 errors=[]·종료0. 총괄 브라우저에서 부분 선택→근거 열기/닫기→묶음 접기→관계 참고→명시적으로 다른 부분 선택을 확인했다. 접힌 묶음은 내부 네 변경 부분을 표시했고 묶음 전체 변경으로 바꾸지 않았다. 자동 추출·자동 갱신의 성공은 아직 아니다. Cloud가 같은 고정 입력으로 연 [1440×900 대표 화면](https://github.com/tlsee0813-cmd/agentflow-studio/blob/c0c81c0f1790bb319b4b4621734d11c2f145f478/docs/transfer/session-input-14/product-v0/screen/selected-area-add-1440.png)도 공유했다. 대표 화면 확보이며 전체 독립 기능검사가 아니다.

## 조사에서 채택한 최소 원리
Pro 조사 후 Astra가 공식 원문과 고정 코드를 대조했다. 두 환경을 하나의 전사 형식으로 취급하지 않는다.

1. **원문 위치와 사건 종류를 보존한다.** Claude의 MessageDisplay 식별자는 transcript 메시지 ID와 연결할 수 없다고 명시돼 있다. CLI의 replay-user-messages는 수신 확인용 재출력이다. 따라서 부분 출력/재출력을 새 요구로 세면 안 된다. [Hooks](https://code.claude.com/docs/en/hooks#messagedisplay-input), [CLI](https://code.claude.com/docs/en/cli-reference).
2. **작성자 주장과 관측 범위를 분리한다.** Codex 고정 타입은 발화·명령·파일 변경·MCP 호출을 구분하며 완료 이벤트가 성공만을 뜻하지 않는다. 파일 변경 결과·종료 상태·작성자의 ‘완료’ 문장을 서로 대체하지 않는다. [고정 ThreadItem](https://github.com/openai/codex/blob/a45b8ccb016fb74f63a6bc29e701568e387cbe38/codex-rs/app-server-protocol/schema/typescript/v2/ThreadItem.ts), [App Server](https://developers.openai.com/codex/app-server/).

공식 app-server thread/read의 기본 요약 응답과 이번에 쓴 read_thread 도구는 다른 표면이다. 공식 문서 설명으로 실제 빈 turns의 원인을 확정하지 않는다. 실제 표본의 버전·옵션·누락·재수신을 확인하지 않았으므로 이 조사로 수집 연결기 구현이나 무손실 보장을 선언하지 않는다. 나머지 세부 필드 대응은 후속 실제 입력이 필요할 때만 다룬다.

## 총괄 판단과 다음 작은 시험
구조와 근거 연결은 재사용됐지만 연구 설명과 배지가 길다. 이번 결과는 입력 대응의 가능성을 보여 주며 이 읽기량을 제품 기본 화면에 채택하는 근거는 아니다. Dify 실제 조작 비교는 제품 경험 평가축이고 여기의 원본 정보 범위 시험과 구분한다. 사람 사용 기록 제출을 추가 관문으로 두지 않는다.

다음은 제품13 fix1의 고정 결과를 같은 부분 이름·ID를 유지한 별도 입력 판본에 대응한다. 기존 v0를 덮지 않고 바뀐 코드·작성자 주장·독립 관측만 추가한다. 이름이 같다는 이유로 동일성을 강제하지 않으며 변경 없는 부분과 관계에 변화가 번지면 실패다. 수동 대응이 필요했던 판단을 남긴다. 범용 엔진·수집기·새 schema·제품 Area.parent 변경은 이 시험에 필요하지 않다.
