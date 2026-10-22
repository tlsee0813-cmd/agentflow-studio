# Cycle18 ba9 독립 before 관측 — 수용 아님

제품 ba9bf6e477f6cf36d1a056b3db218c98bf8bf26e, 계약 df7283fd3fe2fe88ab17e93c175a6e84c0d0f655. 이후 8001ccbe는 기존 3개 browser 검사 schema 기대값 5곳만 보정한 별도 커밋이다. 제품은 수정하지 않았다. Node22.16 / TS5.8.3 / Playwright1.57 / 실제 Chromium154, loopback HTTP, 격리 context와 MOCK만 사용했다.

## 실행과 중요한 실패

- type/check/build 및 Node domain 259/259: exit0. 정확 작성자 AREA17 12개: exit0. 이는 독립 UI 관측과 합산하지 않는다.
- 정확 작성자 AREA18 12개: input composer가 닫힌 상태로 파일입력 summary를 클릭한 8 errors, exit1. input-open만 정상 클릭으로 보완한 별도 wrapper 8개는 4개 통과/4 errors: 일반 copy-work의 anchor=null을 파일반환 anchor로 읽은 harness 오류. 원본/보완 로그 모두 보존. wrapper의 별도 외부 collector JSON은 수집하지 않았으며 tool에서 관측한 실제 exit1이다.
- 독립 2표본×2PC 핵심 UI 4흐름 완주 exit0. 접힌 소유자 질문/설명, 실제 endpoint·원래 relation 배열, 필요한 조상 펼침, 실제 자식 새 요청, 명시 결과파일용 clipboard anchor와 원점 관계읽기 복귀를 관측했다. 일반 복사와 파일반환용 인계의 의미를 구별했다.
- 긴 제목/2000자 note/5+요청, 고정 panel 상하 행동·native body wheel·A→B→A·미저장 입력·일반 Escape 및 비자손 B 프레임 생략 fallback: 별도 long-ui exit0. 박스/표본 hit는 전체 글자의 인간 가독성을 증명하지 않는다. 길거나 잘리는 제목은 명시 전체 펼침 경로와 구별한다.
- 정상 request에 이미 기록된 질문을 public API로 만든 후 정확 replyTo 시험답변을 추가하면 질문 소유자 기록 1→0. 정상 답변 비교군은 1→1. test-answer-transition에 최소 생성 API 코드와 세 전체 입력/전후가 있다. 처음부터 시험문맥으로 생성된 질문과 구별한 재현이며 실제 사용자 질문을 사칭하지 않는 합성 자료다. child/collector exit1. root가 core 결함으로 확인했고 수정 후보 별도 검증 중이다.
- 긴 영역 읽기→프로젝트 목록→동일 프로젝트→동일 영역: 펼침은 유지되나 body scrollTop 1280에서294→0, 1440에서280→0. 목록 카드의 의도된 전체공간 진입/선택해제와 읽기 memo 소실을 구별했다. 같은 Area를 명시 재선택해 비교했다.
- 기준 context 열린 상태→전체공간→영역 이름 input Escape: context true→false, focus area-name→nav-context. 실제 Chromium composition의 isComposing=true Escape에서도 동일. 입력값은 유지. CDP composition 프로브이며 OS IME/사람 검증이 아니다. keydown 관측 listener는 로그만 출력하고 앱 상태/이벤트를 수정하지 않았다. 내부 control이 직접 preventDefault한 별도 Escape 경로는 미실행이며 synthetic preventDefault로 만들지 않았다.

## 증거와 한계

SUMMARY/개별 result가 실행별 집계다. 서로 다른 실행·원본 실패·나중 부분 성공을 합산하지 않는다. first-ui-normal-copy-anchor에는 독립 첫 검사도 일반 copy anchor를 오독한 fatal과 당시 코드/로그를 보존했다. first-test-answer-and-state에는 첫 state 검사에서 stale context와 읽기용 원보고 전문을 혼동한 단언 및 fixture 중간본이 있다. 현재 state 검사는 오래된 설명이 CURRENT 인계문맥에서 제외되는지와 원보고 보존을 분리한다. 최초 generator 중복 relation setup 오류는 fixtures-first.mjs에 코드가 있으나 stderr 파일은 별도 보존하지 못했고 tool 전사에만 있었다.

fixture는 pinned source-restated sample helper의 입력 자료를 재사용하고 public domain API로 독립 합성 질문/관계/긴 본문을 추가한 뒤 정상 UI import했다. 작성자 assertions를 독립 판정으로 복제하지 않았다. 관계/의미의 실제 원프로젝트 실행·사람 이해·touch·OS IME·외부 원문 왕복·실제 AI 송신은 미검증. 실제 download 버튼 인계는 이번 독립 core에서 미실행(결과파일용 clipboard는 실행). 늦은 설명·ancestor 변경/복원·재소속·구형 anchor attach/detach/reload는 state.mjs의 public API 관측이며 실제 UI 전체 순열 성공으로 쓰지 않는다.

SOURCE_BINDING은 pinned git blobs와 실행 후 188개 파일 동일성이다. 추출 직후 별도 per-file before snapshot은 미수집이며 이를 과장하지 않는다. http-runtime은 별도 실제 서버 GET 응답과 disk 전후 동일성으로, 최초 page.goto 응답을 직접 수집한 기록은 아니다. pageerror/외부요청은 재사용 lifecycle tearDown에서 [] 검증하며, 모든 console 메시지 원문은 별도로 수집하지 않았다. child/collector JSON과 명령별 actualreturncode를 참조한다. MANIFEST는 본인 제외 정확 payload 집합이다.
