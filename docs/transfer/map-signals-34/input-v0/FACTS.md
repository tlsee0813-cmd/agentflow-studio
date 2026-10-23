# 합성34 입력 행별 사실표

명시 합성 입력이며 실제 사용자 발언·외부 AI·구현/검증 완료 자료가 아니다.

## 영역별 독립 기대값

|키|실제 이름 길이|소유 범위|N|M|설명 존재|
|---|---:|---|---:|---:|---|
|P|48|P,Q,S|4|1|현재 1 / 이전기준 1 / 보류 1|
|Q|50|Q|3|1|현재 0 / 이전기준 1 / 보류 0|
|S|50|S|0|0|현재 0 / 이전기준 0 / 보류 1|
|B|48|B|1|1|현재 0 / 이전기준 0 / 보류 0|

P는 자기+실제 자식 Q/S만 센다. Q→B의 related 관계는 소유 범위를 늘리지 않는다. P 부모 카드에 세 설명 상태가 공존한다. Q는 이전 기준 설명, S는 current=null인 held-only다.

## 질문별 독립 기대값

|행|정확 task ID|실제 소유|N 포함|M 포함|기존 applicability / answered|뜻|
|---|---|---|---|---|---|---|
|qRealAnswered|T_e7addee0-d63c-4ae9-aa2a-0baa0e1d580b|Q|True|False|answered / True|정확 실제답변 역할 기록; 구현/검증 성공 아님|
|qExactTrial|T_e6ef49ac-0bc4-438d-9f7e-d9b16fbf99b2|Q|True|False|answered / True|원실제request의 정확 test_answer: 전체 N 포함, 시험답변/실제답변 아님 표시|
|qStaleOwn|T_d183ba43-f884-4eeb-9528-4c247025456b|P|True|False|stale / False|직접 요청 정정 뒤 옛 질문; 부모 자기 기록 N 포함|
|qTrialContextExcluded|T_bfe54565-1b4f-4e21-96d7-04daafec1c93|S|False|False|active / False|test_answer 시험문맥에서 새로 생성된 질문: 기존 제외 정책|
|qActiveLeaf|T_6c7a1fbe-fb30-4718-afa8-03f36c21767a|Q|True|True|active / False|말단 Q의 현재 답변 기록 없음|
|qOutsideCurrent|T_22fc2640-945f-41a8-83be-1935dc9d9dcf|B|True|True|active / False|관계만 있는 B의 현재 질문: P 집계에는 제외|

N은 기존 subtreeSignals.questions 전체다. M은 그중 applicability=active && !answered다. 정확 test_answer의 answered=true는 기존 API의 답변 **기록** 판정이며 실제 답변/완료 승격이 아니다. 시험문맥 생성 질문은 N에서 제외된다.

## 입력 출처와 제한

- areas/tasks/출처/인계/설명 상태는 공개 domain API의 반환값으로만 만들었다. 직렬화 JSON의 상태 필드를 고쳐 만들지 않았다.
- 5가지 질문 경계를 4영역에 모았고, B의 별도 현재작업 질문은 관계가 집계를 확장하지 않는 대조군이다. 총 원작업6 + 합성 반환3 =9작업이다.
- 정확 시험답변은 원 request의 기존 질문에 answer(..., testOnly=true)로 추가했다. 별도 시험문맥 질문만 receive의 명시 합성 provider-shaped 응답에 넣었다. 이는 기존 MOCK 알고리즘이 그 질문을 생성했다고 주장하는 자료가 아니다.
- P/Q/S의 H는 기존 handoffText의 실제 template를 사용했다. S는 내보낸 뒤 자신의 구상만 editArea로 바꾸고 늦은 반환을 수신해 plan-changed 보류를 만들었다. file-basis=99 같은 가짜 판본을 넣지 않았다.
- 입력의 UUID/UTC는 공개 API가 생성하므로 다시 생성하면 byte hash/ID가 달라진다. 이번 파일·FACTS의 고정 ID/해시가 기준이다.
- 카드 180px·좌표·폰트·글자 clip/hit·행동 가시성은 이번 Node 단계에서 검증하지 않았다. 후보 수신 후 같은 renderer에서 확인한다.
