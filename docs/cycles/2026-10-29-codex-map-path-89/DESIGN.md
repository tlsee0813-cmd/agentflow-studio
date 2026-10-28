# 89 첫 지도 실행 경로 후보

기준은 `ab8e45cdb34cdba8328c8cee369b010f346ed3ea`, runtime `2999fd65c67754bd7a0bd0d45f9fd841fd3956e5`, app tree `7beb4ba00211a1afd3b9549ef4eb08a55b2a8384`다. 최신 checkpoint `346f12f23e6a4b3898347087e2bd758ac62c23b8`은 상태 문서만 추가했고 공개73을 유지한다. UI75 최종693 수리는 현재 후보에 포함되어 있다.

## 선택

76의 실제 작업 지시에서 첫 지도가 완결되지 않은 문제로 돌아간다. 기존 DeepSeek 호출·실패한 분해/검토자/주어 우선 실험을 반복하지 않는다. 이미 설치된 Codex CLI의 Sol High 비대화형 실행을 새 후보로 한 번 검토한다. 기존 원문과 production map.6 계약을 그대로 유지하며, 사람의 정답 지도·오류 판정·의미 평가표는 생성 입력에 제공하지 않는다.

가설은 이 실행 경로가 같은 복합 자료에서 완결된 지도와 핵심 의미를 함께 전달할 수 있는지다. Codex의 agent scaffold와 user-message 포장이 기존 DeepSeek system/user API와 다르므로 모델 하나만 바꾼 통제 비교라고 주장하지 않는다. 제품 provider에 연결하지 않은 격리 후보 시험이다.

## 출력 전에 고정한 범위

- 실제 지시 원자료 SHA256 `6c5bbfd44899c67e7478618a7d43bbbd69fd392598ef48bb160aafc81c8595b4`와 76 ask SHA256 `d64857baa4b3e5fce53cc9bc4a2a754c042d64d87ba8bfa0cc3e6935b8cc1d11`를 그대로 사용한다.
- production prompt `m6-33ff86d5f2da`, map 지침 SHA256 `81d6e96834d7c245270785dafe2861bcc010779f12ec14f6b9472b378a8ff846`; wrapper SHA256 `45219945020c17be054bcdf46ec584e1ebc2b8537581c513b29e5590f0ddaa31`.
- CLI `0.164.0-alpha.11.1`, 요청 모델 `gpt-6.1-sol`, reasoning `high`; 기존 저장 인증을 사용하고 인증파일을 읽거나 계정을 전환하지 않는다.
- 빈 임시 작업 폴더·read-only·사용자 config 미로딩·shell/web 비활성, 출력 event에 도구 항목이 나타나면 종료하고 비교에서 제외한다. 이 설정이 Codex 내부 지침까지 제거한다는 뜻은 아니다. CLI invocation 수와 내부 transport 재시도 수를 구별하며 후자는 이 하네스에서 미관측이다.
- 시작부터 90초, 각 원자료 실행 최대1회, 자동 재제출·출력 교정·fence 제거·alias 수선0. CLI 최종 exit0 및 turn.completed와 최종 JSON 모두 필요하다. `--output-schema`를 추가해 계약 조건을 바꾸지 않는다.
- 기존 76 의미 조건 A1–A5와80의 역할 표현 정정을 적용한다. 현재형 역할만으로 구현 완료 오판이라고 단정하지 않는다. 운영 절차의 제품 부품화, 이미 답한 질문의 재개방, 철회·판본·동결 항목 대응 누락, 합성 예문의 제품 사실 승격은 계속 반려한다.
- validator/apply의 private 사본 결과는 구조 보존 가능성으로만 기록한다. 의미 수용·정상 UI 저장·세 원자료·문단/배치 반례 수용은 각기 별도 관문이다. 첫 건 실패면 다른 두 원자료는 실행하지 않는다.

기존 [공식 비대화형 문서](https://learn.chatgpt.com/docs/non-interactive-mode)의 JSONL/최종 출력 파일/저장 인증 지원과 [설정 문서](https://learn.chatgpt.com/docs/config-file/config-reference)의 shell 설정을 확인하고 설치된 CLI 도움말과 대조했다. 새 설치나 환경 재구성은 하지 않았다.

## 유지하는 수용 경계

공개73, 미수용74, UI 범위 수용75를 구별한다. 76의 불확실성 계약과 후속 UI 개선은 유지하되 이 후보 한 건이나 JSON 유효성으로 인수인계5/8의 전체 관문을 닫지 않는다. 공개 배포·병합·운영 provider 변경은 없다. 비공개 지시 원문·최종 원응답·전체 event stream은 Ops에 보존하고 공유 문서에는 결정과 최소 실행 메타데이터만 남긴다.
