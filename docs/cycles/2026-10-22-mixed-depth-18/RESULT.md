# 실제 포함 구조와 PC 작업공간18 — 결과

2026-10-22. 판단 대상은 product/mixed-depth-18 → checkpoint/2026-10-15의 제한된 제품 통합이다. 현재 진행 상태는 [ACTIVE](../ACTIVE.md)에서 관리한다.

## 사용자가 이어갈 수 있는 흐름
같은 프로젝트 지도에서 한 구성만 더 세분화하고 다른 부분은 크게 둔다. 가지를 접어도 하위의 기록된 질문과 설명 갱신·보류를 구분해 찾고, 실제 관계 끝점의 현재 설명을 읽는다. 그 정확한 부분에 새 요청과 인계를 만든 뒤 출발한 지도·선택·읽기 위치로 돌아온다. 부모 참고는 자식의 실행 조건으로 자동 상속하지 않는다.

기존 프로젝트 홈·지도·사용자 구상·설명 수신·작업문·명시 복귀를 재사용했다. 두 입력을 같은 제품 renderer에 적용했으며 사례별 HTML을 추가하지 않았다. 프로그램 포함과 작업의 이어짐을 분리한 Space.containment, project.7 및 새 anchor/plan 변형을 사용하고 기존 원문·anchor.1·return.1/2를 보존했다.

## 수용 판단
계약18의 제한된 제품 흐름을 수용했다. 최종 후보의 양OS CI, 정확 작성자 검사의 독립 재실행, 별도 사용자 경로와 공유 화면을 대조했다. 검사 성공을 전체 UI·AI 품질 완성으로 확대하지 않는다.

정확한 제품 후보 73fd6ff82ca035dd9b2e74385ce9194db0b57791, tree a029049fdee6b060bd5d0a90ea1f9ff7f62fc37e. [PR9](https://github.com/tlsee0813-cmd/agentflow-studio/pull/9). checkpoint 통합 ca162c0cef05e18dcc0931b216a516083406b092. main·gh-pages·공개 체험판은 이 사이클에서 변경하지 않았다.

## 검증을 합산하지 않는 이유
| 구분 | 최종 관측 |
|---|---|
| 정확 후보 CI | [39778069480](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/39778069480), Ubuntu·Windows 모두 completed/success. Code Review 반환 로그는 120000자 tail이며 logTruncated=true |
| 독립 Cloud 환경·소스 | Node22.16 / TS5.8.3 / Playwright1.57 / Chromium154, 소스188파일 실행 전후 동일, app SHA256 B5A6FDE628584D85097840B61EBF918F2E609FF08B060BC540F72A4EF2695C4A |
| 독립 환경의 정확 작성자 script | PC13 14/14, H18 12/12, AREA17 12/12, PC12 15/15, HOME15 21/21, REPORT16 13/13, static1/1. 각 종료0. 단위261/261, 타입·빌드·정적 빌드 성공 |
| 별도 독립 경로 | 두 재서술 입력×두PC 4핵심흐름, 긴 패널·다중 요청·질문/시험답·목록왕복·Escape·최초 camera와 사용자 보기 보호가 각 probe 범위에서 성공 |
| 정확 실패 반례의 재검증 | 정보 버튼 가림4종×두PC8장면의 실제 hit 성공. 1440 RB-A 복귀는 같은 본문 크기에서 scroll128→128, 호출행 y차이0, 초점·3점 hit 정상 |
| 정적·화면 대조 | Astra 최종 복귀/H18 검사 검토에서 해당 범위 추가 결함 없음. 총괄이 최종 RB-A 복귀와 1280 실제 자식 PNG 및 실패 전후를 직접 대조 |

[최종 독립 원본](https://github.com/tlsee0813-cmd/agentflow-studio/tree/479658cc6748b7755b1423a9ef524e0b1b9c922d/docs/transfer/mixed-depth-18/independent-fix4) · [정확 CI 자료와 총괄 수용](https://github.com/tlsee0813-cmd/agentflow-studio/tree/c213ad7886183a00ca39ab2f69d467c5a32ef021/docs/transfer/mixed-depth-18).

초기 추가 진단 수집기는 성공 후 닫힌 패널을 다시 읽어 timeout/exit1이었다. 정확 작성자 PC13 전체 검사는 별도로 성공했고 RB-A 진단을 동일 단언으로 재수집해 exit0을 확인했다. 초기 수집기 전체가 성공했다고 바꾸지 않는다. 초기 수집 스크립트의 실행 시점 해시는 없고 이전본에서 재구성한 제한을 원보고에 남겼다. 전체 console 수집은 수행하지 않았다.

작성자 테스트 수, 도메인 단위 수, 독립 사용자 경로 수, 화면의 표본 hit 수는 서로 다른 관측이다. 이를 하나의 합격 숫자로 합치지 않는다. Node24 로컬 검사는 보조이며 실제 브라우저 검증은 승인된 Cloud에서 수행했다. 총괄은 공유 PNG와 코드·원본 자료를 대조했으며 로컬 제품 브라우저를 실행했다고 주장하지 않는다.

## 실제로 찾아 수정한 것
- 기록된 실제 질문에 시험 답변을 붙일 때 질문이 사라지는 결함을 고쳤다. 시험으로 만든 질문과 원래 요청의 질문을 구분하며 시험 답변을 실제 결정으로 승격하지 않는다.
- 프로젝트 목록을 거쳐 재열 때 숨은 이전 DOM이 읽기 위치를 덮는 문제, 조합 중이거나 내부에서 소비한 Escape가 전역 닫기를 실행해 초점을 빼앗는 문제를 수정했다.
- 새 요청 뒤 원래 보고 목록행이 정상적으로 사라져도 살아남은 실제 호출행을 기준으로 복귀하게 했다.
- PC 지도 맞춤 도구가 정보 버튼을 가리는 네 장면을 재현해 실제 도구 점유 공간을 맞춤에 반영했다. 최초 보기만 최종 치수로 맞추고 기억하며 사용자 카메라·수동 좌표는 바꾸지 않는다.
- 기록 목록을 펼친 채 RB에서 A를 이어 수정한 뒤 돌아오면 호출 버튼이 footer에 가렸다. 동일 장면은 본문 크기가 같고 scroll128→70, 호출행58px하향이었다. 중간 렌더의 clamp는 코드 순서에서 추론했으며, 펼침·페이지 위치·작업공간 높이를 모두 확정한 후 원본 읽기 메모를 복원하도록 바꿨다. 서로 다른 R-edit/RB-A 장면의 높이를 동일 전후로 비교한 초기 설명은 정정했다.

검사 자체의 보완은 별도로 기록했다. 구schema/문구 기대값, 구형 바깥 페이지 휠 대신 실제 패널 본문 휠, 새 hierarchy.js의 정확 허용 목록, Windows 클립보드의 원문 보존과 CRLF 쌍 비교 정규화, 숨겨진 work-view 아래 context의 보존된 열림 상태와 실제 표시 구분이다. 실제 클릭·초점·입력·저장값·복귀 조건을 제거해 통과시키지 않았다.

[fix3 원본·정확 실패 전후](https://github.com/tlsee0813-cmd/agentflow-studio/tree/ebcd3947032000bdce086469f695ec884a71db06/docs/transfer/mixed-depth-18/independent-fix3) · [fix4 변경과 독립 정적 검토](https://github.com/tlsee0813-cmd/agentflow-studio/tree/25923ec6cb524648c1f1600bd753953809c56a58/docs/transfer/mixed-depth-18). 앞선 실패도 GitHub에서 회수할 수 있다.

## 표본과 제품 경계
PowerToys와 내부 제품13 원자료를 분석자가 재서술한 두 입력이며 원프로젝트의 실행 검증은 아니다. 포함 계층과 합성 질문·긴문자·반대방향 등의 배선은 출처를 구분했다. 임의 작업 로그에서 구조와 의미를 자동 추출하는 엔진을 완성한 것은 아니다.

현재 부모는 한 개이며 공유 부분은 관계로 참조한다. 자동 전체 배치, 무제한 대형 지도, 일반 개발 미결의 자동 판정, 마지막 열람 이후 추적, 다른 탭의 실시간 갱신은 이번 수용에 포함하지 않는다. 실제 OS IME·사람 연구·유료 AI 품질도 미검증이다. CDP 조합 이벤트와 명시 합성 key dispatch를 실제 OS IME로 표현하지 않는다.

## 총괄 화면 판단과 다음 범위
Dify에서 작업면과 선택 상세의 역할 분리, 고정 행동과 본문 스크롤 원리를 참고했지만 목적이 다른 실행 워크플로를 복제하지 않았다. 사용자 기준에 따라 Dify 메커니즘 비교를 사용하며 사람 사용 기록을 추가 관문으로 요구하지 않는다.

고정 상세 행동과 실제 포함 탐색이 연결됐어도 전체 UI가 Dify 수준으로 완성된 것은 아니다. 작은 PC의 프로젝트명·목적·관리 버튼 중복과 펼친 기록 목록이 지도 위 공간을 많이 차지한다. 다음은 새 메커니즘을 늘리기보다 **홈 → 지도 → 한 부분 → 요청/인계 → 복귀**의 같은 흐름에서 상단 맥락과 기록 읽기의 공간 점유를 줄이는 좁은 개선이다. 목적 원문·저장 실패·자료 보류 등 판단에 필요한 정보는 접근 가능하게 유지하고, 기존 카메라·읽기 위치·입력 보존을 다시 확인한다.

## 다른 세션에서 회수 가능한 대표 화면

![1280 PC에서 실제 자식 선택과 고정 행동](https://raw.githubusercontent.com/tlsee0813-cmd/agentflow-studio/479658cc6748b7755b1423a9ef524e0b1b9c922d/docs/transfer/mixed-depth-18/independent-fix4/ui/1280-actual-child.png)

![1440 PC에서 편집 후 실제 호출행으로 복귀](https://raw.githubusercontent.com/tlsee0813-cmd/agentflow-studio/479658cc6748b7755b1423a9ef524e0b1b9c922d/docs/transfer/mixed-depth-18/independent-fix4/pc13-return-diagnostic/pc13-RB-A-edit.png)

원본 이미지·실행 결과는 위 고정 GitHub commit에서 접근할 수 있다. 로컬 경로만 남긴 증거가 아니다.
