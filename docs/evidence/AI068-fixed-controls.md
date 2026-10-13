# AI068 — FIX066 exact 후보의 동일 고정 대조

이 문서는 후보 `baa94ae61c418c77187c0e63b93b79684d9f88c8`의 synthetic actual-model experiment이며 자동 수용·통합이 아니다. Sol 독립 delta 검토는 별도다. 부모 baseline `2750b58fdee710ff33a7e65f24c182c63f708577`, AI060/EVIDENCE066 및 AI067 자료는 보존하고 다시 실행·재생성하지 않았다. 사용자 문구·제품 operation·기준·모델·기본 limiter는 동일하다. 한 회차 한 표본, 두 사례의 제한된 관측이며 전체 품질·실사용자 효능·일반 실패율을 주장하지 않는다. P3의 원 AI060 발송 trigger·질문 결함은 이번 범위 밖이다.

## 1. 후보 code identity와 실행

| 항목 | 관측 |
|---|---|
| 후보 commit / branch | baa94ae61c418c77187c0e63b93b79684d9f88c8 / fix066/intent-action-consistency |
| 직접 parent | 2750b58fdee710ff33a7e65f24c182c63f708577 (Git metadata로 확인) |
| source snapshot | 별도 /workspace/work/ai068/source, 실행 관련42파일의 부분 snapshot; 완전한 checkout 아님 |
| 준비 무결성 | 42/42 exact 후보 Git blob 일치, 불일치0. 동일 blob은 검증된 baseline에서 재사용, 변경 runtime4파일은 exact blob에서 확보 |
| runtime / compiler | Node22.16.0 / 기존 TS5.8.3 재사용, 후보 build 성공; 전체 검사·설치 없음 |
| 실제 모델 / 설정 | deepseek-flash / thinking disabled / output4096 / timeout60000ms / temperature 미전송 |
| limiter / 실행 | 기본 rate6·process20 그대로, 순차 한 서버. 서버 재시작 우회0 |
| 실호출 상한 / 결과 | 최대6 / 실제6; provider2006·product2006·finish stop6 |
| retry / local429 | 이미 송신 슬롯 retry0 / local4290 / 응답 재생성0 |
| 새 계약 | 후보 제품 begin이 직접 생성한 idea022.context.6; purposeIntent 포함. 옛 JSON 손주입0 |

실제 경로는 후보 createContinuityApp({fetchImpl:protectedFetch}) → 실제 /api/continuity → 실제 모델이다. 기존 보호 adapter를 그대로 사용했다. 문서는 합성 앱 자료 및 필수 experiment metadata만 포함하며 민감 헤더·환경·인증·권한 전체 로그는 제외한다.

후보 runtime delta는 prompt.mjs, domain.ts, types.ts, validation.ts 네 파일이다. 이들은 후보 소스 그대로이며 평가 과정에서 수정하지 않았다. source-manifest.json은 모든 선택 파일의 Git blob identity를 보존한다. 나머지 후보 test/docs delta는 실행 snapshot에 추가하지 않았고 원격 후보 소스도 수정하지 않았다.

| 실행 전 동결 원문 | SHA-256 |
|---|---|
| 동일 scenario.json | 7fd87691dbd501cfb64e71f7619cd96424104d170092dad7a952296f41a2b76b |
| 원 AI067 run.mjs | 70f38137b6d68d4eab98f334f090de50d2d72409309bc441aa49b50e6447ac20 |
| 새 AI068 run.mjs | 3115a02fcfd6edc0347b720fce71c4991a668fb90c5dd800e2609a82d0a1adfe |
| runner 최소 diff | feb57cf1fa61170fef2c2b9f8adc0e3528949fa46689cca1db9432367feba661 |
| 기존 보호 adapter | df12c6971cbfd8f97f9c7964b6ef02e12f656355bcfcba98f49c12bdd0064ba0 |
| candidate source manifest | 2ab92ac798bd5cf0fd022fa0e9bdeeb3dd95cd50a3e6439a2eb59d128b3da9bf |
| exact 후보 prompt 원문 | 6f5f8676de0a59a7b28b73d76521ee5471a7454dbdd507a7e639ae50de741448 |

원 runner/scenario hash를 먼저 확인해 새 경로에 복사했다. 다음 diff만 적용하고 실행 전 새 runner hash를 확정했다. result 경로는 원 runner의 import.meta.url 기반 root 계산으로 자연히 ai068/test-results로 분리된다. 전체 request/pre/pending/post snapshot 수집은 원 runner 그대로여서 새 계약을 위한 field 주입이나 dispatch 변경이 없다. 사후 fixture/runner/source/prompt 수정은 없다.

### runner 원형 최소 diff

```diff
--- ai067/run.mjs
+++ ai068/run.mjs
@@ -5,8 +5,8 @@
 import {performance} from 'node:perf_hooks';
 import {createProtectedFetch} from '../ai060/connection/cloud-protected-fetch.mjs';
 const root=fileURLToPath(new URL('.',import.meta.url));
-const source=process.argv[2]??'/workspace/work/ai060/source';
-const sourceSHA=process.argv[3]??'2750b58fdee710ff33a7e65f24c182c63f708577';
+const source=process.argv[2]??'/workspace/work/ai068/source';
+const sourceSHA=process.argv[3]??'baa94ae61c418c77187c0e63b93b79684d9f88c8';
 const importSource=p=>import(pathToFileURL(path.join(source,p)).href);
 const D=await importSource('app/continuity/dist/public/shared/domain.js');
 const {createContinuityApp}=await importSource('app/continuity/server/app.mjs');
@@ -30,7 +30,7 @@
   const event={call:current?.id??null,at,...e,...(e.event==='provider_response'?{providerLatencyMs:Math.round(performance.now()-current.providerStarted)}:{})};
   ledger.events.push(event);saveLedger();
 }});
-const summary={experiment:'AI067 explicit controls',environment:'agentflow-studio-dev',sourceSHA,node:process.version,frozen,settings:{model:config.model,thinking:'disabled',maxTokens:config.maxTokens,timeoutMs:config.timeoutMs,temperature:'omitted',rate:config.rate,processCap:config.cap},calls:[],cases:[],httpResults:[]};
+const summary={experiment:'AI068 FIX066 candidate controls',environment:'agentflow-studio-dev',sourceSHA,node:process.version,frozen,settings:{model:config.model,thinking:'disabled',maxTokens:config.maxTokens,timeoutMs:config.timeoutMs,temperature:'omitted',rate:config.rate,processCap:config.cap},calls:[],cases:[],httpResults:[]};
 const trace=(operations,p,name,args,operation)=>{const before={revision:p.revision,taskId:p.currentTaskId};const n=operation(p);operations.push({operation:name,args,before,after:{revision:n.revision,taskId:n.currentTaskId}});return n;};
 const input=(p,text,operations)=>{
   p=trace(operations,p,'setKind',['request'],q=>D.setKind(q,'request'));
```

## 2. 변경 없이 재사용한 scenario 전체 원문

아래는 AI067 scenario.json 전체 원문이며 baselineSHA 값도 원문 보존 때문에 2750 그대로다. 실제 이번 실행 sourceSHA는 위 후보 SHA 및 run-summary.json에 별도로 기록됐다. 원문 크기2506B, 새 runner8731B. scenario의 기대 기준은 모델에 정답으로 별도 주입하지 않았다.

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

## 3. 각 회차 원입력·operation·상태 provenance

각 회차의 전체 pre-request Project, begin 후 pending state, receive 후 poststate, operation trace, 실제 HTTP context request/response, metadata/usage/model/finish/timing/bytes, source identity, handoff를 ai068/test-results에 생성 전용 원파일로 보존했다. 기존 자료 overwrite0. 아래 표는 실제 상태의 참조이며 상태를 사후 재구성하거나 D1을 runner가 retire/edit하지 않았다. 예약취소/SMS발송 등 외부 제품 구현은 실행하지 않았다.

| 회차 | 실제 현재 request 입력 / 정정 | prestate task / revision | 원형 basis 상태 | 정상 operation 순서 |
|---|---|---|---|---|
| P1-1 | 가입한 고객만 예약을 취소할 수 있게 해줘. | T_1c5b78da-9044-466c-915d-2999838124bb / r4 | D1 requested r4; history=[] | createProject → setKind → editDraft → submit → begin |
| P1-2 | 가입 여부와 로그인 검사를 없애고 비회원도 SMS 링크로 예약을 취소할 수 있게 바꿔. 환불은 이번 범위에서 제외해. | T_f374241c-9133-48f5-afda-cc7ec4334e2e / r8 | D1 requested r4; history=[]<br>D2 requested r8; history=[] | setKind → editDraft → submit → begin |
| P1-3 | 취소 버튼 색만 빨강으로 바꿔줘. | T_9a904133-8211-474c-afcd-78df3e31c1f7 / r12 | D1 requested r4; history=[]<br>D2 requested r8; history=[]<br>D3 requested r12; history=[] | setKind → editDraft → submit → begin |
| P1-4 | SMS 문구만 짧게 해줘. | T_374cc011-c38c-450d-b379-0bacf4076eb8 / r16 | D1 requested r4; history=[]<br>D2 requested r8; history=[]<br>D3 requested r12; history=[]<br>D4 requested r16; history=[] | setKind → editDraft → submit → begin |
| P2-1 | 가입한 고객만 예약을 취소할 수 있게 해줘. | T_d22549a2-08a3-41c7-8662-6a15378de116 / r4 | D1 requested r4; history=[] | createProject → setKind → editDraft → submit → begin |
| P2-2 | 가입한 고객만 예약을 취소할 수 있게 해줘.<br>같은 task goal: 가입 여부와 로그인 검사 없이 비회원도 문자 링크로 예약 취소; conditions: 환불 제외; confirmed: 링크는 SMS로만 보낸다 | T_d22549a2-08a3-41c7-8662-6a15378de116 / r7 | D1 requested r4; history=[]<br>D2 confirmed r7; history=[] | correctIntent → recordBasis → begin |

P2-2 operation trace 전체(생략 없음). 첫 task request/D1은 남겨 두고 목적 정정과 D2confirmed를 정상 operation으로 추가했다.

```json
[
  {
    "operation": "correctIntent",
    "args": [
      "T_d22549a2-08a3-41c7-8662-6a15378de116",
      "가입 여부와 로그인 검사 없이 비회원도 문자 링크로 예약 취소",
      "환불 제외"
    ],
    "before": {
      "revision": 5,
      "taskId": "T_d22549a2-08a3-41c7-8662-6a15378de116"
    },
    "after": {
      "revision": 6,
      "taskId": "T_d22549a2-08a3-41c7-8662-6a15378de116"
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
      "taskId": "T_d22549a2-08a3-41c7-8662-6a15378de116"
    },
    "after": {
      "revision": 7,
      "taskId": "T_d22549a2-08a3-41c7-8662-6a15378de116"
    }
  },
  {
    "operation": "begin",
    "args": [
      "T_d22549a2-08a3-41c7-8662-6a15378de116"
    ],
    "before": {
      "revision": 7,
      "taskId": "T_d22549a2-08a3-41c7-8662-6a15378de116"
    },
    "after": {
      "revision": 7,
      "taskId": "T_d22549a2-08a3-41c7-8662-6a15378de116"
    },
    "ticket": {
      "projectId": "P_714d1df2-8960-4783-8a58-35224d444c6f",
      "revision": 7,
      "requestId": "R_fd3121b8-e291-419c-b3c7-ee0d24a62299",
      "taskId": "T_d22549a2-08a3-41c7-8662-6a15378de116"
    }
  }
]
```

첫 요청별 source identity 원형 전체(P1-1/P2-1). 준비용 별도 firstRequest를 실제 송신으로 기록하지 않았다.

```json
[
  {
    "call": "P1-1",
    "projectId": "P_d788d2d8-3fb8-429b-9c76-3bef19ee77ff",
    "taskId": "T_1c5b78da-9044-466c-915d-2999838124bb",
    "requestId": "R_7f8f04b1-50c1-4aa3-ae83-fe6b0a594ffc",
    "sources": [
      {
        "id": "S_a610baf5-cbd0-4ca2-a8b8-6776d1559513",
        "taskId": "T_1c5b78da-9044-466c-915d-2999838124bb",
        "kind": "request",
        "at": "2026-10-13T18:30:51.691Z"
      }
    ]
  },
  {
    "call": "P2-1",
    "projectId": "P_714d1df2-8960-4783-8a58-35224d444c6f",
    "taskId": "T_d22549a2-08a3-41c7-8662-6a15378de116",
    "requestId": "R_c222462d-2968-43e7-839d-ba826777b538",
    "sources": [
      {
        "id": "S_f42218d4-d66c-4c87-8efb-1ce9673b9422",
        "taskId": "T_d22549a2-08a3-41c7-8662-6a15378de116",
        "kind": "request",
        "at": "2026-10-13T18:31:06.615Z"
      }
    ]
  }
]
```

### prestate 핵심 원형

아래 두 전체 snapshot에서 schemaVersion/id/revision/currentTaskId/bases/sources와 현재/parent task를 선택했다. task key는 id/sourceIds/parentTaskId/adviceRevision/mode/manual/intentEdit(존재할 때)를 원형 값으로 선택, advice/suggestions/handoffs/resultFile와 다른 task는 생략했다. 대응 advice는 아래 실제 응답으로 인용한다. 나머지 생략 root key는 각 원파일 옆에 명시한다. compact JSON은 문구·키·배열 순서를 유지한다. 없는 currentTask/activeBasis/retiredBasis flag를 만들지 않았다.

원파일 P1-4-pre-request-project.json; 생략 root keys: name, draft, answerDraft, basisDraft, basisEdits, draftKind, pending, notice.

```json
{"schemaVersion":"idea015.project.3","id":"P_d788d2d8-3fb8-429b-9c76-3bef19ee77ff","revision":16,"currentTaskId":"T_374cc011-c38c-450d-b379-0bacf4076eb8","bases":[{"id":"D1","text":"가입한 고객만 예약을 취소할 수 있게 해줘.","status":"requested","sourceId":"S_a610baf5-cbd0-4ca2-a8b8-6776d1559513","revision":4,"history":[]},{"id":"D2","text":"가입 여부와 로그인 검사를 없애고 비회원도 SMS 링크로 예약을 취소할 수 있게 바꿔. 환불은 이번 범위에서 제외해.","status":"requested","sourceId":"S_fd294a67-a926-4b44-9bdc-30a32848fa9a","revision":8,"history":[]},{"id":"D3","text":"취소 버튼 색만 빨강으로 바꿔줘.","status":"requested","sourceId":"S_ccba32ab-d145-4eb9-af37-34d0ff63dd5b","revision":12,"history":[]},{"id":"D4","text":"SMS 문구만 짧게 해줘.","status":"requested","sourceId":"S_faffbc9f-092e-4a16-90a6-a67376513cb2","revision":16,"history":[]}],"sources":[{"id":"S_a610baf5-cbd0-4ca2-a8b8-6776d1559513","kind":"request","text":"가입한 고객만 예약을 취소할 수 있게 해줘.","at":"2026-10-13T18:30:51.691Z","taskId":"T_1c5b78da-9044-466c-915d-2999838124bb","replyTo":null,"disposition":"provided"},{"id":"S_fd294a67-a926-4b44-9bdc-30a32848fa9a","kind":"request","text":"가입 여부와 로그인 검사를 없애고 비회원도 SMS 링크로 예약을 취소할 수 있게 바꿔. 환불은 이번 범위에서 제외해.","at":"2026-10-13T18:30:55.027Z","taskId":"T_f374241c-9133-48f5-afda-cc7ec4334e2e","replyTo":null,"disposition":"provided"},{"id":"S_ccba32ab-d145-4eb9-af37-34d0ff63dd5b","kind":"request","text":"취소 버튼 색만 빨강으로 바꿔줘.","at":"2026-10-13T18:30:59.270Z","taskId":"T_9a904133-8211-474c-afcd-78df3e31c1f7","replyTo":null,"disposition":"provided"},{"id":"S_faffbc9f-092e-4a16-90a6-a67376513cb2","kind":"request","text":"SMS 문구만 짧게 해줘.","at":"2026-10-13T18:31:02.801Z","taskId":"T_374cc011-c38c-450d-b379-0bacf4076eb8","replyTo":null,"disposition":"provided"}],"tasks":[{"id":"T_9a904133-8211-474c-afcd-78df3e31c1f7","sourceIds":["S_ccba32ab-d145-4eb9-af37-34d0ff63dd5b"],"parentTaskId":"T_f374241c-9133-48f5-afda-cc7ec4334e2e","adviceRevision":12,"mode":"deepseek","manual":{"understanding":null,"scope":null,"next":null,"checks":null}},{"id":"T_374cc011-c38c-450d-b379-0bacf4076eb8","sourceIds":["S_faffbc9f-092e-4a16-90a6-a67376513cb2"],"parentTaskId":"T_9a904133-8211-474c-afcd-78df3e31c1f7","adviceRevision":null,"mode":null,"manual":{"understanding":null,"scope":null,"next":null,"checks":null}}]}
```

원파일 P2-2-pre-request-project.json; 생략 root keys: name, draft, answerDraft, basisDraft, basisEdits, draftKind, pending, notice.

```json
{"schemaVersion":"idea015.project.3","id":"P_714d1df2-8960-4783-8a58-35224d444c6f","revision":7,"currentTaskId":"T_d22549a2-08a3-41c7-8662-6a15378de116","bases":[{"id":"D1","text":"가입한 고객만 예약을 취소할 수 있게 해줘.","status":"requested","sourceId":"S_f42218d4-d66c-4c87-8efb-1ce9673b9422","revision":4,"history":[]},{"id":"D2","text":"링크는 SMS로만 보낸다","status":"confirmed","sourceId":"S_f3b050d5-5095-4c23-b71d-198e91569fbc","revision":7,"history":[]}],"sources":[{"id":"S_f42218d4-d66c-4c87-8efb-1ce9673b9422","kind":"request","text":"가입한 고객만 예약을 취소할 수 있게 해줘.","at":"2026-10-13T18:31:06.615Z","taskId":"T_d22549a2-08a3-41c7-8662-6a15378de116","replyTo":null,"disposition":"provided"},{"id":"S_f3b050d5-5095-4c23-b71d-198e91569fbc","kind":"manual_decision","text":"링크는 SMS로만 보낸다","at":"2026-10-13T18:31:09.556Z","taskId":"T_d22549a2-08a3-41c7-8662-6a15378de116","replyTo":null,"disposition":"provided"}],"tasks":[{"id":"T_d22549a2-08a3-41c7-8662-6a15378de116","sourceIds":["S_f42218d4-d66c-4c87-8efb-1ce9673b9422","S_f3b050d5-5095-4c23-b71d-198e91569fbc"],"parentTaskId":null,"adviceRevision":4,"mode":"deepseek","manual":{"understanding":null,"scope":null,"next":null,"checks":null},"intentEdit":{"version":"intent-edit.2","revision":6,"goal":"가입 여부와 로그인 검사 없이 비회원도 문자 링크로 예약 취소","conditions":"환불 제외"}}]}
```

D1은 두 프로젝트에서 requested/history=[]로 보존됐고 D2는 P1의 명시 작업 요청(requested) 또는 P2의 confirmed SMS-only다. 후보가 실제 바꾼 것은 context projection/목적 해석과 handoff 표시다. stored basis를 임의 retire한 상태는 없다. appFacts의 isCurrent는 기록 버전 표시이며 의미상 active 요구라는 flag로 재명명하지 않았다.

## 4. 후보 제품이 직접 생성한 context.6 요청

P1-3/P1-4/P2-2 request.json 전체를 그대로 pretty-print한다. **이 세 JSON 내부 생략 key/배열 없음.** 나머지 세 요청 전문은 생략하되 원파일·hash를 보존했다. ticket.taskId ↔ sources.taskId가 current task/text 관계다. purposeIntent는 후보 begin이 생성한 실제 필드이며 수동 입력이 아니다.

### P1-3-request.json

```json
{
  "schemaVersion": "idea022.context.6",
  "ticket": {
    "projectId": "P_d788d2d8-3fb8-429b-9c76-3bef19ee77ff",
    "revision": 12,
    "requestId": "R_d15286ba-c7f1-429b-b45c-eaa7a63d87ab",
    "taskId": "T_9a904133-8211-474c-afcd-78df3e31c1f7"
  },
  "projectName": "나의 프로젝트",
  "sources": [
    {
      "id": "S_fd294a67-a926-4b44-9bdc-30a32848fa9a",
      "kind": "request",
      "text": "가입 여부와 로그인 검사를 없애고 비회원도 SMS 링크로 예약을 취소할 수 있게 바꿔. 환불은 이번 범위에서 제외해.",
      "at": "2026-10-13T18:30:55.027Z",
      "taskId": "T_f374241c-9133-48f5-afda-cc7ec4334e2e",
      "replyTo": null,
      "disposition": "provided"
    },
    {
      "id": "S_ccba32ab-d145-4eb9-af37-34d0ff63dd5b",
      "kind": "request",
      "text": "취소 버튼 색만 빨강으로 바꿔줘.",
      "at": "2026-10-13T18:30:59.270Z",
      "taskId": "T_9a904133-8211-474c-afcd-78df3e31c1f7",
      "replyTo": null,
      "disposition": "provided"
    }
  ],
  "bases": [
    {
      "id": "D1",
      "text": "가입한 고객만 예약을 취소할 수 있게 해줘.",
      "status": "requested",
      "sourceId": "S_a610baf5-cbd0-4ca2-a8b8-6776d1559513",
      "revision": 4,
      "previousVersions": 0,
      "partial": false
    },
    {
      "id": "D2",
      "text": "가입 여부와 로그인 검사를 없애고 비회원도 SMS 링크로 예약을 취소할 수 있게 바꿔. 환불은 이번 범위에서 제외해.",
      "status": "requested",
      "sourceId": "S_fd294a67-a926-4b44-9bdc-30a32848fa9a",
      "revision": 8,
      "previousVersions": 0,
      "partial": false
    },
    {
      "id": "D3",
      "text": "취소 버튼 색만 빨강으로 바꿔줘.",
      "status": "requested",
      "sourceId": "S_ccba32ab-d145-4eb9-af37-34d0ff63dd5b",
      "revision": 12,
      "previousVersions": 0,
      "partial": false
    }
  ],
  "appFacts": {
    "taskId": "T_9a904133-8211-474c-afcd-78df3e31c1f7",
    "inputs": [
      {
        "sourceId": "S_ccba32ab-d145-4eb9-af37-34d0ff63dd5b",
        "kind": "request"
      }
    ],
    "records": [
      {
        "basisId": "D3",
        "sourceId": "S_ccba32ab-d145-4eb9-af37-34d0ff63dd5b",
        "revision": 12,
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
    "taskId": "T_f374241c-9133-48f5-afda-cc7ec4334e2e",
    "understanding": "이전 요청(가입 고객만 취소)을 뒤집어, 가입·로그인 검사를 제거하고 비회원도 SMS 링크로 예약 취소가 가능하도록 바꾸는 요청으로 이해했다. 환불은 범위에서 제외한다.",
    "scope": "이번 범위는 예약 취소 경로에서 가입 여부·로그인 검사를 제거하고 SMS 링크 기반 비회원 취소를 허용하는 최소 수정이다. 환불 처리는 포함하지 않는다. 취소 외 다른 예약 기능(생성·조회·변경)과 SMS 발송 인프라 자체의 신규 구축은 다루지 않는다.",
    "next": "예약 취소를 처리하는 코드(핸들러/서비스/쿼리)에서 현재 가입 여부·로그인 검사 위치와 SMS 링크 진입 경로(토큰/파라미터)가 이미 존재하는지 확인한다. 확인 결과에 따라 해당 검사를 제거하고 SMS 링크로 들어온 비회원 요청이 취소를 수행하도록 최소 수정한 뒤, 관련 테스트를 실행한다. SMS 링크 검증 방식이 코드에 없으면 임의로 만들지 말고 현재 구조와 함께 보고한다.",
    "checks": "비회원이 SMS 링크로 취소에 성공하는지, 가입 여부·로그인 검사가 취소 경로에서 제거되었는지, 기존 가입 고객 취소도 그대로 동작하는지, 환불 로직이 이번 변경에 포함되지 않았는지, 관련 테스트 통과 여부와 수정 전후 코드 위치를 기록한다. SMS 링크 진입·검증 방식이 기존 코드에 있었는지 여부도 함께 기록한다.",
    "aiTextExcluded": false,
    "manualConditionFields": []
  },
  "previousIntent": {
    "taskId": "T_f374241c-9133-48f5-afda-cc7ec4334e2e",
    "value": {
      "version": "intent.1",
      "relation": "revise",
      "goal": "비회원도 SMS 링크로 예약을 취소할 수 있게 한다.",
      "conditions": [
        "환불은 이번 범위에서 제외한다.",
        "기존 가입 고객의 정상 취소 동작은 유지한다."
      ],
      "retired": [
        "가입한 고객만 예약을 취소할 수 있게 한다.",
        "가입 여부와 로그인 검사로 취소 권한을 제한한다."
      ],
      "basisRefs": [
        {
          "basisId": "D1",
          "sourceId": "S_a610baf5-cbd0-4ca2-a8b8-6776d1559513",
          "revision": 4
        },
        {
          "basisId": "D2",
          "sourceId": "S_fd294a67-a926-4b44-9bdc-30a32848fa9a",
          "revision": 8
        }
      ]
    },
    "manualGoal": null,
    "manualConditions": null
  },
  "purposeIntent": null
}
```

### P1-4-request.json

```json
{
  "schemaVersion": "idea022.context.6",
  "ticket": {
    "projectId": "P_d788d2d8-3fb8-429b-9c76-3bef19ee77ff",
    "revision": 16,
    "requestId": "R_023f1ad1-8b4a-43e9-bc58-ecd73a19317a",
    "taskId": "T_374cc011-c38c-450d-b379-0bacf4076eb8"
  },
  "projectName": "나의 프로젝트",
  "sources": [
    {
      "id": "S_ccba32ab-d145-4eb9-af37-34d0ff63dd5b",
      "kind": "request",
      "text": "취소 버튼 색만 빨강으로 바꿔줘.",
      "at": "2026-10-13T18:30:59.270Z",
      "taskId": "T_9a904133-8211-474c-afcd-78df3e31c1f7",
      "replyTo": null,
      "disposition": "provided"
    },
    {
      "id": "S_faffbc9f-092e-4a16-90a6-a67376513cb2",
      "kind": "request",
      "text": "SMS 문구만 짧게 해줘.",
      "at": "2026-10-13T18:31:02.801Z",
      "taskId": "T_374cc011-c38c-450d-b379-0bacf4076eb8",
      "replyTo": null,
      "disposition": "provided"
    }
  ],
  "bases": [
    {
      "id": "D1",
      "text": "가입한 고객만 예약을 취소할 수 있게 해줘.",
      "status": "requested",
      "sourceId": "S_a610baf5-cbd0-4ca2-a8b8-6776d1559513",
      "revision": 4,
      "previousVersions": 0,
      "partial": false
    },
    {
      "id": "D2",
      "text": "가입 여부와 로그인 검사를 없애고 비회원도 SMS 링크로 예약을 취소할 수 있게 바꿔. 환불은 이번 범위에서 제외해.",
      "status": "requested",
      "sourceId": "S_fd294a67-a926-4b44-9bdc-30a32848fa9a",
      "revision": 8,
      "previousVersions": 0,
      "partial": false
    },
    {
      "id": "D3",
      "text": "취소 버튼 색만 빨강으로 바꿔줘.",
      "status": "requested",
      "sourceId": "S_ccba32ab-d145-4eb9-af37-34d0ff63dd5b",
      "revision": 12,
      "previousVersions": 0,
      "partial": false
    },
    {
      "id": "D4",
      "text": "SMS 문구만 짧게 해줘.",
      "status": "requested",
      "sourceId": "S_faffbc9f-092e-4a16-90a6-a67376513cb2",
      "revision": 16,
      "previousVersions": 0,
      "partial": false
    }
  ],
  "appFacts": {
    "taskId": "T_374cc011-c38c-450d-b379-0bacf4076eb8",
    "inputs": [
      {
        "sourceId": "S_faffbc9f-092e-4a16-90a6-a67376513cb2",
        "kind": "request"
      }
    ],
    "records": [
      {
        "basisId": "D4",
        "sourceId": "S_faffbc9f-092e-4a16-90a6-a67376513cb2",
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
    "taskId": "T_9a904133-8211-474c-afcd-78df3e31c1f7",
    "understanding": "이번 요청은 취소 버튼 색만 빨강으로 바꾸는 순수 UI 색상 변경이다. 앞선 비회원 SMS 취소 작업과는 독립된 목적에 가깝다.",
    "scope": "취소 버튼의 색상(빨강)만 다룬다. 취소 로직·권한 검사·SMS 링크·환불·문구·버튼 동작은 건드리지 않는다. 앞선 비회원 취소 요청의 조건(환불 제외, 기존 가입 고객 동작 유지)은 이번 색상 변경에 적용하지 않는다.",
    "next": "취소 버튼을 렌더링하는 코드/스타일에서 현재 색상 지정 위치를 찾아 빨강으로 최소 수정한다. 취소 버튼이 여러 곳(목록/상세/확인 다이얼로그)에 있으면 실제 취소에 해당하는 대상들을 확인해 함께 처리하고, 그 외 버튼은 건드리지 않는다.",
    "checks": "취소 버튼이 빨강으로 표시되는지, 다른 버튼 색·동작·문구가 바뀌지 않았는지, 수정 전후 코드 위치를 기록한다.",
    "aiTextExcluded": false,
    "manualConditionFields": []
  },
  "previousIntent": {
    "taskId": "T_9a904133-8211-474c-afcd-78df3e31c1f7",
    "value": {
      "version": "intent.1",
      "relation": "separate",
      "goal": "예약 취소 버튼의 색을 빨강으로 바꾼다.",
      "conditions": [
        "이번 변경은 버튼 색상만 대상으로 한다."
      ],
      "retired": [],
      "basisRefs": [
        {
          "basisId": "D3",
          "sourceId": "S_ccba32ab-d145-4eb9-af37-34d0ff63dd5b",
          "revision": 12
        }
      ]
    },
    "manualGoal": null,
    "manualConditions": null
  },
  "purposeIntent": {
    "taskId": "T_f374241c-9133-48f5-afda-cc7ec4334e2e",
    "value": {
      "version": "intent.1",
      "relation": "revise",
      "goal": "비회원도 SMS 링크로 예약을 취소할 수 있게 한다.",
      "conditions": [
        "환불은 이번 범위에서 제외한다.",
        "기존 가입 고객의 정상 취소 동작은 유지한다."
      ],
      "retired": [
        "가입한 고객만 예약을 취소할 수 있게 한다.",
        "가입 여부와 로그인 검사로 취소 권한을 제한한다."
      ],
      "basisRefs": [
        {
          "basisId": "D1",
          "sourceId": "S_a610baf5-cbd0-4ca2-a8b8-6776d1559513",
          "revision": 4
        },
        {
          "basisId": "D2",
          "sourceId": "S_fd294a67-a926-4b44-9bdc-30a32848fa9a",
          "revision": 8
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
  "schemaVersion": "idea022.context.6",
  "ticket": {
    "projectId": "P_714d1df2-8960-4783-8a58-35224d444c6f",
    "revision": 7,
    "requestId": "R_fd3121b8-e291-419c-b3c7-ee0d24a62299",
    "taskId": "T_d22549a2-08a3-41c7-8662-6a15378de116"
  },
  "projectName": "나의 프로젝트",
  "sources": [
    {
      "id": "S_f42218d4-d66c-4c87-8efb-1ce9673b9422",
      "kind": "request",
      "text": "가입한 고객만 예약을 취소할 수 있게 해줘.",
      "at": "2026-10-13T18:31:06.615Z",
      "taskId": "T_d22549a2-08a3-41c7-8662-6a15378de116",
      "replyTo": null,
      "disposition": "provided"
    },
    {
      "id": "S_f3b050d5-5095-4c23-b71d-198e91569fbc",
      "kind": "manual_decision",
      "text": "링크는 SMS로만 보낸다",
      "at": "2026-10-13T18:31:09.556Z",
      "taskId": "T_d22549a2-08a3-41c7-8662-6a15378de116",
      "replyTo": null,
      "disposition": "provided"
    }
  ],
  "bases": [
    {
      "id": "D1",
      "text": "가입한 고객만 예약을 취소할 수 있게 해줘.",
      "status": "requested",
      "sourceId": "S_f42218d4-d66c-4c87-8efb-1ce9673b9422",
      "revision": 4,
      "previousVersions": 0,
      "partial": false
    },
    {
      "id": "D2",
      "text": "링크는 SMS로만 보낸다",
      "status": "confirmed",
      "sourceId": "S_f3b050d5-5095-4c23-b71d-198e91569fbc",
      "revision": 7,
      "previousVersions": 0,
      "partial": false
    }
  ],
  "appFacts": {
    "taskId": "T_d22549a2-08a3-41c7-8662-6a15378de116",
    "inputs": [
      {
        "sourceId": "S_f42218d4-d66c-4c87-8efb-1ce9673b9422",
        "kind": "request"
      },
      {
        "sourceId": "S_f3b050d5-5095-4c23-b71d-198e91569fbc",
        "kind": "manual_decision"
      }
    ],
    "records": [
      {
        "basisId": "D1",
        "sourceId": "S_f42218d4-d66c-4c87-8efb-1ce9673b9422",
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
        "sourceId": "S_f3b050d5-5095-4c23-b71d-198e91569fbc",
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
    "taskId": "T_d22549a2-08a3-41c7-8662-6a15378de116",
    "value": null,
    "manualGoal": "가입 여부와 로그인 검사 없이 비회원도 문자 링크로 예약 취소",
    "manualConditions": "환불 제외"
  },
  "purposeIntent": null
}
```

**계약 차이 관측:** AI067은 context.5이며 purposeIntent 필드 자체가 없었다. 후보는 모든 요청이 context.6이며 P1-4의 previousIntent는 버튼 별도작업, purposeIntent는 P1-2의 비회원 취소 목적/환불제외/가입제한 retired를 전달한다. P2-2에서는 previousIntent.value=null에 명시 manualGoal/manualConditions가 있고 purposeIntent=null이며, 최초 D1과 confirmed D2가 그대로 공존한다. history=[]/previousVersions=0/partial=false와 출처 ID를 원형 보존했다. retired 배열은 AI 해석 문장이고 basis 삭제·사용자 결정 철회·실코드 상태가 아니다.

## 5. 실제 모델 응답 원형

각 response.json의 envelope.advice에서 understanding/scope/next/checks/question/intent를 원형 선택했다. 원필드명은 단수 question. 생략: wrapper.mode/ticket, relatedBasisIds/reviewBasisIds/suggestions. intent 내부 배열은 모두 원형이다. 초기 두 응답도 포함해 총6응답이며 응답을 다시 만들지 않았다.

### P1-1-response.json

```json
{
  "understanding": "가입 고객만 예약 취소가 가능하도록 제한하는 수정 요청으로 이해했다.",
  "scope": "이번 범위는 예약 취소 권한을 가입 고객으로 제한하는 최소 수정이다. 취소 외 다른 예약 기능(생성·조회·변경)은 건드리지 않는다.",
  "next": "예약 취소를 처리하는 코드(핸들러/서비스/쿼리)를 찾아 현재 취소 가능 조건과 로그인·가입 여부 확인 방식을 파악한 뒤, 가입(로그인) 고객이 아니면 취소가 거부되도록 최소 수정하고 관련 테스트를 실행한다.",
  "checks": "취소 엔드포인트에서 비로그인 또는 비가입 사용자의 취소 시도가 거부되는지, 가입 고객의 정상 취소는 그대로 동작하는지, 기존 취소 관련 테스트가 통과하는지 확인한다. 수정 전후 취소 처리 코드 위치와 조건도 함께 기록한다.",
  "question": null,
  "intent": {
    "version": "intent.1",
    "relation": "start",
    "goal": "가입 고객만 예약을 취소할 수 있게 한다.",
    "conditions": [
      "예약 취소에 대한 접근 제한만 다룬다.",
      "가입 고객의 정상 취소 동작은 유지한다."
    ],
    "retired": [],
    "basisRefs": [
      {
        "basisId": "D1",
        "sourceId": "S_a610baf5-cbd0-4ca2-a8b8-6776d1559513",
        "revision": 4
      }
    ]
  }
}
```

### P1-2-response.json

```json
{
  "understanding": "이전 요청(가입 고객만 취소)을 뒤집어, 가입·로그인 검사를 제거하고 비회원도 SMS 링크로 예약 취소가 가능하도록 바꾸는 요청으로 이해했다. 환불은 범위에서 제외한다.",
  "scope": "이번 범위는 예약 취소 경로에서 가입 여부·로그인 검사를 제거하고 SMS 링크 기반 비회원 취소를 허용하는 최소 수정이다. 환불 처리는 포함하지 않는다. 취소 외 다른 예약 기능(생성·조회·변경)과 SMS 발송 인프라 자체의 신규 구축은 다루지 않는다.",
  "next": "예약 취소를 처리하는 코드(핸들러/서비스/쿼리)에서 현재 가입 여부·로그인 검사 위치와 SMS 링크 진입 경로(토큰/파라미터)가 이미 존재하는지 확인한다. 확인 결과에 따라 해당 검사를 제거하고 SMS 링크로 들어온 비회원 요청이 취소를 수행하도록 최소 수정한 뒤, 관련 테스트를 실행한다. SMS 링크 검증 방식이 코드에 없으면 임의로 만들지 말고 현재 구조와 함께 보고한다.",
  "checks": "비회원이 SMS 링크로 취소에 성공하는지, 가입 여부·로그인 검사가 취소 경로에서 제거되었는지, 기존 가입 고객 취소도 그대로 동작하는지, 환불 로직이 이번 변경에 포함되지 않았는지, 관련 테스트 통과 여부와 수정 전후 코드 위치를 기록한다. SMS 링크 진입·검증 방식이 기존 코드에 있었는지 여부도 함께 기록한다.",
  "question": null,
  "intent": {
    "version": "intent.1",
    "relation": "revise",
    "goal": "비회원도 SMS 링크로 예약을 취소할 수 있게 한다.",
    "conditions": [
      "환불은 이번 범위에서 제외한다.",
      "기존 가입 고객의 정상 취소 동작은 유지한다."
    ],
    "retired": [
      "가입한 고객만 예약을 취소할 수 있게 한다.",
      "가입 여부와 로그인 검사로 취소 권한을 제한한다."
    ],
    "basisRefs": [
      {
        "basisId": "D1",
        "sourceId": "S_a610baf5-cbd0-4ca2-a8b8-6776d1559513",
        "revision": 4
      },
      {
        "basisId": "D2",
        "sourceId": "S_fd294a67-a926-4b44-9bdc-30a32848fa9a",
        "revision": 8
      }
    ]
  }
}
```

### P1-3-response.json

```json
{
  "understanding": "이번 요청은 취소 버튼 색만 빨강으로 바꾸는 순수 UI 색상 변경이다. 앞선 비회원 SMS 취소 작업과는 독립된 목적에 가깝다.",
  "scope": "취소 버튼의 색상(빨강)만 다룬다. 취소 로직·권한 검사·SMS 링크·환불·문구·버튼 동작은 건드리지 않는다. 앞선 비회원 취소 요청의 조건(환불 제외, 기존 가입 고객 동작 유지)은 이번 색상 변경에 적용하지 않는다.",
  "next": "취소 버튼을 렌더링하는 코드/스타일에서 현재 색상 지정 위치를 찾아 빨강으로 최소 수정한다. 취소 버튼이 여러 곳(목록/상세/확인 다이얼로그)에 있으면 실제 취소에 해당하는 대상들을 확인해 함께 처리하고, 그 외 버튼은 건드리지 않는다.",
  "checks": "취소 버튼이 빨강으로 표시되는지, 다른 버튼 색·동작·문구가 바뀌지 않았는지, 수정 전후 코드 위치를 기록한다.",
  "question": null,
  "intent": {
    "version": "intent.1",
    "relation": "separate",
    "goal": "예약 취소 버튼의 색을 빨강으로 바꾼다.",
    "conditions": [
      "이번 변경은 버튼 색상만 대상으로 한다."
    ],
    "retired": [],
    "basisRefs": [
      {
        "basisId": "D3",
        "sourceId": "S_ccba32ab-d145-4eb9-af37-34d0ff63dd5b",
        "revision": 12
      }
    ]
  }
}
```

### P1-4-response.json

```json
{
  "understanding": "이번 요청은 SMS 문구만 짧게 바꾸는 독립적인 문구 수정이다. 직전 작업(취소 버튼 색)과 앞선 비회원 취소 목적과는 무관하다.",
  "scope": "SMS 문구의 길이만 짧게 조정한다. 취소 로직·권한·SMS 링크 동작·버튼 색·환불 범위는 건드리지 않는다. 앞선 비회원 취소/버튼 색 조건은 이번 문구 작업에 적용하지 않는다.",
  "next": "SMS 문구를 생성/송신하는 코드나 템플릿에서 현재 문구 위치를 찾아, 의미를 유지한 채 더 짧은 문구로 최소 수정한다. 문구가 여러 종류(안내/확인/완료 등)면 실제 예약 취소 SMS에 해당하는 대상만 처리하고, 대상이 여러 개면 각각 짧게 조정한다.",
  "checks": "수정된 SMS 문구가 원래 의미(예약 취소 안내)를 유지하면서 더 짧아졌는지, 문구 외 로직·링크·버튼·색상이 바뀌지 않았는지, 수정 전후 문구와 위치를 기록한다.",
  "question": null,
  "intent": {
    "version": "intent.1",
    "relation": "separate",
    "goal": "SMS 문구를 더 짧게 만든다.",
    "conditions": [
      "이번 변경은 SMS 문구만 대상으로 한다.",
      "취소 로직·권한·링크 동작은 유지한다."
    ],
    "retired": [],
    "basisRefs": [
      {
        "basisId": "D4",
        "sourceId": "S_faffbc9f-092e-4a16-90a6-a67376513cb2",
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
  "scope": "예약 취소 기능의 접근 제한만 다룬다. 예약 생성·조회, 회원가입/로그인 자체 개선은 이번 범위가 아니다.",
  "next": "예약 취소 처리 코드와 현재 권한 검사 로직을 찾아 읽고, 비가입(비로그인) 사용자가 취소에 도달하는 경로를 확인한 뒤, 가입 고객만 통과하도록 최소 수정한다.",
  "checks": "취소 요청 경로에서 비가입/비로그인 사용자가 거부되고 가입 고객은 정상 취소되는지 확인한다. 거부 시 사용자에게 보이는 응답(오류/리다이렉트)이 기존 처리와 일관적인지 확인한다.",
  "question": null,
  "intent": {
    "version": "intent.1",
    "relation": "start",
    "goal": "가입 고객만 예약을 취소할 수 있게 한다.",
    "conditions": [],
    "retired": [],
    "basisRefs": [
      {
        "basisId": "D1",
        "sourceId": "S_f42218d4-d66c-4c87-8efb-1ce9673b9422",
        "revision": 4
      }
    ]
  }
}
```

### P2-2-response.json

```json
{
  "understanding": "고객 요청은 '가입 고객만 예약 취소 가능'이지만, 같은 taskId에서 사용자가 직접 목적을 '가입 여부·로그인 검사 없이 비회원도 문자 링크로 예약 취소'로 정정했다. 돌아온 결과는 SMS 링크 기반 비회원 취소 흐름에 연결한다.",
  "scope": "이번 범위는 비회원 취소용 SMS 링크 흐름의 최소 구현과 그 확인. 정정과 충돌하는 '가입 고객만' 제한은 이번 지시에서 제외한다.환불 기능은 정정 조건에서 제외됐으므로 취소 처리에 포함하지 않는다.",
  "next": "1) 예약 취소 요청 시 비회원·비로그인 상태에서도 SMS로 받은 링크로 취소 화면에 접근 가능한지 기존 취소 API/라우트를 읽어 확인한다. 2) 취소 처리에서 가입 여부·로그인 검사를 제거하거나 우회하도록 최소 수정한다. 3) SMS 링크 생성/발송 경로가 이미 있는지 확인하고, 없으면 링크 발송 연결만 최소로 추가한다. 4) 취소 처리에서 환불 로직을 호출하지 않는지 확인한다.",
  "checks": "가입하지 않은 사용자가 로그인 없이 SMS 링크로 취소를 완료할 수 있는지 실행해 확인한다. 가입 여부·로그인 검사가 취소 경로에서 실제로 통과되는지(제거 또는 우회)를 코드/실행으로 확인한다. 취소 처리 시 환불이 발생하지 않는지 확인한다.",
  "question": null,
  "intent": {
    "version": "intent.1",
    "relation": "revise",
    "goal": "비회원도 SMS로 받은 링크를 통해 예약을 취소할 수 있다",
    "conditions": [
      "취소 링크는 SMS로만 보낸다",
      "환불은 이번 범위에서 제외한다"
    ],
    "retired": [
      "가입한 고객만 예약을 취소할 수 있게 해줘."
    ],
    "basisRefs": [
      {
        "basisId": "D1",
        "sourceId": "S_f42218d4-d66c-4c87-8efb-1ce9673b9422",
        "revision": 4
      },
      {
        "basisId": "D2",
        "sourceId": "S_f3b050d5-5095-4c23-b71d-198e91569fbc",
        "revision": 7
      }
    ]
  }
}
```

실제 metadata의 모델/status/finish/latency/전송 bytes와 usage 원형 값. 원 event.at/call/type은 아래 회차 연결로 생략하고 event array 전문을 복제하지 않았다. product latency는 HTTP 응답까지, provider latency는 adapter attempt부터 response까지다. 비용·속도 우열을 이 값으로 추정하지 않는다.

| 회차 | model / provider / product / finish | transport request/response B | product ms | provider ms | context request/response B | 원형 usage |
|---|---|---|---:|---:|---|---|
| P1-1 | deepseek-flash/200/200/stop | 14745/1861 | 3330 | 3306 | 1159/1550 | {"prompt_tokens":3889,"completion_tokens":392,"total_tokens":4281,"prompt_tokens_details":{"cached_tokens":0},"prompt_cache_hit_tokens":0,"prompt_cache_miss_tokens":3889} |
| P1-2 | deepseek-flash/200/200/stop | 16954/2731 | 4240 | 4233 | 3254/2398 | {"prompt_tokens":4573,"completion_tokens":645,"total_tokens":5218,"prompt_tokens_details":{"cached_tokens":3328},"prompt_cache_hit_tokens":3328,"prompt_cache_miss_tokens":1245} |
| P1-3 | deepseek-flash/200/200/stop | 18011/1892 | 3528 | 3521 | 4275/1574 | {"prompt_tokens":4898,"completion_tokens":440,"total_tokens":5338,"prompt_tokens_details":{"cached_tokens":3328},"prompt_cache_hit_tokens":3328,"prompt_cache_miss_tokens":1570} |
| P1-4 | deepseek-flash/200/200/stop | 17954/1934 | 3810 | 3804 | 4156/1618 | {"prompt_tokens":4950,"completion_tokens":442,"total_tokens":5392,"prompt_tokens_details":{"cached_tokens":3328},"prompt_cache_hit_tokens":3328,"prompt_cache_miss_tokens":1622} |
| P2-1 | deepseek-flash/200/200/stop | 14745/1590 | 2938 | 2933 | 1159/1278 | {"prompt_tokens":3889,"completion_tokens":323,"total_tokens":4212,"prompt_tokens_details":{"cached_tokens":3200},"prompt_cache_hit_tokens":3200,"prompt_cache_miss_tokens":689} |
| P2-2 | deepseek-flash/200/200/stop | 15729/2547 | 4428 | 4423 | 2047/2217 | {"prompt_tokens":4232,"completion_tokens":602,"total_tokens":4834,"prompt_tokens_details":{"cached_tokens":3328},"prompt_cache_hit_tokens":3328,"prompt_cache_miss_tokens":904} |

transport 요청32768B/응답131072B 상한과 제품 context131072B는 구별했다. 영속 ledger의 최대6슬롯은 전송 직전 예약·fsync하고 전부 실제200응답으로 확인했다. local429는0이며 서버 재시작이나 전송슬롯 retry도0이다.

## 6. 실제 생성 handoff 핵심 구간

P1-3/P1-4/P2-2 handoff.txt에서 목적과 이번 작업을 제목부터 다음 같은 수준 제목 직전까지 그대로 인용했다. 나머지 일반 안내/Studio 기록/과거작업/입력·기준/결과 안내 구간은 생략하되 P2의 현재 confirmed 기준 및 정정 전 D1 표시 구간은 추가 인용한다. 과거 원문을 인용한 것과 현재 실행 지시를 구별한다.

### P1-3-handoff.txt

```text
## 이어가는 목적 · AI 해석 / 원문과 구분

예약 취소 버튼의 색을 빨강으로 바꾼다.

유지할 조건: 이번 변경은 버튼 색상만 대상으로 한다.

이번 작업의 크기는 아래 현재 요청이 정합니다. 목적 전체를 다시 구현하라는 지시가 아닙니다.

해석 근거: D3 r12 / S_ccba32ab-d145-4eb9-af37-34d0ff63dd5b
```

```text
## 이번 작업

이번 요청은 취소 버튼 색만 빨강으로 바꾸는 순수 UI 색상 변경이다. 앞선 비회원 SMS 취소 작업과는 독립된 목적에 가깝다.


### 범위

취소 버튼의 색상(빨강)만 다룬다. 취소 로직·권한 검사·SMS 링크·환불·문구·버튼 동작은 건드리지 않는다. 앞선 비회원 취소 요청의 조건(환불 제외, 기존 가입 고객 동작 유지)은 이번 색상 변경에 적용하지 않는다.


### 다음 작업 (AI/모의 제안 또는 사용자 직접 수정)

취소 버튼을 렌더링하는 코드/스타일에서 현재 색상 지정 위치를 찾아 빨강으로 최소 수정한다. 취소 버튼이 여러 곳(목록/상세/확인 다이얼로그)에 있으면 실제 취소에 해당하는 대상들을 확인해 함께 처리하고, 그 외 버튼은 건드리지 않는다.


### 확인할 동작 (아직 검사 결과가 아님)

취소 버튼이 빨강으로 표시되는지, 다른 버튼 색·동작·문구가 바뀌지 않았는지, 수정 전후 코드 위치를 기록한다.
```

### P1-4-handoff.txt

```text
## 이어가는 목적 · AI 해석 / 원문과 구분

SMS 문구를 더 짧게 만든다.

유지할 조건: 이번 변경은 SMS 문구만 대상으로 한다. / 취소 로직·권한·링크 동작은 유지한다.

이번 작업의 크기는 아래 현재 요청이 정합니다. 목적 전체를 다시 구현하라는 지시가 아닙니다.

해석 근거: D4 r16 / S_faffbc9f-092e-4a16-90a6-a67376513cb2
```

```text
## 이번 작업

이번 요청은 SMS 문구만 짧게 바꾸는 독립적인 문구 수정이다. 직전 작업(취소 버튼 색)과 앞선 비회원 취소 목적과는 무관하다.


### 범위

SMS 문구의 길이만 짧게 조정한다. 취소 로직·권한·SMS 링크 동작·버튼 색·환불 범위는 건드리지 않는다. 앞선 비회원 취소/버튼 색 조건은 이번 문구 작업에 적용하지 않는다.


### 다음 작업 (AI/모의 제안 또는 사용자 직접 수정)

SMS 문구를 생성/송신하는 코드나 템플릿에서 현재 문구 위치를 찾아, 의미를 유지한 채 더 짧은 문구로 최소 수정한다. 문구가 여러 종류(안내/확인/완료 등)면 실제 예약 취소 SMS에 해당하는 대상만 처리하고, 대상이 여러 개면 각각 짧게 조정한다.


### 확인할 동작 (아직 검사 결과가 아님)

수정된 SMS 문구가 원래 의미(예약 취소 안내)를 유지하면서 더 짧아졌는지, 문구 외 로직·링크·버튼·색상이 바뀌지 않았는지, 수정 전후 문구와 위치를 기록한다.
```

### P2-2-handoff.txt

```text
## 이어가는 목적 · 사용자 직접 정정

가입 여부와 로그인 검사 없이 비회원도 문자 링크로 예약 취소

유지할 조건: 환불 제외

이번 작업의 크기는 아래 현재 요청이 정합니다. 목적 전체를 다시 구현하라는 지시가 아닙니다.

정정 전 AI 해석 근거: D1 r4 / S_f42218d4-d66c-4c87-8efb-1ce9673b9422, D2 r7 / S_f3b050d5-5095-4c23-b71d-198e91569fbc
```

```text
## 이번 작업

고객 요청은 '가입 고객만 예약 취소 가능'이지만, 같은 taskId에서 사용자가 직접 목적을 '가입 여부·로그인 검사 없이 비회원도 문자 링크로 예약 취소'로 정정했다. 돌아온 결과는 SMS 링크 기반 비회원 취소 흐름에 연결한다.


### 범위

이번 범위는 비회원 취소용 SMS 링크 흐름의 최소 구현과 그 확인. 정정과 충돌하는 '가입 고객만' 제한은 이번 지시에서 제외한다.환불 기능은 정정 조건에서 제외됐으므로 취소 처리에 포함하지 않는다.


### 다음 작업 (AI/모의 제안 또는 사용자 직접 수정)

1) 예약 취소 요청 시 비회원·비로그인 상태에서도 SMS로 받은 링크로 취소 화면에 접근 가능한지 기존 취소 API/라우트를 읽어 확인한다. 2) 취소 처리에서 가입 여부·로그인 검사를 제거하거나 우회하도록 최소 수정한다. 3) SMS 링크 생성/발송 경로가 이미 있는지 확인하고, 없으면 링크 발송 연결만 최소로 추가한다. 4) 취소 처리에서 환불 로직을 호출하지 않는지 확인한다.


### 확인할 동작 (아직 검사 결과가 아님)

가입하지 않은 사용자가 로그인 없이 SMS 링크로 취소를 완료할 수 있는지 실행해 확인한다. 가입 여부·로그인 검사가 취소 경로에서 실제로 통과되는지(제거 또는 우회)를 코드/실행으로 확인한다. 취소 처리 시 환불이 발생하지 않는지 확인한다.
```

P2-2 현재 기준과 정정 전 원문 표시 추가 구간:

```text
## 이어갈 기준 — 직접 관련 (현재 값)

[D2] 사용자 확정 / r7 / S_f3b050d5-5095-4c23-b71d-198e91569fbc
링크는 SMS로만 보낸다
```

```text
## 정정 전 이 작업의 요청 원문 — 사용자 정정과 양립하는 조건은 유지, 충돌하거나 유지 여부가 불명확하면 확정하지 말고 확인 (자동 폐기 아님)

[D1] 요청 원문 · 해석 미확정 / r4 / S_f42218d4-d66c-4c87-8efb-1ce9673b9422
가입한 고객만 예약을 취소할 수 있게 해줘.

요청 원문에는 배경·인용도 포함될 수 있습니다. 전체를 확정 정책으로 읽지 마세요. 최신 명시 요청·답변은 그 범위에서만 적용하고, 관련 없는 기준은 유지하세요.
```

## 7. baseline과 후보 의미 비교 — 판정/추론 분리

Protocol은 후보6회 모두 수용됐다. 그 결과를 의미 품질 합격으로 바꾸지 않는다. 아래 판정은 purposeIntent/intent 문구가 아니라 실제 next/scope/checks/handoff와 provenance를 대조한 사람의 의미 검토이며 새 평가 API를 호출한 것이 아니다.

| 기준 | AI067 exact2750 원관측 | AI068 exactbaa94 후보 원관측 / 판정 |
|---|---|---|
| P1 명시철회 직후 | 검사제거·비회원SMS·환불제외 반영 PASS | 같은 핵심 행동 반영 PASS. 다음 작업은 실제 취소 경로 조사→검사 제거·비회원SMS 취소·환불 제외다. |
| P1 색/문구 작업 크기 | 작은 작업 유지 PASS | 각 실제 next는 색상/예약취소SMS 문구만 수정, 전체취소 재구현 없음 PASS. |
| P1 오래된 가입 조건 부활 | P1-4 scope가 가입고객 D1을 현행 유지 대상으로 언급 FAIL | P1-4 current scope/next/checks에 D1 제한을 보존/복원하라는 지시는 없음. handoff의 D1은 역사 원문 표시다. 해당 부활 결함은 이 표본에서 개선 관측. |
| P1 유효한 계속 목적/조건 유지 | 별도작업으로 분리하고 현행 조건 혼란 FAIL | request purposeIntent는 맞지만 응답은 비회원취소 목적을 무관하다고 하고, handoff 목적은 SMS문구뿐. scope가 ‘앞선 비회원 취소/버튼 색 조건은 이번 문구 작업에 적용하지 않는다’고 명시. 계속 목적·조건의 유효 현재맥락 보존 기준은 FAIL. |
| P2 직접정정+confirmed 전달 | value=null·직접정정·D2confirmed 공존 PASS | context.6에서 동일 동시전달 PASS. 처음 request/D1requested는 실제로 남고 previousWork/purposeIntent는 null. |
| P2 비회원SMS/가입로그인검사 비적용 | 실제 next가 비회원 차단 FAIL | actual next/checks가 비회원 로그인 없이 SMS취소와 검사 제거 또는 우회를 지시. 정정의 기능적 의미는 PASS. ‘없애기’의 문자 그대로 코드 삭제만 보장하는 문구는 아니며 제거/우회 대안은 한계로 기록. |
| P2 환불제외 | 반영 PASS | 실제 scope/next/checks에서 환불을 취소 처리에 넣지 않고 발생하지 않는지 확인 PASS. |
| P2 SMS-only | 직접 지시/검증에 반영 PASS | intent와 **현재 handoff D2confirmed 기준**에는 SMS로만 발송을 명시. 실제 next는 SMS경로만 지시하고 경쟁 채널을 지시하지 않지만 scope/next/checks에는 다른 채널 배제·미발송 검증이 명시되지 않음. 작업필드 배타성 검증은 PARTIAL/불명확이며 전 기준 PASS로 강제하지 않는다. |
| P2 정정 문장 retired | AI가 사용자 직접 정정문장을 retired에 넣음 FAIL | AI retired는 옛 가입고객 원문만 포함. 사용자 정정은 stored intentEdit와 표시 목적에 유지 PASS. |

**P1 종합: 계속 목적/조건 유지 FAIL.** ‘취소 로직·권한·환불 범위를 건드리지 않는다’는 작은 작업 제한은 유효하지만, 이를 계속 목적을 무관한 과거로 돌리고 조건을 적용하지 않는 것과 동일시할 수 없다. purposeIntent에 올바른 문구가 들어갔다는 사실만으로 PASS하지 않았다. 실제 가입 검사 재도입이나 취소 구현 변화가 발생했다는 증거는 없다.

**P2 종합: 핵심 직접 정정은 개선, 엄격한 전 기준 판정은 PARTIAL/조건부.** 비회원 차단과 사용자 정정 retired는 이번 응답에서 해소됐고 실제 work/handoff도 기능적 정정과 환불 제외를 따른다. SMS-only는 intent만이 아니라 현재 confirmed handoff 기준에도 있어 전부 사라진 것은 아니다. 다만 실제 checks에서 배타성 확인이 빠졌고 제거/우회 대안이 남아 전체 의미 PASS를 확정하지 않는다.

모든 후보 question은 null이다. P1-2가 기존 SMS 진입/검증 구조가 없으면 임의로 만들지 말고 보고하라고 한 조사 조건은 원형 응답에 남겨 검토 가능하게 했다. 새 정책이나 구현이 실제로 확정됐다고 보지 않는다. 두 사례·각 회차 한 응답으로 일반 실패율/모델 우월성/전체 제품 품질은 판단하지 않는다. P3 원 AI060 trigger·질문 결함이나 Sol delta검토는 이 실험으로 해결/통과했다고 기록하지 않는다. 통과한 개별 조건도 후보 자동 수용·통합을 뜻하지 않는다. 추가 호출·재생성·튜닝은0이다.

## 8. 원파일 지문과 보존

원본 ai067 scenario/run 및 기존 결과는 그대로이고, ai068에는 전체 상태/실제 요청·응답/trace/metadata/identity/handoff와 semantic-review.json을 별도 보존했다. 아래는 인계 핵심 원파일 지문이다. 문서에 생략한 pending/poststate/중간 correctIntent/recordBasis 전문은 로컬 원파일로 보존하고 그 지문 표는 생략했다.

| 원파일 | SHA-256 |
|---|---|
| P1-1-pre-request-project.json | daa1798a91b188be5dab44d1491e5d5f8e2bbd4e9691644b3aa0c210c5da49f2 |
| P1-1-operations.json | ddcbaf0f088ee964bb113bde9eeddf50fd124b63e5319ae1bf1ca066ce69fe25 |
| P1-1-request.json | a893d1e6e5083adc54a0ce656ab147d0d85a8453e078f51b21b845f353a5b944 |
| P1-1-response.json | 764503a8d67dc41758499cce0b8de9fd203c7ec10e278d9747c617c0d0a93592 |
| P1-1-metadata.json | 7052c316d8e477abb7f25bf094a604376dc74418babe4f5f406b230c86f4a544 |
| P1-1-handoff.txt | 182a4d057693c0902440c68b2045fa7b3e05c29c08a36227f359ae67bcab97c7 |
| P1-2-pre-request-project.json | 56d0fa9f0aa8deee69061830251c0d859a9b64ae333abbaff5be40537abf9147 |
| P1-2-operations.json | 72a4e97dd4212097479414ee733fa0c30f6e87c274fe847feb8ec6844111a320 |
| P1-2-request.json | 509e1ca5522c319f6952ba1169c42b772861c4ee68357f84919dc01df1011c9f |
| P1-2-response.json | 2c62ebe07a3ee0e75b1b96656ce2f7c6905a5ed01d04dd5aceaf11aa5af2d636 |
| P1-2-metadata.json | 96b5ab5a15da5f22fdc4e7d7c6f6575b52cf4bb681a43d7d58d6f9fc0c0230d6 |
| P1-2-handoff.txt | 7988c9339acc6d1b24b0696fffad26cc87e9511b615f3518a7e9e785e198fb99 |
| P1-3-pre-request-project.json | 12e25b0af642170e3612a9ce2b9f73ebb160b7eb83dadb4b87e01cd91261dcb2 |
| P1-3-operations.json | 58796e5c77b62de856945e619c23602098968e174cc2752f4957bc4ff927b0be |
| P1-3-request.json | 6bc8ef86c91524c220f367049aed148222272dbdef1181223c51ba24214d73b3 |
| P1-3-response.json | a7501ca18f7c4d246098851baa14d9ff91ff39885b20cb38b38d2aad3d0a2a8e |
| P1-3-metadata.json | 8aa544d0505d680df128b40e165c17f6e840b90c036b53a021653dbe1cbd9b68 |
| P1-3-handoff.txt | 8c8c227989b797f02af81212f0d6dd45c3bb099437d741d62fdffdf49d65d9d6 |
| P1-4-pre-request-project.json | 1e3e557dff77f4dba5e6140ecad494afe8833f6f5e06fd1fd2f92aaa6e351d11 |
| P1-4-operations.json | 7d74cd38f12a5c2b3d847fe57e6683d076bf943531ff73dfdc680c5a831b84d3 |
| P1-4-request.json | 5c84c768a8c0eaf2ed8bcf983475c77666fef1e8c98e1e169d8aae6deddec66c |
| P1-4-response.json | 122961a10bf6328b5b4e3ad98b51b6b88a6392102db17f17350d0b09ce274541 |
| P1-4-metadata.json | 83e7218210bf34176514293eafd6423302115f144586dfb6aa7471381b671f42 |
| P1-4-handoff.txt | 9bb266f477f1ddfd5730295479eea1675ac2ad2fe9db886f4d739cd3880d7974 |
| P2-1-pre-request-project.json | da4e14d1807c4fd8add41526aa5ed6338916b30dfa48876d05401fc5c0b785a4 |
| P2-1-operations.json | 9bfd6cbffe956f3c2c5f7a45540a898d623382181b1fa24d77b785a28e854bea |
| P2-1-request.json | 0fd8726b84cb21130cab009dc18f121db9b2326ed1072502fbf21b6f40b3ea7c |
| P2-1-response.json | 13ee72e1a8fc6c6d04fb73d312a8306906fd4e7e884ca4db2f59ed9f7f3c7d42 |
| P2-1-metadata.json | 8f842493e78a4379588d5008c1332b8d7096366b4b47c3bb731f99b8a7a7bf40 |
| P2-1-handoff.txt | e97639d3bb3a2270663e08025ea66e302e6bb161b0e4823243578a22b92b89aa |
| P2-2-pre-request-project.json | 283ee06c75f49b91b32d94fb64e61f3507412436a5b8d5b2557c9cc9ba4ec922 |
| P2-2-operations.json | 596da641242ec5184b8ff750ca9cc31f4a03cd6da2634d6a07f74b83723e37dd |
| P2-2-request.json | 89bd41bf4106c221a8da7103c833551d2f5a1c3a35eb8a0227306169ac589fdc |
| P2-2-response.json | fc8038a996a23e6956ed9a4b1246967d38508357adb1ed213a1fdb604a1c2927 |
| P2-2-metadata.json | e5abb38a5c1dcdec8c889cee9f14bef1f035a26704e36633d9a93a5c0a0a935a |
| P2-2-handoff.txt | 65a892e4c32aa3c54475ca0717ac2dd5d1d0b057783bc0d915948e926c1333bf |

동결 지문은 frozen.json, source identity는 source-manifest.json, 최소 runner 차이는 runner.diff, 실제6전송 영속 기록은 ledger.json/run-summary.json이다. 남은 일은 계속 목적과 작업필드 일관성의 수정/독립 검토이며 이 후보 평가에서 제품/prompt 변경·원격 후보 소스 수정·main/PR2/Pages 변경·PR 생성·자동통합은 하지 않았다.
