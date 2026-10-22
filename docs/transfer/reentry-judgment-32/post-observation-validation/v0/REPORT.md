# 32 후행 입력 검산 — 최초 관측과 분리

최초 관측은 **57896a27266c20b21ac1c3b2a94ba27ca7294eec**에 고정돼 있습니다. 그 payload71개와 원격 manifest의 바이트 일치를 재확인했고 수정하지 않았습니다. UI/서버 재실행, worknotice00 조사·수정, 새 인계/반환 검사는 하지 않았습니다. 아래 내용은 최초판단 이후 허용된 준비표 대조이며 화면에서 당시 발견한 사실로 소급하지 않습니다.

## 실제 실행

| 명령 | 실제 child exit |
|---|---:|
| Node22 `verify.mjs --module-root <정확729 compiled shared> --receipt <입력폴더밖 results/domain-receipt.json>` | 0 |
| Node22 `verify-signals.mjs --module-root <동일 compiled shared>` | 0 |

외부 Python collector/tool 종료도0입니다. 실제 runtime은 **v22.16.0**이며 두 helper 결과 PASS입니다. 첫 실패는 없습니다. 기존 compiled 모듈을 사용했고 새 빌드나 UI검사를 했다고 주장하지 않습니다.

정확729 source의 `app` tree는 **00267e7cc9b913305dccc063c6439cb1ffd302f3**로 확인했습니다. merge75ed2ed7/양OSCI성공은 총괄 전달사항이며 여기서 CI를 조회하지 않았습니다. binding27dee9의8 shared TS 원격 blob/실제729 소스 바이트와 compiled8파일 bytes/SHA를 모두 대조했습니다. api의 domain/validation/attention/hierarchy/mock 및 types/plan-facts/outcome 의존 모듈이 일치합니다.

입력24baf91의 원본 전체를 별도 `input-original`로 회수하고 실행은 그 사본 `validation-copy`에서 했습니다. 원본의 모든 파일은 전후 동일합니다. signals 도구가 쓰는 QUESTION_SIGNAL_PROOF.json만 사본에서 변경됐고, 새 Node22 결과는 별도 results로 보존했습니다. 기존 Node24 proof와는 runtime만 다르고 나머지 전체 내용은 같습니다. receipt는 입력폴더 밖에 생성했습니다. EXECUTION_BINDING/process에 정확경로·명령·UTC·종료·로그SHA가 있습니다.

## 준비표에 비춘 최초 관측

- **맞게 읽음:** 목적/5영역 포함구조, 미리보기 질문은 답변 있음·오류행 질문은 미답, 오류행 중단/제외가 아직 미선택이라는 현재설명, 별개 current D와 읽기·검토 대상 미전송입력의 구분. helper는 미리보기의 답변이 정식 answer이며 test_answer가 아님도 검산했습니다. 이 추가 구조검산을 당시 화면에서 모두 확인했다고 말하지 않습니다.
- **몰랐음/확인하지 않음:** 실제로 미리보기 A는 T0 데이터10행/r1에서 T2 데이터20행/r3으로 바뀌어 있었습니다. r2의20행 변경설명을 r3이 같은본문·빈changes로 재서술했고, U/N만10→20·scope/checks는 보존됐습니다. 첫지도에서 같은 ‘현재설명2’를 보고 변경을 판단하지 못했고 A의 최신본문/이력을 열지 않았으므로 이 변경을 인지한 것으로 고치지 않습니다.
- **신호만 읽고 상세는 안봄:** 내보내기 C는 기존설명도 current.valid=false였고, CSV만 다루는 현재조건 이후 CSV/XLSX를 다룬다는 늦은 설명이 plan-changed로 보류됐습니다. 당시에는 보류1 신호를 봤을 뿐 CSV조건·정확원인·늦은H/원문은 읽지 않아 판단을 유보했습니다. 보류를 현재사실로 승격하지 않은 범위만 맞습니다.
- **후행에서만 검산:** 원래6개H의 SHA/UTF16길이/digest/work/record와6개 return raw의 중복연결·basedOn이 일치합니다. 이를 최초 UI에서 원보고 전문을 다 읽은 증거로 세지 않습니다.

오류행 B는 사건순서상 오래된 미답이지 일수를 임의로 과거로 만든 자료가 아닙니다. 준비표 자체도 B를 유일 정답으로 지정하지 않습니다. B를 다음 작업으로 고른 것은 실제 미답과 목적에 근거한 한 선택이며, 최신A나 보류C를 먼저 고르지 않았다는 이유로 오답 채점하지 않습니다. T0/T2는 같은 Project.id의 별도 복구사본이고 last-read/unread 기준은 없습니다. ‘새것인지 모르겠다’는 원판단을 그대로 유지합니다.

POST_COMPARISON.json이 최초 원문과 후행사실의 구분을 연결합니다. 실제 선택H/반환/비대상보존의 기존 검사는 반복하지 않았습니다. 전체 generated자료/FACTS/QUESTION_SIGNAL_PROOF는 이 후행단계에서만 읽었고 입력 생성코드 실행이나 제품동작/의미검증·사람연구·실제AI로 범위를 늘리지 않았습니다.

새 evidence prefix에 검산코드/원helper3개·입력경로해시·원출력/receipt/proof·실제exit·대조만 추가합니다. 원입력·최초관측·제품은 불변입니다. MANIFEST는 자신을 제외한 정확 payload 집합입니다.
