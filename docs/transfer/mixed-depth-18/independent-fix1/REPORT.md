# Cycle18 fix1 한정 결과 — 최종 수용 아님

제품 e37e7ced35a9202513dace327ed6f48330cec6a7. ba9 before 고정증거: [c7981de](https://github.com/tlsee0813-cmd/agentflow-studio/tree/c7981de616f275b97b1ccc28dd316a778a075f7d/docs/transfer/mixed-depth-18/independent-v0). 해당 원본을 덮지 않았다.

- check/build 및 domain 261/261: 실제 exit0. exact 작성자 AREA18 전체 12개는 9통과/3실패, exit1. 작성자/독립 단언을 합산하지 않는다.
- 같은 원질문 최소 API 반례는 1→0에서 1→1로 개선(exit0). 정상 request에 먼저 존재하던 질문+정확 시험답변 자료이고 최초 시험 생성 질문과 구별한다. taskStatus와 questionAnswered는 바뀌지 않았지만 projection에 원질문이 남고 ‘시험 답변 기록 · 실제 답변 아님’이 표시됨을 양PC DOM에서도 확인했다(question-ui). DOM label 확인을 전체 글자 가시성/사람 이해로 확대하지 않는다.
- 이전 동일 독립 2표본×2PC core 4흐름 46관측은 exit0. relation-reader 출발→실제 자식 새 요청→결과파일용 clipboard→관계 읽기 복귀의 실제 camera/fold/selection/focus/anchor와 작업 저장을 확인했다.
- AREA18의 다른 출발, 즉 parent의 ‘설명 읽을 부분 찾기’→실제 자식 새 요청/인계→원래 parent 복귀는 1280 product13/1440 두표본에서 호출행 읽기 위치 단언 실패. 결과를 통과로 바꾸지 않았다.

## 세 실패의 원인 관측

anchor-diagnostic은 작성자 원본의 snap에 읽기전용 측정만 추가해 실패한 3경로를 실행했다. anchor-diagnostic-state는 1280 product13 하나에 저장 상태 전후를 추가했다. 제품/원래 단언/조작은 변경하지 않았고 각 child/collector exit1이다. 초기 실패 로그와 이후 진단을 같은 실행으로 합산하지 않는다.

진입 시 capture가 택한 첫 가시 항목은 실제 report task의 subtree-task/owner 버튼이었다. 실제 새 요청이 그 report의 child로 생성되자 원보고의 ‘아직 조치하지 않은 보고’ 목록행은 DOM에서 빠졌다(저장된 report/source/task는 그대로 남음). 고정 anchor ID가 사라져 scroll old/clamp fallback만 남고, 여전히 존재하는 호출행 설명버튼은 원위치에 복원되지 않았다. 1280 product13 상대 top65.44→−76.06px, 1440 두표본은 약155.5→104px. root가 요구한 실패 그대로 보존하며 이는 전체 원보고 데이터 소실과 다르다. 제품이 최초 가시 항목을 기준으로 삼는 현재 구현과 ‘실제 호출행 복귀’ 단언 사이 차이를 명시하고, 의미 판정은 root 통합 판단에 남긴다. 값/항목 ID/저장 전후 전체는 raw JSON으로 재계산 가능하다.

## 경계와 재현

fixture는 격리 정상 import, public domain API 합성 설정이다. source-restated 입력 자료만 재사용하며 독립 UI assertions는 별도다. Node22.16/TS5.8.3/PW1.57/Chromium154, 실제 HTTP/MOCK, paid0. source 188파일 git-after 일치; 추출 직후 개별 before snapshot은 없고 HTTP 별도 audit는 disk전후/body 일치다. 외부 최초 page.goto binding과 혼동하지 않는다. 컨텍스트 pageerror/외부요청 []는 재사용 lifecycle가 검증하며 console 전체 원문은 미수집이다.

추가 목록읽기/IME context 경계는 제품UI bytes가 같은 ba9에서 실패했고 fix2에서 별도 검증 중이다. 이 fix1 core 개선으로 그 실패를 통과 처리하지 않는다. 역사 long-text 검사는 ba9 별도 실행이며 fix1 실행으로 합산하지 않았다. 사람 연구/원프로젝트 실행/실제 AI/touch/OS IME/전체 원문 왕복은 미검증. MANIFEST는 본인 제외 정확 payload 집합이다.
