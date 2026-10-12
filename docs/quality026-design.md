# QUALITY026 — 설계 수용과 실험 구현 인계

2026-10-12 설계 완료·좁은 검토 기준. 총괄은 **단일 모델 호출의 경량 작업계획 → 관계 검사 → 기존8키 결정적 변환**을 실험 후보로 순차 구현하도록 승인했다. QUALITY026_IMPL 제출본을 회수했다. 작성자 제출 뒤 **독립 좁은 코드 검토와 Cloud 무상 연결 검증을 통과해 실험 준비를 수용했다. 후속 실호출은2회에서 첫 PLAN_LINK_INVALID로 중단했다. 앱 수용1·실패1이며 최초18미실행·후속8미배정**이다. 공유 제품은 IDEA022 + UI001 rev1을 유지한다. 설계 수용은 제품 승격·기본 설정 변경이 아니다.

## 판단 근거

QUALITY025의 선택지/필드 범위 모순과 계획 기록/실구현 검수 혼합은 확인 가능한 관계가 자연어 안에만 남아 있다는 설계 문제를 드러냈다. 새 후보는 조건의 대상·상태, 결정의 선택값, 해당 선택에 의존하는 작업·검수를 작은 내부 JSON에 연결하고 같은 자료에서 기존 사용자8키를 조립한다.

prompt 경고만 재배치하는 안보다 관계를 검사·관측할 수 있고, 추가 모델 호출보다 지연·실패·보호 경계를 작게 유지할 가능성이 있어 먼저 선택했다. 실제 의미 추출·긍정 요구 누락·잘못 분리한 대상·자유문장의 모순을 자동 보장하지 않는다. 관계 검사 통과와 고객 효용·내용 품질은 별도 평가한다.

설계자는 Camunda DMN·TypeScript 판별 유니온·PostgreSQL 관계 제약의 메커니즘을 정적으로 조사했다. 새 라이브러리·DB·외부 소스는 도입하지 않는다. 이 연결의 효과는 아직 가설이다. 설계 ZIP SHA256은 `33e84abe6faad757193a9087c8cb5fe3f68a53a18996a708299b723b43d02355`이며 단일 상위 폴더23파일/manifest22항목의 패키지 무결성을 확인했다. 코드 실행 증거는 아니다.

## 수용한 구현 경계와 정정

예상 후보는 기존 server provider/app의 좁은 접착과 신규 plan-generation/plan-codec다. generation 선택은 신뢰된 서버 내부 주입으로만 연결하고 기존 기본 경로·DIRECT025 대조군을 보존한다. 입력 API·domain/appFacts·저장·UI·기존8키·의존성은 유지하며 마이그레이션·두 번째 호출·자동 수리·재시도·fallback을 추가하지 않는다.

goal/deliver의 coverage와 preserve/exclude의 보존 검수를 분리한다. 현행 보존을 새 편집 UI 구현으로 승격하거나 명시 요청에 필요한 독립 준비 작업을 일괄 금지하지 않는다. 이미 확정된 선택은 재승인 없이 현재 작업으로 조립하고 미정 분기는 next/checks에 같은 선택 조건을 남긴다. 정상 미정과 구조 실패를 구분한다.

**실제 wire 송신 상한32768바이트는 유지한다.** 앱 입력131072·raw 응답131072는 별도 경계이며 설계 문서의 큰 상한을 이유로 송신 한도를 늘리거나 조용히 자르지 않는다. 기존8192토큰·60000ms와 키결속 writer·반향 보호·상태 보존·중복/원장·abort 경계를 재사용한다. 중간 계획 관계 검사·최종 validateAdvice·보호 기록의 순서를 구현하고 실패를 성공으로 표시하지 않는다.

codec/renderer → generation/provider → lab을 한 패키지에서 순차 통합해 계약 해석을 맞춘다. 위 내용은 설계 수용 당시의 인계다. 작성자의 후속 구현 보고와 별도 검증 상태는 아래에 구분한다.

## QUALITY026_IMPL 제출본 회수

작성자 보고: QUALITY025190소스 중188불변·기존2수정·11추가로 현재201소스이며 별도 컴파일 runtime16은025와 바이트 동일하다. 제품 후보 변경은 기존 provider/app의 접착과 신규 plan-generation/plan-codec4파일이고 나머지는 새 lab·검사·fixture다. 기존 DIRECT025·기본 설정·입력 API·저장/domain/appFacts·UI·8키를 유지한다고 보고했다.

작성자 실행은 신규25검사(코덱10·provider/HTTP/보호8·lab7), 기존 관련31검사와 부모/continuity check/build 통과(fail/cancel/skip0)다. **offline npm ci는 캐시 부재로 실패**했으며 설치된 동일 TypeScript5.8.3으로 검사·빌드했다. 클린 설치 성공·독립 검사 통과로 표현하지 않는다. 포장용 최초20+후속8 모의 실행·완료 재개 추가0은 실AI가 아니다. UI001 rev1 실제 통합·전체 suite·브라우저 검사는 반복하지 않았다.

ZIP SHA256: `9498037afda791b0551c74ba3d0e175d6e1add0012ce599d5c6ea96afe69e452`. Luna의 정적 패키지 확인은 단일 폴더809파일, root manifest808/source201/runtime16/identity217 일치와 정확한 변경 범위를 기록했다. 이는 코드·런타임 의미 검증이 아니다.

Sol은 Windows Node24.19.0에서 신규 branch/coverage/보호/길이 경계 등의 **선택13/13**을 통과했다(fail/cancel/skip0). 전체 suite나 실제 Cloud/AI를 검증한 결과는 아니다.

Cloud Node22.16.0은 클린 설치·부모/continuity check/build, 신규25/25·기존 관련31/31·보호 연결7/7을 통과했다. mock 최초20→후속8·완료 resume 추가송신0,child 수신body와 기록hash, wire32768/raw response131072 경계를 확인했다. 새 PLAN 전체본문 deadline의 실제 벽시계 검사는60040ms에 AI_TIMEOUT·child 종료·추가송신0이었으며 실제 외부 호출은0이다. 전체 mock 흐름의 간격은 모의 시계라 실호출 간격으로 해석하지 않는다. source/runtime/identity·기존 wrapper와 T1/0254630파일 불변을 확인했다. 해당 무상 기술 JSON의 task/집계와 최종 보고를 대조했으며 다른 단계의 오래된 자료를 결과로 쓰지 않았다.

총괄은 위 결과를 **실험 실행 준비로 수용**했다. 의미 추출·내용 품질·제품 승격 수용은 아니다. Cloud에 새5상황 × DIRECT025/PLAN026 × OFF/ON-high의 **최초20회만** 실제 실행하도록 지시했다. 실제 최초 비교는F01의2회 송신에서 중단됐다. DIRECT025-A1회는 앱 수용, PLAN026-A1회는 provider HTTP200·deepseek-flash·finish stop였지만 **앱HTTP502·PLAN_LINK_INVALID**로 거절됐다. 최초20중18은 미실행이고 후속최대8은 미배정이다. 재시도·후속 동결·후속 호출0, F02의4bucket 모두 미착수로 실제 질문·최종8키가 없고match=null이다.

정확한 진단 자료를 회수했고 Luna가5개 CONTENT의 바이트·지문을 확인했다. 실제 송신 system에는 이미 named 제약을 관련 work.constraintIds에 연결하라는 지시가 있었다. 모델은 현행 완료·메모 수정 방식의 named preserve2개를 선언했으나 해당 work의 constraintIds는 비어 있었고, checks에는 완료 표시가 변하지 않는다는 문장이 있었다. 일부 의미 표현과 명시적 연결은 별개이며 **관측한 실패는 구조 계약 위반**이다. 지시가 아예 없었다는 설명은 맞지 않지만 계약의 고객 효용·표현의 최적성이나 구조 방식 전체의 실패를 확정한 것은 아니다. Sol의 최종 원문 검토는 아직 대기다. 실패 내부 plan은 성공 blind 표본으로 넣지 않는다.

**QUALITY027 제출본을 회수했다.** named 제약이 `appliesTo`에서 지정 workIds 또는 명시적인 retained reason을 소유하고 작업별 연결은 코드가 역으로 파생하는 후보를 구현했다고 보고했다. `work.constraintIds`는 제거하고 내부 계약을 `quality027.work-plan.1`로 분리했다. retained는 작업 없는 한정 보존을 설명하며 새 편집/검수 작업을 자동 생성하지 않는다. 그러나 모델이 관련된 제약을 잘못 retained로 분류하는 의미 오류까지 보장하지 않는다. validator 제거·모든 제약의 전역 부착·기존026 raw 자동 수리가 아니다.

Luna 정적 패키지 확인은 manifest335/source210과026 대비199불변·2수정(plan-codec/generation)·9신규lab/검사·삭제0을 통과했다고 보고했다. 작성자는 runtime16동일, 신규25(10+8+7)·관련HTTP11·check/build 통과를 보고했으며 npm ci 없이 설치된 동일 컴파일러를 사용했다. 이 수치는 독립 런타임·Cloud 통과나 실제 계약 준수율·품질 개선 증거가 아니다. ZIP SHA256은 `f95dc82b67f7f8e2cc41b76a7d47fca9cb6fc3d6a345ddb2c933916e56eb9e67`, source manifest는 `1864b9b21e199a9a65bfd2f12d324bb62784a0f3a45cf3601300263b3189febb`다.

Sol의 좁은 독립 리뷰는 선택9검사 통과·실호출 차단 결함 없음으로 완료됐다. retained가 scope/next/checks와최종 handoff에 남는 것을 확인했지만 관련 제약을 retained로 오분류하는 의미 오류까지 검증한 것은 아니다.

Cloud Node22.16.0/npm10.9.2/TS5.8.3에서 클린ci·부모/continuity check/build, 신규25·기존HTTP11·연결7을 통과했다. mock20+8·완료resume 추가0,child 수신body/기록hash와 appliesTo 투영·보호/observer 오류 차단을 확인했다. 원래026 failed frozen/run은027에서 **0송신으로 거절**했고source210/runtime16/identity·wrapper·기존7051파일은 불변이다. 초기 외부 helper의 숫자 속성 표기 문법 오류1건은 helper만 수정하고 최초 실패 로그를 보존했다. 제품·기존 검사·wrapper는 수정하지 않았다. 간격은 모의 시계이며 불변wrapper의026 deadline60040ms·abort313ms 증거를 재사용하고 다시 실행하지 않았다. 이 무상 단계는 실제AI/키 접근0·paid=false·live frozen/run 미생성이었다.

준비 수용 뒤027 최초 실호출은F01의 **2송신·1수용·1실패**에서 중단됐다. PLAN027은provider HTTP200/stop 뒤앱의 `PLAN_SCOPE_CONFLICT`로 거절됐고 최초18미실행·retry0, 종료paid=false다. 실패run은 보존하며 재개하지 않는다. Cloud는 goal이context binding을 참조했으나validator가모든goal참조를deliver로 요구했다고 보고했다. 실제 실패 내부plan·wire 원문은 아직 회수하지 못해 전체 원인을 확정하지 않는다. Sol 예비 코드검토는prompt의 ‘deliver1개 이상’과validator의 ‘전부deliver’ 허용집합 차이를 확인했지만 실제goal에deliver도 있었는지는 미확정이다. 무상검사 통과가 실제 생성 안정성·의미 품질을 입증한 것은 아니다.

사용자는 좁은 오류 패치를 이어가는 흐름에서 벗어나 목적부터 다시 판단하도록 정정했다. 단일 호출·현재계약·이전 기능 구상은 다음 설계를 가두는 필수조건이 아니다. 실제OSS 핵심코드·검사·이슈와 분야 밖 메커니즘을 읽어 재사용·삭제·교체할 작은 단위를 판단한다. 대시보드·그래프·실시간연결·로그감지·모델/effort자동조절은 가설이며 필요 없으면 버리거나 합치고 제품형태도 재검토한다.

**ARCH028-A/B는 조사·설계·분리된mock 시연을 완료했다.** 실제OSS 코드/검사와 다른 구조를 검토했지만 실AI 내용 품질이나 고객 효용을 입증한 결과는 아니다. 총괄은A형 **현재 작업카드 + 작은 읽기전용 의미 검토**를 별도FLOW029 첫 후보로 선택했다. 이는 첫 비교 후보이며 최종 제품 구조로 확정한 것이 아니다. B의 원문 보존 원칙은 재사용하되 문장 분류→writer를 함께 쌓지 않고 A의 대안D도 동시에 통합하지 않는다. 한 카드가 나머지 원문을 지우거나 과거 조건을 현재 전역 조건으로 강제하지 않아야 한다.

**FLOW029 제출본을 회수했다.** baseline184불변 + `app/flow029`32추가 =216소스이며 ZIP SHA256은 `fa57be7d71dd9c9845e1251aa1ee80bac0893a3e18e287847dbc655d2f8037b4`, source manifest는 `00534737cdc1df20bbe59b4d35cb195a9427a84477add82bfa6a2bbf3ed8ecd3`다. 작성자의Node200·DOM10+legacy1 통과 보고는 독립 수용이나 실AI 품질 검증이 아니다. Cloud가 비용 없는 clean/native/mock 검증을 시작했고 결과는 아직 미확인이다.

Sol 좁은 독립 검토는 두 결함을 합성 입력으로 재현했다. **R1:** JSON escape를 파싱한 뒤 복원된 키 반향이 후보·보존 기록으로 넘어가는 차단 누락이다. 합성 키만 사용했으며 실제 키 노출·실호출은0이다. **R2:** confirmed 기준을 변경한 뒤에도 이전review 질문/지적을 현재 선택으로 사용한다. 옛 지적은 이력에 남기되 현재 질문과 답변 적용에서 freshness를 확인해야 한다.

총괄은Pro에 **FLOW029rev1 두 건만 수정**하도록 배정했다. 원본 후보 수용과 실AI 비교 진행은 보류한다. 기존DIRECT·단순Markdown과 재설명/수정/미정확정 문제를 비교하는 방향은 유지하며 검토 통과를 의미·실행 검증으로 승격하지 않는다. 수정 제출·독립 확인·Cloud 결과는 아직 없다. 수용 제품IDEA022 + UI001 rev1과026/027 실패 기록은 그대로다.

별도 Claude의 **FLOW029-CASES**는4개 가상 고객 에피소드(public2/holdout2)를 완료·회수했다. INPUTS와ORACLE을 분리하고 구현자에게공개2개만 제공한다. 인간 사용성 실험이나미공개 모델 검증 완료라고 주장하지 않는다. Cloud는 구현 회수·검토 뒤 검증할 다음 단계다. 새 실AI0, 제품IDEA022 + UI001 rev1 및026/027 실패 기록은 유지한다.

FLOW029 기준은 정확 수용commit `c2d03e816a8a6cb4731f8142b19e091b70a96408`의184파일 export다. baseline ZIP SHA256은 `382cedeaf38c884dbcdda594ec795636089cedb31d2a3966bc179487dd1abde3`, SOURCE_MANIFEST SHA256은 `f605954bc71913b99994936e2c10a13a06254572f77d2a0d9f4b39be52dc0200`다. Cloud 통합snapshot의 `11ac3176493bf02a15e681a31c6a12ca4e4bd7487c5d505019fceaf6941691d1`와184중181blob은 같지만 `.github/workflows/verify.yml`, `docs/START_HERE.md`, `docs/PROJECT_STATUS.md`의3공유 메타파일은 게시 시 갱신돼 다르다. 따라서 전체manifest가 같다고 주장하지 않고 export의 실제manifest를 구현 기준으로 사용한다.

입력·body hash·상태 보존과 승인 source201/runtime16/보호 해시, 기존5395파일 불변을 확인했다. 실패 원장·claim·원문은 보존하고 종료paid=false를 복원했다. Cloud의 기존 raw 진단 회수를 완료했고 추가 AI 호출은 없다. 무상mock 검증 통과 이력은 유지하되 실호출 실패를 통과로 바꾸지 않는다. 모드/생성 방식의 우열·의미 품질·제품 승격은 판단하지 않는다.

## 다음 실험안

새5입력 × DIRECT025/PLAN026 × OFF/ON-high = 최초20회, 실제 질문과 허용 답이 맞을 때만 조건부 후속 최대8회, 총 최대28회를 제안했다. **최초 계획20중2회 뒤 실패로 중단했고18미실행·후속8미배정이다.** 최초 입력은 같은 바이트의 대조이고 후속은 실제 앞 응답 상태에서 이어져 같은 바이트의 쌍이 아니다. 두 단계를 합쳐 단일 개선률로 계산하지 않는다. 질문 없음·답 불일치는 미실행으로 남기며 남은 슬롯을 채우지 않는다.


## 실사용 근거 우선 정정과 RESEARCH030

공식 기능 문서만으로 실사용 문제가 해결됐거나 제품 기회가 없다고 추론한 총괄 판단을 정정한다. 기능 존재·지원 설명과 실제 개발자의 성공/실패·반복 노동은 별개다. 최근 원글·독립 반복 보고·성공 반례·OSS 핵심 코드/검사로 사용 맥락과 해결 범위를 확인하고, 원문 접근 한계와 설계 가설을 구분한다. 결정 변경 관리·FLOW029 카드뿐 아니라 기능 분할→의존성→맞춤 작업 구조→실행/재계획도 비교 후보이며 어느 쪽도 최종 정답으로 고정하지 않는다.

Pro RESEARCH030-A1의 사용자 조사는 아직 최종 결과가 없고 후속은 원글3~5개씩 작은 배치로 진행한다. Claude RESEARCH030-T 제출ZIP(SHA256 `f71014eb418ad66a71d9599825d63cb1c079741e3dd8bcaac253e95a061d45c4`)을 회수했다. 기술 발견은 가능한 후보의 근거이며 유일한 방법·불가능성·시장 효용·미래 로드맵을 확정하지 않는다. 별도 Claude에 regulus PR102/happy1759 두 원문 중심으로 적용 조건과 과잉 결론을 정리하도록 배정했다. 실제 계정정보·키·설치실행·실호출·제품편집은 없으며 원문/ZIP은 공유 저장소에 게시하지 않는다.

이번 공유는 설계 결정·정정·현재 인계 요약뿐이다. 원문/operator·추론·개인 자료·ZIP·제품 후보 소스를 게시하지 않으며 CI·main·PR 설정·병합·배포는 변경하지 않는다.
