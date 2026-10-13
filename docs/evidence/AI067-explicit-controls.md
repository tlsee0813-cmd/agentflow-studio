# AI067 — exact2750 명시적 가입 철회 대조

Claude의 병렬 수정과 독립적인 고정 baseline의 synthetic actual-model experiment다. AI060/EVIDENCE066의 모호한 입력과 9응답은 보존했고 재생성하지 않았다. 제품·프롬프트·모델 설정·기본 limiter를 바꾸지 않았으며 전체 검사·설치·CI·브라우저 재검사·입력 사후 수정은 없다. 이 문서에는 합성 앱 자료와 필요한 실험 metadata만 있다. 실사용자 효능·전체 품질 보장·일반 실패율 추정이 아니다.

## 1. 동결과 실행 관측

| 항목 | 값 |
|---|---|
| 환경 / Node | agentflow-studio-dev / Node 22.16.0 |
| baseline source | `2750b58fdee710ff33a7e65f24c182c63f708577` |
| 실제 모델·설정 | deepseek-flash; thinking disabled; output 4096; timeout 60초; temperature 필드 미전송 |
| 기본 limiter | 분당6 / process20 유지; 하나의 서버, 순차 처리; 재시작 우회 없음 |
| 상한 / 실제 | 최대6 / 실제 provider 전송6, provider 200 6, product 200 6, finish stop 6 |
| 429 / 재호출 | local429 0; 이미 송신한 슬롯 retry 0; 표현변형·재생성 0 |
| 코드 확인 | 기존 소스 manifest의 42파일 blob 일치·변경 없음만 확인; 제품 전검사 없음 |
| 증거 경로 | /workspace/work/ai067; 기존 AI060 경로 불변 |

실제 경로: createContinuityApp({fetchImpl:protectedFetch}) → /api/continuity → 실제 모델. 기존 보호 adapter를 그대로 사용했다. startup/권한 자료·헤더·인증 값·환경 dump는 이 문서에 포함하지 않는다.

실행 전에 scenario 원문·기대기준과 runner 원문을 고정해 아래 UTF-8 SHA-256을 기록했다. 실행 후 동일 hash를 확인했다. 원문 파일은 로컬 증거 경로에 보존되어 미래 수정 SHA에서도 같은 fixture/runner를 재사용할 수 있다. runner는 첫 인자에 준비 source 경로, 둘째에 그 SHA를 받으며 인자 없이 exact2750을 사용한다. 실험 결과 파일은 재실행으로 덮어쓰지 않도록 생성 전용이다.

| 원문 | UTF-8 크기 | SHA-256 |
|---|---:|---|
| scenario.json | 2506 | 7fd87691dbd501cfb64e71f7619cd96424104d170092dad7a952296f41a2b76b |
| run.mjs | 8723 | 70f38137b6d68d4eab98f334f090de50d2d72409309bc441aa49b50e6447ac20 |

runner 전체 source는 run.mjs에 보존했으며 문서에서는 hash와 실제 operation trace로 연결한다. 모델·입력·판정기준을 결과에 맞춰 변경하지 않았다. 별도 영속 ledger는 provider transport_attempt 직전에 슬롯을 예약·fsync하며 6을 넘으면 전송 전에 거절한다. 아래 6슬롯 모두 실제 200응답으로 확인됐다.

## 2. 고정 scenario 원문·기대기준

scenario.json 전체 원문(생략 없음):

```json
{
  "schema": "ai067.explicit-controls.1",
  "baselineSHA": "2750b58fdee710ff33a7e65f24c182c63f708577",
  "maxActualCalls": 6,
  "modelSettings": {
    "model": "deepseek-flash",
    "thinking": "disabled",
    "maxTokens": 4096,
    "timeoutMs": 60000,
    "temperature": "omitted",
    "rate": 6,
    "processCap": 20
  },
  "cases": [
    {
      "id": "P1",
      "maxCalls": 4,
      "turns": [
        "가입한 고객만 예약을 취소할 수 있게 해줘.",
        "가입 여부와 로그인 검사를 없애고 비회원도 SMS 링크로 예약을 취소할 수 있게 바꿔. 환불은 이번 범위에서 제외해.",
        "취소 버튼 색만 빨강으로 바꿔줘.",
        "SMS 문구만 짧게 해줘."
      ],
      "operations": "Each turn: setKind(request) -> editDraft(exact turn text) -> submit -> begin -> real API -> receive. No manual basis edit/retire.",
      "expected": [
        "After explicit withdrawal, next/scope/checks/handoff reflect removal of signup/login checks and non-member SMS cancellation, with refunds excluded.",
        "Color and SMS-copy follow-ups change only the current small work scope and preserve the valid no-signup/no-login, non-member SMS cancellation, and refund-exclusion conditions.",
        "Do not treat an unresolved/conflicting response as PASS. Assess actual work/handoff, not just intent words."
      ]
    },
    {
      "id": "P2",
      "maxCalls": 2,
      "initial": "가입한 고객만 예약을 취소할 수 있게 해줘.",
      "correction": {
        "goal": "가입 여부와 로그인 검사 없이 비회원도 문자 링크로 예약 취소",
        "conditions": "환불 제외"
      },
      "confirmed": {
        "text": "링크는 SMS로만 보낸다",
        "status": "confirmed",
        "relation": null
      },
      "operations": "Initial request -> real AI1 receive -> correctIntent on the same task -> recordBasis confirmed with null relationship on same task -> begin -> real AI2 receive. Do not edit/retire/hide initial request or D1.",
      "expected": [
        "Actual second request simultaneously includes previousIntent.value:null, exact manualGoal/manualConditions, and confirmed SMS-only basis.",
        "Actual next/scope/checks/handoff reflect removal of signup/login checks, non-member link cancellation, SMS-only delivery, and refund exclusion.",
        "Observe real product state changes only; do not plant retired/active flags or an expected answer."
      ]
    }
  ]
}
```

P1은 네 번의 정상 작업 입력으로 진행한다. P2는 첫 AI 수용 뒤 **동일 task의 correctIntent만 직접 정정**하고 confirmed SMS-only를 추가한다. 두 경우 모두 최초 D1requested를 runner가 edit/retire/hide하지 않았다. expected 문구는 모델 입력에 별도 정답으로 주입되지 않았다.

## 3. 회차 입력·operation·prestate 대응

각 회차의 전체 pre-request Project는 `<회차>-pre-request-project.json`, begin 뒤 pending state는 `<회차>-pending-project.json`, 수용 뒤 state는 `<회차>-post-response-project.json`에 원형 보존했다. 아래 표는 실제 원본의 참조·revision·상태를 발췌한 것이며 새로운 Project 상태가 아니다. operation trace는 각 `<회차>-operations.json`에 before/after revision과 실제 args를 보존한다. 이 표에서 구현 수행·SMS 전송·예약 취소·환불 등 제품 밖 행동은 모두 미실행이다.

| 회차 | 현재 request 원문 / 직접 operation | prestate task / revision | 원형 기준 상태 | 실제 operation 순서 |
|---|---|---|---|---|
| P1-1 | 가입한 고객만 예약을 취소할 수 있게 해줘. | T_069e3772-0266-4034-a8bd-130ada3565b5 / r4 | D1 requested r4; history=[] | createProject → setKind → editDraft → submit → begin |
| P1-2 | 가입 여부와 로그인 검사를 없애고 비회원도 SMS 링크로 예약을 취소할 수 있게 바꿔. 환불은 이번 범위에서 제외해. | T_955bfd2b-3d03-4012-a93e-12203c8bf0cd / r8 | D1 requested r4; history=[]<br>D2 requested r8; history=[] | setKind → editDraft → submit → begin |
| P1-3 | 취소 버튼 색만 빨강으로 바꿔줘. | T_0e82fe2c-47b3-452a-946a-01921262d60d / r12 | D1 requested r4; history=[]<br>D2 requested r8; history=[]<br>D3 requested r12; history=[] | setKind → editDraft → submit → begin |
| P1-4 | SMS 문구만 짧게 해줘. | T_40da14f6-e89e-4951-a572-262436e24f24 / r16 | D1 requested r4; history=[]<br>D2 requested r8; history=[]<br>D3 requested r12; history=[]<br>D4 requested r16; history=[] | setKind → editDraft → submit → begin |
| P2-1 | 가입한 고객만 예약을 취소할 수 있게 해줘. | T_66f44b53-05a9-4f2a-ba9f-f4e836155e6d / r4 | D1 requested r4; history=[] | createProject → setKind → editDraft → submit → begin |
| P2-2 | 가입한 고객만 예약을 취소할 수 있게 해줘.<br>같은 task 직접 정정: 가입 여부와 로그인 검사 없이 비회원도 문자 링크로 예약 취소 / 환불 제외; confirmed: 링크는 SMS로만 보낸다 | T_66f44b53-05a9-4f2a-ba9f-f4e836155e6d / r7 | D1 requested r4; history=[]<br>D2 confirmed r7; history=[] | correctIntent → recordBasis → begin |

P2-2에서는 새 request submit이 없다. 최초 가입 제한 request와 D1은 그대로 남고, 직접 정정 및 새 confirmed 기준이 동시에 존재한다. 정상 operation 원형 trace(전체, 생략 없음):

```json
[
  {
    "operation": "correctIntent",
    "args": [
      "T_66f44b53-05a9-4f2a-ba9f-f4e836155e6d",
      "가입 여부와 로그인 검사 없이 비회원도 문자 링크로 예약 취소",
      "환불 제외"
    ],
    "before": {
      "revision": 5,
      "taskId": "T_66f44b53-05a9-4f2a-ba9f-f4e836155e6d"
    },
    "after": {
      "revision": 6,
      "taskId": "T_66f44b53-05a9-4f2a-ba9f-f4e836155e6d"
    }
  },
  {
    "operation": "recordBasis",
    "args": [
      "링크는 SMS로만 보낸다",
      "confirmed",
      null
    ],
    "before": {
      "revision": 6,
      "taskId": "T_66f44b53-05a9-4f2a-ba9f-f4e836155e6d"
    },
    "after": {
      "revision": 7,
      "taskId": "T_66f44b53-05a9-4f2a-ba9f-f4e836155e6d"
    }
  },
  {
    "operation": "begin",
    "args": [
      "T_66f44b53-05a9-4f2a-ba9f-f4e836155e6d"
    ],
    "before": {
      "revision": 7,
      "taskId": "T_66f44b53-05a9-4f2a-ba9f-f4e836155e6d"
    },
    "after": {
      "revision": 7,
      "taskId": "T_66f44b53-05a9-4f2a-ba9f-f4e836155e6d"
    },
    "ticket": {
      "projectId": "P_6bceb097-938c-4af2-b195-cefc771dcc7d",
      "revision": 7,
      "requestId": "R_30ee0b9f-0f87-44d9-949e-c8c0bcc31ae6",
      "taskId": "T_66f44b53-05a9-4f2a-ba9f-f4e836155e6d"
    }
  }
]
```

첫 실제 요청별 source identity: 아래는 P1-1/P2-1의 source-identity 파일 전체다. 준비용 firstRequest와 혼동하지 않는다.

```json
[
  {
    "call": "P1-1",
    "projectId": "P_f5e9aa63-6348-4729-9971-9970ad6ea7f7",
    "taskId": "T_069e3772-0266-4034-a8bd-130ada3565b5",
    "requestId": "R_825bdccb-6bb8-4519-a7fe-f140083ba3fc",
    "sources": [
      {
        "id": "S_76270a27-e13e-475d-8b35-64cc97203cb0",
        "taskId": "T_069e3772-0266-4034-a8bd-130ada3565b5",
        "kind": "request",
        "at": "2026-10-13T18:11:31.811Z"
      }
    ]
  },
  {
    "call": "P2-1",
    "projectId": "P_6bceb097-938c-4af2-b195-cefc771dcc7d",
    "taskId": "T_66f44b53-05a9-4f2a-ba9f-f4e836155e6d",
    "requestId": "R_3925d75c-5637-4669-b2a3-c5ae819cb2f2",
    "sources": [
      {
        "id": "S_c4ddb398-c430-4c95-882e-0b07e3425377",
        "taskId": "T_66f44b53-05a9-4f2a-ba9f-f4e836155e6d",
        "kind": "request",
        "at": "2026-10-13T18:11:45.872Z"
      }
    ]
  }
]
```

### prestate 핵심 원형 — P1-4와 P2-2

각 pre-request-project 파일에서 schemaVersion/id/revision/currentTaskId/bases/sources/tasks를 선택했다. tasks 배열은 현재 task와 parent task만 선택하고 각 task의 id/sourceIds/parentTaskId/adviceRevision/mode/manual/intentEdit(존재할 때)를 원형 값으로 발췌했다. 다른 task와 나머지 task key는 생략했다. 나머지 top-level 키(예: name/draft/pending/notice 등)는 생략했다. 저장된 전체 snapshot에는 그대로 있다. 편의용 currentTask/activeBasis/retiredBasis라는 없는 필드를 추가하지 않았다. 아래 JSON은 공간 때문에 한 줄로 직렬화하되 값·배열 순서·원래 키는 유지한다.

원파일: P1-4-pre-request-project.json. 이 발췌에서 생략한 top-level 키: name, draft, answerDraft, basisDraft, basisEdits, draftKind, pending, notice. 선택 task의 advice/suggestions/handoffs/resultFile는 생략했다(실제 AI advice는 아래 회차별 response에 별도 인용).

```json
{"schemaVersion":"idea015.project.3","id":"P_f5e9aa63-6348-4729-9971-9970ad6ea7f7","revision":16,"currentTaskId":"T_40da14f6-e89e-4951-a572-262436e24f24","bases":[{"id":"D1","text":"가입한 고객만 예약을 취소할 수 있게 해줘.","status":"requested","sourceId":"S_76270a27-e13e-475d-8b35-64cc97203cb0","revision":4,"history":[]},{"id":"D2","text":"가입 여부와 로그인 검사를 없애고 비회원도 SMS 링크로 예약을 취소할 수 있게 바꿔. 환불은 이번 범위에서 제외해.","status":"requested","sourceId":"S_d4d70421-c757-4fb0-b6f1-ca8a3db042e5","revision":8,"history":[]},{"id":"D3","text":"취소 버튼 색만 빨강으로 바꿔줘.","status":"requested","sourceId":"S_c06aa8e4-a29a-4814-9ee1-de5248ed3864","revision":12,"history":[]},{"id":"D4","text":"SMS 문구만 짧게 해줘.","status":"requested","sourceId":"S_8d0e5a77-e492-4b1b-9e41-12ebbdf88f27","revision":16,"history":[]}],"sources":[{"id":"S_76270a27-e13e-475d-8b35-64cc97203cb0","kind":"request","text":"가입한 고객만 예약을 취소할 수 있게 해줘.","at":"2026-10-13T18:11:31.811Z","taskId":"T_069e3772-0266-4034-a8bd-130ada3565b5","replyTo":null,"disposition":"provided"},{"id":"S_d4d70421-c757-4fb0-b6f1-ca8a3db042e5","kind":"request","text":"가입 여부와 로그인 검사를 없애고 비회원도 SMS 링크로 예약을 취소할 수 있게 바꿔. 환불은 이번 범위에서 제외해.","at":"2026-10-13T18:11:35.516Z","taskId":"T_955bfd2b-3d03-4012-a93e-12203c8bf0cd","replyTo":null,"disposition":"provided"},{"id":"S_c06aa8e4-a29a-4814-9ee1-de5248ed3864","kind":"request","text":"취소 버튼 색만 빨강으로 바꿔줘.","at":"2026-10-13T18:11:39.702Z","taskId":"T_0e82fe2c-47b3-452a-946a-01921262d60d","replyTo":null,"disposition":"provided"},{"id":"S_8d0e5a77-e492-4b1b-9e41-12ebbdf88f27","kind":"request","text":"SMS 문구만 짧게 해줘.","at":"2026-10-13T18:11:43.239Z","taskId":"T_40da14f6-e89e-4951-a572-262436e24f24","replyTo":null,"disposition":"provided"}],"tasks":[{"id":"T_0e82fe2c-47b3-452a-946a-01921262d60d","sourceIds":["S_c06aa8e4-a29a-4814-9ee1-de5248ed3864"],"parentTaskId":"T_955bfd2b-3d03-4012-a93e-12203c8bf0cd","adviceRevision":12,"mode":"deepseek","manual":{"understanding":null,"scope":null,"next":null,"checks":null}},{"id":"T_40da14f6-e89e-4951-a572-262436e24f24","sourceIds":["S_8d0e5a77-e492-4b1b-9e41-12ebbdf88f27"],"parentTaskId":"T_0e82fe2c-47b3-452a-946a-01921262d60d","adviceRevision":null,"mode":null,"manual":{"understanding":null,"scope":null,"next":null,"checks":null}}]}
```

원파일: P2-2-pre-request-project.json. 이 발췌에서 생략한 top-level 키: name, draft, answerDraft, basisDraft, basisEdits, draftKind, pending, notice. 선택 task의 advice/suggestions/handoffs/resultFile는 생략했다(실제 AI advice는 아래 회차별 response에 별도 인용).

```json
{"schemaVersion":"idea015.project.3","id":"P_6bceb097-938c-4af2-b195-cefc771dcc7d","revision":7,"currentTaskId":"T_66f44b53-05a9-4f2a-ba9f-f4e836155e6d","bases":[{"id":"D1","text":"가입한 고객만 예약을 취소할 수 있게 해줘.","status":"requested","sourceId":"S_c4ddb398-c430-4c95-882e-0b07e3425377","revision":4,"history":[]},{"id":"D2","text":"링크는 SMS로만 보낸다","status":"confirmed","sourceId":"S_608e64f0-9bab-427f-979f-33590efd6d0b","revision":7,"history":[]}],"sources":[{"id":"S_c4ddb398-c430-4c95-882e-0b07e3425377","kind":"request","text":"가입한 고객만 예약을 취소할 수 있게 해줘.","at":"2026-10-13T18:11:45.872Z","taskId":"T_66f44b53-05a9-4f2a-ba9f-f4e836155e6d","replyTo":null,"disposition":"provided"},{"id":"S_608e64f0-9bab-427f-979f-33590efd6d0b","kind":"manual_decision","text":"링크는 SMS로만 보낸다","at":"2026-10-13T18:11:48.463Z","taskId":"T_66f44b53-05a9-4f2a-ba9f-f4e836155e6d","replyTo":null,"disposition":"provided"}],"tasks":[{"id":"T_66f44b53-05a9-4f2a-ba9f-f4e836155e6d","sourceIds":["S_c4ddb398-c430-4c95-882e-0b07e3425377","S_608e64f0-9bab-427f-979f-33590efd6d0b"],"parentTaskId":null,"adviceRevision":4,"mode":"deepseek","manual":{"understanding":null,"scope":null,"next":null,"checks":null},"intentEdit":{"version":"intent-edit.2","revision":6,"goal":"가입 여부와 로그인 검사 없이 비회원도 문자 링크로 예약 취소","conditions":"환불 제외"}}]}
```

전체 상태에서 P2의 intentEdit는 intent-edit.2, revision6이며 goal/conditions가 정확한 명시 정정이다. manual.* 작업 필드는 null을 유지하고 D1requested/history=[]도 남는다. recordBasis로 D2confirmed/history=[]가 추가된다. 앱에 없는 active/retired 상태를 심지 않았다.

## 4. 핵심 실제 HTTP context 요청

P1-4와 P2-2 request.json의 모든 top-level key와 배열을 아래에 원형 그대로 싣는다. **두 요청 내부 생략 없음.** ticket.taskId ↔ sources.taskId가 current task/text 관계다. 나머지 4요청 전문은 생략하되 원파일·지문을 남긴다.

### P1-4-request.json

```json
{
  "schemaVersion": "idea022.context.5",
  "ticket": {
    "projectId": "P_f5e9aa63-6348-4729-9971-9970ad6ea7f7",
    "revision": 16,
    "requestId": "R_39863e60-80f5-43d2-a60b-43cc87d3f34b",
    "taskId": "T_40da14f6-e89e-4951-a572-262436e24f24"
  },
  "projectName": "나의 프로젝트",
  "sources": [
    {
      "id": "S_c06aa8e4-a29a-4814-9ee1-de5248ed3864",
      "kind": "request",
      "text": "취소 버튼 색만 빨강으로 바꿔줘.",
      "at": "2026-10-13T18:11:39.702Z",
      "taskId": "T_0e82fe2c-47b3-452a-946a-01921262d60d",
      "replyTo": null,
      "disposition": "provided"
    },
    {
      "id": "S_8d0e5a77-e492-4b1b-9e41-12ebbdf88f27",
      "kind": "request",
      "text": "SMS 문구만 짧게 해줘.",
      "at": "2026-10-13T18:11:43.239Z",
      "taskId": "T_40da14f6-e89e-4951-a572-262436e24f24",
      "replyTo": null,
      "disposition": "provided"
    }
  ],
  "bases": [
    {
      "id": "D1",
      "text": "가입한 고객만 예약을 취소할 수 있게 해줘.",
      "status": "requested",
      "sourceId": "S_76270a27-e13e-475d-8b35-64cc97203cb0",
      "revision": 4,
      "previousVersions": 0,
      "partial": false
    },
    {
      "id": "D2",
      "text": "가입 여부와 로그인 검사를 없애고 비회원도 SMS 링크로 예약을 취소할 수 있게 바꿔. 환불은 이번 범위에서 제외해.",
      "status": "requested",
      "sourceId": "S_d4d70421-c757-4fb0-b6f1-ca8a3db042e5",
      "revision": 8,
      "previousVersions": 0,
      "partial": false
    },
    {
      "id": "D3",
      "text": "취소 버튼 색만 빨강으로 바꿔줘.",
      "status": "requested",
      "sourceId": "S_c06aa8e4-a29a-4814-9ee1-de5248ed3864",
      "revision": 12,
      "previousVersions": 0,
      "partial": false
    },
    {
      "id": "D4",
      "text": "SMS 문구만 짧게 해줘.",
      "status": "requested",
      "sourceId": "S_8d0e5a77-e492-4b1b-9e41-12ebbdf88f27",
      "revision": 16,
      "previousVersions": 0,
      "partial": false
    }
  ],
  "appFacts": {
    "taskId": "T_40da14f6-e89e-4951-a572-262436e24f24",
    "inputs": [
      {
        "sourceId": "S_8d0e5a77-e492-4b1b-9e41-12ebbdf88f27",
        "kind": "request"
      }
    ],
    "records": [
      {
        "basisId": "D4",
        "sourceId": "S_8d0e5a77-e492-4b1b-9e41-12ebbdf88f27",
        "revision": 16,
        "status": "requested",
        "versionIndex": 0,
        "isCurrent": true,
        "kind": "input-retained",
        "previousRevision": null,
        "changedFields": null
      }
    ]
  },
  "previousWork": {
    "taskId": "T_0e82fe2c-47b3-452a-946a-01921262d60d",
    "understanding": "이번 입력은 '취소 버튼 색만 빨강으로 바꿔줘'라는 자연어 요청이며, 직전 작업(비회원 SMS 링크 취소)과는 별개의 독립적인 UI 색상 변경 요청이다.",
    "scope": "취소 버튼의 색상만 빨강으로 변경한다. 버튼의 위치·문구·동작·취소 로직(비회원 SMS 링크, 로그인 검사 제거 등)과 환불 관련 코드는 이번 범위에서 건드리지 않는다. 직전 작업의 조건을 자동 상속하지 않는다.",
    "next": "취소 버튼이 정의된 UI 코드(스타일/컴포넌트/테마)를 찾아 현재 색상 지정 방식을 확인한 뒤, 그 버튼에만 빨강 색상을 적용하는 최소 수정을 한다. 수정 후 취소 버튼이 빨갛게 보이는지와 다른 버튼·요소의 색상이 바뀌지 않았는지 확인한다.",
    "checks": "취소 버튼의 색상이 빨강으로 표시되는지 확인한다. 다른 버튼이나 UI 요소의 색상이 함께 변경되지 않았는지 확인한다. 취소 버튼의 문구·동작·취소 처리 로직이 변경되지 않았는지 확인한다.",
    "aiTextExcluded": false,
    "manualConditionFields": []
  },
  "previousIntent": {
    "taskId": "T_0e82fe2c-47b3-452a-946a-01921262d60d",
    "value": {
      "version": "intent.1",
      "relation": "separate",
      "goal": "취소 버튼 색상을 빨강으로 바꾼다.",
      "conditions": [
        "색상 변경 대상은 취소 버튼으로 한정한다.",
        "취소 버튼의 문구·동작·취소 로직은 유지한다."
      ],
      "retired": [],
      "basisRefs": [
        {
          "basisId": "D3",
          "sourceId": "S_c06aa8e4-a29a-4814-9ee1-de5248ed3864",
          "revision": 12
        }
      ]
    },
    "manualGoal": null,
    "manualConditions": null
  }
}
```

### P2-2-request.json

```json
{
  "schemaVersion": "idea022.context.5",
  "ticket": {
    "projectId": "P_6bceb097-938c-4af2-b195-cefc771dcc7d",
    "revision": 7,
    "requestId": "R_30ee0b9f-0f87-44d9-949e-c8c0bcc31ae6",
    "taskId": "T_66f44b53-05a9-4f2a-ba9f-f4e836155e6d"
  },
  "projectName": "나의 프로젝트",
  "sources": [
    {
      "id": "S_c4ddb398-c430-4c95-882e-0b07e3425377",
      "kind": "request",
      "text": "가입한 고객만 예약을 취소할 수 있게 해줘.",
      "at": "2026-10-13T18:11:45.872Z",
      "taskId": "T_66f44b53-05a9-4f2a-ba9f-f4e836155e6d",
      "replyTo": null,
      "disposition": "provided"
    },
    {
      "id": "S_608e64f0-9bab-427f-979f-33590efd6d0b",
      "kind": "manual_decision",
      "text": "링크는 SMS로만 보낸다",
      "at": "2026-10-13T18:11:48.463Z",
      "taskId": "T_66f44b53-05a9-4f2a-ba9f-f4e836155e6d",
      "replyTo": null,
      "disposition": "provided"
    }
  ],
  "bases": [
    {
      "id": "D1",
      "text": "가입한 고객만 예약을 취소할 수 있게 해줘.",
      "status": "requested",
      "sourceId": "S_c4ddb398-c430-4c95-882e-0b07e3425377",
      "revision": 4,
      "previousVersions": 0,
      "partial": false
    },
    {
      "id": "D2",
      "text": "링크는 SMS로만 보낸다",
      "status": "confirmed",
      "sourceId": "S_608e64f0-9bab-427f-979f-33590efd6d0b",
      "revision": 7,
      "previousVersions": 0,
      "partial": false
    }
  ],
  "appFacts": {
    "taskId": "T_66f44b53-05a9-4f2a-ba9f-f4e836155e6d",
    "inputs": [
      {
        "sourceId": "S_c4ddb398-c430-4c95-882e-0b07e3425377",
        "kind": "request"
      },
      {
        "sourceId": "S_608e64f0-9bab-427f-979f-33590efd6d0b",
        "kind": "manual_decision"
      }
    ],
    "records": [
      {
        "basisId": "D1",
        "sourceId": "S_c4ddb398-c430-4c95-882e-0b07e3425377",
        "revision": 4,
        "status": "requested",
        "versionIndex": 0,
        "isCurrent": true,
        "kind": "input-retained",
        "previousRevision": null,
        "changedFields": null
      },
      {
        "basisId": "D2",
        "sourceId": "S_608e64f0-9bab-427f-979f-33590efd6d0b",
        "revision": 7,
        "status": "confirmed",
        "versionIndex": 0,
        "isCurrent": true,
        "kind": "basis-recorded",
        "previousRevision": null,
        "changedFields": null
      }
    ]
  },
  "previousWork": null,
  "previousIntent": {
    "taskId": "T_66f44b53-05a9-4f2a-ba9f-f4e836155e6d",
    "value": null,
    "manualGoal": "가입 여부와 로그인 검사 없이 비회원도 문자 링크로 예약 취소",
    "manualConditions": "환불 제외"
  }
}
```

P1-3 직전의 의존 맥락을 위해 P1-3-request.json의 previousIntent 전체만 추가한다. 이 발췌의 다른 top-level key/배열은 모두 생략했다. P1-2의 명시철회 해석이 있었으나 P1-3을 separate로 처리한 뒤 P1-4.previousIntent에서 retired=[]가 되는 흐름을 직접 대조할 수 있다.

```json
{
  "previousIntent": {
    "taskId": "T_955bfd2b-3d03-4012-a93e-12203c8bf0cd",
    "value": {
      "version": "intent.1",
      "relation": "revise",
      "goal": "비회원도 SMS 링크로 예약을 취소할 수 있게 한다.",
      "conditions": [
        "가입 여부·로그인 검사는 제거한다.",
        "예약 취소는 SMS 링크로 허용한다.",
        "환불은 이번 범위에서 제외한다.",
        "취소와 무관한 기존 기능은 유지한다."
      ],
      "retired": [
        "가입한 고객만 예약을 취소할 수 있게 해줘.",
        "가입한 고객만 예약을 취소할 수 있게 한다."
      ],
      "basisRefs": [
        {
          "basisId": "D1",
          "sourceId": "S_76270a27-e13e-475d-8b35-64cc97203cb0",
          "revision": 4
        },
        {
          "basisId": "D2",
          "sourceId": "S_d4d70421-c757-4fb0-b6f1-ca8a3db042e5",
          "revision": 8
        }
      ]
    },
    "manualGoal": null,
    "manualConditions": null
  }
}
```

원형 bases에는 requested/confirmed가 있으며 active/retired flag는 없다. intent.retired는 AI가 대체됐다고 해석한 문장 배열이다. source/basis의 status 변경·사용자 확정 철회·실코드 상태를 뜻하지 않는다. prestate bases.history=[]와 요청 previousVersions=0을 그대로 보존했다. P2-2.previousIntent.value=null이므로 요청에 AI retired 배열은 없고 직접 정정이 남는다. 응답이 정정 문장을 retired에 넣더라도 앱의 intentEdit 삭제가 관측된 것은 아니다.

## 5. 6회 실제 응답과 metadata

각 response.json의 advice에서 understanding/scope/next/checks/question/intent를 원형 선택했다. 원필드명은 question(단수)이다. 생략: response wrapper의 mode/ticket 및 relatedBasisIds/reviewBasisIds/suggestions. 모든 intent 배열은 그대로다. 현재 작업 의미를 intent 문구만으로 판정하지 않는다.

### P1-1-response.json

```json
{
  "understanding": "가입 고객만 예약 취소가 가능하도록 취소 권한을 제한하는 요청으로 이해한다.",
  "scope": "이번 범위는 예약 취소 권한에 대한 조건 추가다. 결제·알림 등 취소와 무관한 기능은 유지하고, 비회원·미가입자 처리 정책은 요청에 명시되지 않았으므로 임의로 확정하지 않는다.",
  "next": "예약 취소 처리 경로(핸들러/서비스)와 현재 인증 정보(로그인 세션·회원 식별)를 코드에서 확인한 뒤, 가입 고객만 통과하도록 최소 검증을 추가하고 비로그인 시 거부되도록 수정한다. 이후 기존 취소 흐름이 깨지지 않는지 확인한다.",
  "checks": "취소 요청 시 가입 고객은 기존대로 성공하고, 비로그인/미가입 상태 요청은 취소되지 않고 거부되는지 확인한다. 취소 권한 검증이 실제 코드 경로에 적용됐는지와 기존 정상 취소 흐름이 유지되는지 확인한다.",
  "question": null,
  "intent": {
    "version": "intent.1",
    "relation": "start",
    "goal": "가입한 고객만 예약을 취소할 수 있게 한다.",
    "conditions": [
      "예약 취소 권한은 가입 고객 여부로 제한한다.",
      "취소와 무관한 기존 기능은 유지한다."
    ],
    "retired": [],
    "basisRefs": [
      {
        "basisId": "D1",
        "sourceId": "S_76270a27-e13e-475d-8b35-64cc97203cb0",
        "revision": 4
      }
    ]
  }
}
```

### P1-2-response.json

```json
{
  "understanding": "직전 요청(가입 고객만 예약 취소)을 대체해, 가입 여부·로그인 검사를 제거하고 비회원이 SMS 링크로 예약을 취소할 수 있게 바꾸는 요청. 환불은 이번 범위에서 제외.",
  "scope": "이번 범위는 예약 취소 경로의 회원/로그인 검사 제거와 비회원 SMS 링크 기반 취소 허용으로 한정한다. 환불 처리는 제외하며, 취소와 무관한 결제·알림 등 기존 기능은 유지한다. 이미 완료된 가입고객 전용 제한이 있다면 이번 요청이 명시적으로 대체하는 부분만 변경한다.",
  "next": "예약 취소 처리 경로(핸들러/서비스)와 현재 인증 검사(로그인 세션·회원 식별), SMS 링크 발급/검증 로직 존재 여부를 코드에서 먼저 확인한다. 확인 결과를 기반으로 로그인·가입 검사를 제거하고 SMS 링크(토큰)로 취소를 허용하는 최소 수정을 적용한 뒤, 기존 정상 취소 흐름이 깨지지 않는지 확인한다. 환불 관련 코드·정책은 건드리지 않는다.",
  "checks": "취소 요청 시 비회원이 SMS 링크로 취소에 성공하는지, 로그인·가입 여부 검사가 실제 코드 경로에서 제거됐는지 확인한다. 기존(회원) 취소 흐름이 유지되는지와 환불 로직이 변경 범위에 포함되지 않았는지도 확인한다. SMS 링크 발급/검증 로직이 기존에 존재하는지 여부는 수정 전 확인 결과로 남긴다.",
  "question": null,
  "intent": {
    "version": "intent.1",
    "relation": "revise",
    "goal": "비회원도 SMS 링크로 예약을 취소할 수 있게 한다.",
    "conditions": [
      "가입 여부·로그인 검사는 제거한다.",
      "예약 취소는 SMS 링크로 허용한다.",
      "환불은 이번 범위에서 제외한다.",
      "취소와 무관한 기존 기능은 유지한다."
    ],
    "retired": [
      "가입한 고객만 예약을 취소할 수 있게 해줘.",
      "가입한 고객만 예약을 취소할 수 있게 한다."
    ],
    "basisRefs": [
      {
        "basisId": "D1",
        "sourceId": "S_76270a27-e13e-475d-8b35-64cc97203cb0",
        "revision": 4
      },
      {
        "basisId": "D2",
        "sourceId": "S_d4d70421-c757-4fb0-b6f1-ca8a3db042e5",
        "revision": 8
      }
    ]
  }
}
```

### P1-3-response.json

```json
{
  "understanding": "이번 입력은 '취소 버튼 색만 빨강으로 바꿔줘'라는 자연어 요청이며, 직전 작업(비회원 SMS 링크 취소)과는 별개의 독립적인 UI 색상 변경 요청이다.",
  "scope": "취소 버튼의 색상만 빨강으로 변경한다. 버튼의 위치·문구·동작·취소 로직(비회원 SMS 링크, 로그인 검사 제거 등)과 환불 관련 코드는 이번 범위에서 건드리지 않는다. 직전 작업의 조건을 자동 상속하지 않는다.",
  "next": "취소 버튼이 정의된 UI 코드(스타일/컴포넌트/테마)를 찾아 현재 색상 지정 방식을 확인한 뒤, 그 버튼에만 빨강 색상을 적용하는 최소 수정을 한다. 수정 후 취소 버튼이 빨갛게 보이는지와 다른 버튼·요소의 색상이 바뀌지 않았는지 확인한다.",
  "checks": "취소 버튼의 색상이 빨강으로 표시되는지 확인한다. 다른 버튼이나 UI 요소의 색상이 함께 변경되지 않았는지 확인한다. 취소 버튼의 문구·동작·취소 처리 로직이 변경되지 않았는지 확인한다.",
  "question": null,
  "intent": {
    "version": "intent.1",
    "relation": "separate",
    "goal": "취소 버튼 색상을 빨강으로 바꾼다.",
    "conditions": [
      "색상 변경 대상은 취소 버튼으로 한정한다.",
      "취소 버튼의 문구·동작·취소 로직은 유지한다."
    ],
    "retired": [],
    "basisRefs": [
      {
        "basisId": "D3",
        "sourceId": "S_c06aa8e4-a29a-4814-9ee1-de5248ed3864",
        "revision": 12
      }
    ]
  }
}
```

### P1-4-response.json

```json
{
  "understanding": "이번 입력은 'SMS 문구만 짧게 해줘'라는 요청이며, 직전 취소 버튼 색상 변경과는 독립된 SMS 문구 길이 조정이다.",
  "scope": "SMS 문구(내용)만 짧게 조정한다. 취소 버튼 색상(D3), 비회원 SMS 링크 취소 로직(D2), 가입 고객 제한(D1)은 이번 범위에서 변경하지 않는다.",
  "next": "SMS 문구가 정의된 위치(템플릿/상수/문자열 리소스)를 찾아 현재 문구 원문을 확인한 뒤, 의미를 유지하면서 길이만 줄이는 최소 수정을 한다. 수정 후 SMS 문구 외 다른 문자열·로직이 바뀌지 않았는지 확인한다.",
  "checks": "SMS 문구가 이전보다 짧아졌는지 확인한다. SMS 문구가 담긴 문자열 리소스 외 다른 문구·코드가 변경되지 않았는지 확인한다.",
  "question": null,
  "intent": {
    "version": "intent.1",
    "relation": "separate",
    "goal": "SMS 문구를 짧게 만든다.",
    "conditions": [
      "변경 대상은 SMS 문구로 한정한다.",
      "문구의 의미는 유지한다."
    ],
    "retired": [],
    "basisRefs": [
      {
        "basisId": "D4",
        "sourceId": "S_8d0e5a77-e492-4b1b-9e41-12ebbdf88f27",
        "revision": 16
      }
    ]
  }
}
```

### P2-1-response.json

```json
{
  "understanding": "가입 고객만 예약 취소가 가능하도록 취소 권한을 제한하는 요청이다.",
  "scope": "취소 기능의 접근 제한 구현. 결제·예약 생성 등 관련 없는 기능과 기존 예약 데이터 정책은 다루지 않는다.",
  "next": "취소 처리 코드 경로에서 현재 사용자(비회원/회원) 판별 근거를 확인하고, 비가입 사용자의 취소 시도 시 차단되도록 최소 수정한 뒤 가입/비가입 케이스별로 취소 동작을 확인한다.",
  "checks": "비가입 사용자 취소 시도가 거부되고, 가입 사용자는 기존대로 취소가 완료되는지 확인한다.",
  "question": null,
  "intent": {
    "version": "intent.1",
    "relation": "start",
    "goal": "가입한 고객만 예약을 취소할 수 있게 한다.",
    "conditions": [],
    "retired": [],
    "basisRefs": [
      {
        "basisId": "D1",
        "sourceId": "S_c4ddb398-c430-4c95-882e-0b07e3425377",
        "revision": 4
      }
    ]
  }
}
```

### P2-2-response.json

```json
{
  "understanding": "가입 고객만 예약 취소가 가능하도록 하고, 취소 링크는 SMS로만 발송한다.",
  "scope": "이번 범위: 예약 취소 권한을 가입 고객으로 제한, 취소 링크 SMS 발송. 제외: 비회원 취소 허용, 환불 처리, 링크의 다른 채널 발송.",
  "next": "예약 취소 처리 코드와 SMS 링크 발송 경로를 확인한다. 가입 여부·로그인 검사가 어디서 이뤄지는지, 비회원 요청이 현재 어떻게 처리되는지 읽고, 가입 고객만 취소 가능하도록 최소 수정한 뒤 SMS 링크 발송만 남기고 비회원 취소는 차단한다.",
  "checks": "가입 고객의 취소 요청이 정상 처리되는지, 비회원 취소 요청이 거부되는지, 취소 링크가 SMS로만 발송되는지 확인한다. 환불 로직은 변경되지 않았는지 확인한다.",
  "question": null,
  "intent": {
    "version": "intent.1",
    "relation": "revise",
    "goal": "가입 고객만 예약 취소가 가능하고, 취소 링크는 SMS로만 발송",
    "conditions": [
      "가입 여부·로그인 검사로 취소 권한 제한",
      "취소 링크는 SMS로만 발송"
    ],
    "retired": [
      "가입 여부와 로그인 검사 없이 비회원도 문자 링크로 예약 취소"
    ],
    "basisRefs": [
      {
        "basisId": "D1",
        "sourceId": "S_c4ddb398-c430-4c95-882e-0b07e3425377",
        "revision": 4
      },
      {
        "basisId": "D2",
        "sourceId": "S_608e64f0-9bab-427f-979f-33590efd6d0b",
        "revision": 7
      }
    ]
  }
}
```

실제 metadata 원형 값에서 provider response event(usage/model/finish/latency/전송응답 bytes), transport request bytes, product status/latency/context bytes를 선택했다. 원파일의 event.at timestamp와 event.call/event type은 표의 회차 연결로 생략하고, 나머지 event array를 복제하지 않았다. 단위는 bytes와 ms다. transport 32768/131072 상한은 제품 context131072와 구별한다.

| 회차 | model / provider HTTP / product HTTP / finish | request/response transport B | product latency ms | provider latency ms | context request/response B | 원형 usage |
|---|---|---|---:|---:|---|---|
| P1-1 | deepseek-flash / 200 / 200 / stop | 13157/1954 | 3698 | 3671 | 1138/1638 | {"prompt_tokens":3479,"completion_tokens":418,"total_tokens":3897,"prompt_tokens_details":{"cached_tokens":2816},"prompt_cache_hit_tokens":2816,"prompt_cache_miss_tokens":663} |
| P1-2 | deepseek-flash / 200 / 200 / stop | 15454/2783 | 4182 | 4176 | 3321/2444 | {"prompt_tokens":4201,"completion_tokens":690,"total_tokens":4891,"prompt_tokens_details":{"cached_tokens":2944},"prompt_cache_hit_tokens":2944,"prompt_cache_miss_tokens":1257} |
| P1-3 | deepseek-flash / 200 / 200 / stop | 16469/2072 | 3532 | 3526 | 4296/1756 | {"prompt_tokens":4543,"completion_tokens":482,"total_tokens":5025,"prompt_tokens_details":{"cached_tokens":2944},"prompt_cache_hit_tokens":2944,"prompt_cache_miss_tokens":1599} |
| P1-4 | deepseek-flash / 200 / 200 / stop | 15842/1734 | 2630 | 2624 | 3665/1418 | {"prompt_tokens":4379,"completion_tokens":382,"total_tokens":4761,"prompt_tokens_details":{"cached_tokens":2944},"prompt_cache_hit_tokens":2944,"prompt_cache_miss_tokens":1435} |
| P2-1 | deepseek-flash / 200 / 200 / stop | 13157/1496 | 2588 | 2583 | 1138/1184 | {"prompt_tokens":3498,"completion_tokens":286,"total_tokens":3784,"prompt_tokens_details":{"cached_tokens":2816},"prompt_cache_hit_tokens":2816,"prompt_cache_miss_tokens":682} |
| P2-2 | deepseek-flash / 200 / 200 / stop | 14141/2011 | 2981 | 2976 | 2026/1680 | {"prompt_tokens":3853,"completion_tokens":468,"total_tokens":4321,"prompt_tokens_details":{"cached_tokens":2816},"prompt_cache_hit_tokens":2816,"prompt_cache_miss_tokens":1037} |

## 6. 실제 handoff 핵심 구간

P1-2/P1-4/P2-2의 실제 handoff.txt에서 이어가는 목적과 이번 작업 구간을 제목부터 다음 같은 수준 제목 직전까지 원형 발췌했다. 다른 구간(전달 안내, Studio 기록, 과거작업, 관련 원문·기준, 결과 인계 안내)은 생략했다. P1-3의 handoff 전문은 원파일로 보존했고 current scope는 위 실제 응답과 일치한다.

### P1-2-handoff.txt

```text
## 이어가는 목적 · AI 해석 / 원문과 구분

비회원도 SMS 링크로 예약을 취소할 수 있게 한다.

유지할 조건: 가입 여부·로그인 검사는 제거한다. / 예약 취소는 SMS 링크로 허용한다. / 환불은 이번 범위에서 제외한다. / 취소와 무관한 기존 기능은 유지한다.

대체된 지시 · 다시 실행하지 않음 (AI 해석 · 이전 요청 원문의 표현에만 적용, 사용자 결정 기준은 대체하지 않음): 가입한 고객만 예약을 취소할 수 있게 해줘. / 가입한 고객만 예약을 취소할 수 있게 한다.

이번 작업의 크기는 아래 현재 요청이 정합니다. 목적 전체를 다시 구현하라는 지시가 아닙니다.

해석 근거: D1 r4 / S_76270a27-e13e-475d-8b35-64cc97203cb0, D2 r8 / S_d4d70421-c757-4fb0-b6f1-ca8a3db042e5
```

P1-2의 이번 작업 구간은 중복 인용을 줄이기 위해 생략했다. 위 실제 response의 understanding/scope/next/checks와 같은 문구이며 원 handoff.txt는 보존했다.

### P1-4-handoff.txt

```text
## 이어가는 목적 · AI 해석 / 원문과 구분

SMS 문구를 짧게 만든다.

유지할 조건: 변경 대상은 SMS 문구로 한정한다. / 문구의 의미는 유지한다.

이번 작업의 크기는 아래 현재 요청이 정합니다. 목적 전체를 다시 구현하라는 지시가 아닙니다.

해석 근거: D4 r16 / S_8d0e5a77-e492-4b1b-9e41-12ebbdf88f27
```

```text
## 이번 작업

이번 입력은 'SMS 문구만 짧게 해줘'라는 요청이며, 직전 취소 버튼 색상 변경과는 독립된 SMS 문구 길이 조정이다.


### 범위

SMS 문구(내용)만 짧게 조정한다. 취소 버튼 색상(D3), 비회원 SMS 링크 취소 로직(D2), 가입 고객 제한(D1)은 이번 범위에서 변경하지 않는다.


### 다음 작업 (AI/모의 제안 또는 사용자 직접 수정)

SMS 문구가 정의된 위치(템플릿/상수/문자열 리소스)를 찾아 현재 문구 원문을 확인한 뒤, 의미를 유지하면서 길이만 줄이는 최소 수정을 한다. 수정 후 SMS 문구 외 다른 문자열·로직이 바뀌지 않았는지 확인한다.


### 확인할 동작 (아직 검사 결과가 아님)

SMS 문구가 이전보다 짧아졌는지 확인한다. SMS 문구가 담긴 문자열 리소스 외 다른 문구·코드가 변경되지 않았는지 확인한다.
```

### P2-2-handoff.txt

```text
## 이어가는 목적 · 사용자 직접 정정

가입 여부와 로그인 검사 없이 비회원도 문자 링크로 예약 취소

유지할 조건: 환불 제외

이번 작업의 크기는 아래 현재 요청이 정합니다. 목적 전체를 다시 구현하라는 지시가 아닙니다.

정정 전 AI 해석 근거: D1 r4 / S_c4ddb398-c430-4c95-882e-0b07e3425377, D2 r7 / S_608e64f0-9bab-427f-979f-33590efd6d0b
```

```text
## 이번 작업

가입 고객만 예약 취소가 가능하도록 하고, 취소 링크는 SMS로만 발송한다.


### 범위

이번 범위: 예약 취소 권한을 가입 고객으로 제한, 취소 링크 SMS 발송. 제외: 비회원 취소 허용, 환불 처리, 링크의 다른 채널 발송.


### 다음 작업 (AI/모의 제안 또는 사용자 직접 수정)

예약 취소 처리 코드와 SMS 링크 발송 경로를 확인한다. 가입 여부·로그인 검사가 어디서 이뤄지는지, 비회원 요청이 현재 어떻게 처리되는지 읽고, 가입 고객만 취소 가능하도록 최소 수정한 뒤 SMS 링크 발송만 남기고 비회원 취소는 차단한다.


### 확인할 동작 (아직 검사 결과가 아님)

가입 고객의 취소 요청이 정상 처리되는지, 비회원 취소 요청이 거부되는지, 취소 링크가 SMS로만 발송되는지 확인한다. 환불 로직은 변경되지 않았는지 확인한다.
```

## 7. 고정 기준에 따른 판정 — 관측과 추론 분리

**Protocol 관측:** 6회 모두 실제 HTTP200, finish stop, 앱 계약 수용 및 handoff 생성. 영속 ledger의 슬롯6은 모두 provider200으로 확인됐고 local429·전송슬롯 재시도는 0이다. 소켓/인증/접근 실패는 없었다. 이는 의미 기준 합격과 별도다.

| 조건 | 판정 | 실제 근거 / 해석 |
|---|---|---|
| P1-2 로그인·가입검사 제거 / 비회원 SMS취소 / 환불 제외 | PASS | next/checks가 검사 제거·비회원 성공·환불 미변경을 구체 지시하고 handoff도 동일하다. |
| P1-3 색상작업 크기 | PASS | 취소 버튼만 빨강. scope가 비회원 SMS·로그인검사 제거 로직과 환불코드를 이번 범위에서 건드리지 않는다고 한다. |
| P1-3 연속 목적/조건 보존 | PARTIAL | 유지 행동은 적지만 separate로 분리하고 이어가는 목적·retired 맥락을 버린다. 이것만으로 실제 가입 로직 부활을 주장하지 않는다. |
| P1-4 문구작업 크기 | PASS | next는 의미를 유지한 SMS 문구 단축만 지시한다. 구현 범위를 전체취소로 확대하지 않았다. |
| P1-4 유효한 비회원·무로그인 조건의 일관성 | FAIL | scope/handoff가 비회원 취소(D2)와 명시철회된 가입고객 제한(D1)을 함께 ‘변경하지 않는다’고 적는다. 오래된 조건을 현행 유지 대상으로 읽게 하는 모순이다. 실제 코드 재도입 증거는 아니다. |
| P1-4 환불제외 | 현재 작업에는 명시 누락 | D2 원문과 handoff 기준에는 남지만 최종 scope/checks/목적은 환불제외를 명시하지 않는다. 원문 보존만으로 유효한 현재 지시까지 합격시키지 않는다. |
| P2-2 동시 전달 | PASS | value=null, 명시 manualGoal/conditions, D2confirmed SMS-only를 실제 요청·prestate에서 확인했다. D1을 편집/retire하지 않았다. |
| P2-2 SMS-only·환불 제외 | PASS | 실제 scope/checks/handoff에 반영된다. |
| P2-2 검사제거·비회원 취소 | FAIL | scope가 비회원 취소 허용을 제외하고 next가 비회원 취소 차단, checks가 비회원 거부를 요구한다. 표시 manual purpose와 실제 작업 지시가 반대다. |
| P2-2 직접 정정 취급 | FAIL | AI intent.retired에 명시된 사용자 직접 정정 문장을 넣었다. 앱 intentEdit와 표시 목적은 그대로여서 사용자 정정이 삭제됐다는 주장은 하지 않는다. |

두 프로젝트의 고정 의미 기준은 모두 전체 PASS가 아니다. P1은 명시철회 자체를 이해한 다음 작은 작업에서 현행/과거 조건 구분을 잃는 관측, P2는 명시 직접 정정과 원작업이 공존할 때 실제 작업을 원가입제한으로 되돌리는 관측이다. 비회원 취소 불허를 ‘입력 상충이므로 불명확’이라는 이유로 PASS 처리하지 않았다. P2 원입력과 D1requested의 공존은 의도된 시험 조건이며 숨겨서 정답 상태로 만들지 않았다.

**AI060와 구별:** AI060의 “가입이 번거로우니 SMS 링크…”와 “문자 링크로 예약 취소”에는 문자 그대로 가입/로그인 철회 문장이 없었다. AI067은 각각 정상 요청과 직접 정정에 그 철회 및 비회원 허용을 명시했다. AI060의 9응답/판정/모호함은 변경하지 않는다. 이번 명시 대조는 baseline의 추가 실패 증거이며 미래 수정 SHA 결과나 전체 모델 실패율을 뜻하지 않는다. 프롬프트·소스 튜닝, 틀린 응답 재생성, 추가 실제 호출은 하지 않았다.

## 8. 원파일 SHA-256와 보존 범위

기존 증거 경로에 위 전체 snapshot/요청/응답/metadata/operation/identity/handoff 원문이 있다. 아래는 인계 핵심 원파일의 UTF-8 또는 JSON bytes 지문이다. pending/post-response 및 중간 correctIntent/recordBasis 전체 상태는 원파일로 보존했고 문서에는 핵심만 선택했으며 그 전문/지문 표는 생략했다.

| 원파일 | SHA-256 |
|---|---|
| P1-1-pre-request-project.json | b59318cc0b604c35241da56d6eabeb907c6f5b6fdf0bf92342af812a0a914700 |
| P1-1-operations.json | 83ada266a9fe74f5bbe8f07279095a9c9f345e6a721c38d6cbb62a44704c992a |
| P1-1-request.json | 966cc4c883b5af9cd93c7d1eee18081a09d8dcc26b84a96744d6e4785f86b649 |
| P1-1-response.json | 5da1eb02a9fa6d6f63e761f578afd1b5820e89ee80d887df593b1b9d5a8ebd38 |
| P1-1-metadata.json | bf55c1bfd871090d3b5d815f12fa27b1ab0364d5b65ae1409363eb5e1b713ca6 |
| P1-1-handoff.txt | a2d9c5ad074f99e48dd20d9e9cbb10a4bb8a8a9ef112f17e1e59ca754f3a3586 |
| P1-2-pre-request-project.json | ab947f52d6d346655c0d3c5f1b77f22b1698d0eadd6482d059bd681329f9abea |
| P1-2-operations.json | c99f36c4eb217c6f9bb085ebe637bc783d01f0971cfb35dcb2c6101ac7192014 |
| P1-2-request.json | 71fd3f7a7a0a8b23e11feeb25e8cfa1f7073cfbeeb89d1b1c9522c7c8f3782f2 |
| P1-2-response.json | ac932254cade40bb039934c067587a5e3fc252778ff6a159859f1e98dc64c3c0 |
| P1-2-metadata.json | 50b4eed3ea7ea95613f96d4c0f0e2f89b2204c6a1e391b4afc4a913c7a5a4eb2 |
| P1-2-handoff.txt | 86312dc01071d8e47e623816233f31cbe4f4762e3b5b980ae3c3e53b2f528e3a |
| P1-3-pre-request-project.json | f66b25c4f962b93c8c5681c86c4a20c190833ba3e643536a21356b93548bb3d6 |
| P1-3-operations.json | d1fe19c5ba46dec198e2551b8e86555f7da22e5443d7b236c82ba8bc675a0686 |
| P1-3-request.json | 2e93817a41cbef3fd06f4a70be249b2db155d9c56d40e1a3f7ff8b5799e95c6c |
| P1-3-response.json | df742dad376e49a1c1f322d503915d0a9b06a9d0aba806077b9fe4c5b8ca87c6 |
| P1-3-metadata.json | d1f0ab62b38a3c76c4185df303323277dc29474804d6ad00fd3e83d75a595292 |
| P1-3-handoff.txt | 836f7309c87c72d4425b311cd5fcfc1069c7f8751b19a962a7929b499dce86df |
| P1-4-pre-request-project.json | c71c0fab03b2f9060100ce49447515acef488fb27070e10d4d25b00ab7446882 |
| P1-4-operations.json | 6de34ec3e068572c787238173b75d169a0f6a669db4c7caeef69391a83509085 |
| P1-4-request.json | 84968dc78d6b8cb41e35a436f1bf7ddaef78f287e6cf436db5c04844ff142fbe |
| P1-4-response.json | 8063a0d91b247e2157e4a6f950858a3aba0d0692fdc89d76f0344afb97b1856c |
| P1-4-metadata.json | 176e73536f713a3c6de872cfac80c85d47d230cf5a98ec3850220ab7ce1e847f |
| P1-4-handoff.txt | f171ed8f6c55a24cda8aa906b16e6c0f263a6becbd527ad8b03fe4a85de715b7 |
| P2-1-pre-request-project.json | 31cb0ed93f8dcdabd42b58044595a8fdab9e5cd6abfa881f9c11e526e884bf07 |
| P2-1-operations.json | 1274232a91154e826378e68226906f97845462d88aa0ac1292ba3f94566e1dcc |
| P2-1-request.json | b6dd5430182c4c68e282f56dcd86941a23f9fbbea700ce722fb3b36df2e9d019 |
| P2-1-response.json | 9e1b5626b4254f25282f22e026c4eab1153c9a255bb59a85999aa58cfab97c3e |
| P2-1-metadata.json | 33efc994819d8b816c5cfd532e26e92da5f42483f2e2105af8a1d11859b282bd |
| P2-1-handoff.txt | da3683f17d9d7cd2006c96447f6e1cffe2b4d362e75a53b270c39295fedc6891 |
| P2-2-pre-request-project.json | 8e76539da1703fed7acdbd8a1299787a0302b391a9e59be65c954d23c8e57afb |
| P2-2-operations.json | c38337e858eac682a6bcf73859e309a9587fe6989db0085b420dc4b32c28fd7e |
| P2-2-request.json | 6cf510827ca01423450ac6150114795043808b8a345e75c0b7cc5ab3b85f20a2 |
| P2-2-response.json | f7070cbd193c31e3608686aa7ed6947a3791e186f2d141b10f508ba887b50b6f |
| P2-2-metadata.json | 4ed8bcaef268816ffb9cd8331f9da3f3149dca933f720f2a098ce60f4cd97308 |
| P2-2-handoff.txt | 1c9550249a9ebc3c5306d468799cd0fe6a475065eda8ed1e5e7150eaf08bef22 |

미래 재사용의 원문은 scenario.json/run.mjs, 동결 지문은 frozen.json이다. 첫 source identity 및 전체 prestate가 별도로 있어 AI060처럼 준비 firstRequest를 실제요청으로 혼동하거나 전후 상태를 사후 재구성할 필요가 없다. 남은 일은 별도 수정 후보에서 동일 동결 fixture를 사용한 비교이며 이 baseline 문서에서 제품 수정은 하지 않는다.
