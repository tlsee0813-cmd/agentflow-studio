# 프로젝트 홈15 결과
2026-10-16. 당시 판단 기록. 현재 진행은 [ACTIVE](../ACTIVE.md).

## 판단과 사용자 흐름
왼쪽 프로젝트 탐색 → 실제 목적이 보이는 카드 → 해당 프로젝트의 전체 공간 → 같은 카드로 복귀하는 흐름을 실제 제품에 구현했다. Dify Studio의 카드 밀도·상단 여백·탐색 구성을 참조했다. Dify의 실행 워크플로 설정 기능과 AgentFlow의 구성·변경·인계 지도 목적은 구분한다.

기존1440 홈의 첫 카드 y231.55/폭960 단열 행에서, 새 홈은 양PC 첫 카드 y104·높이176·3열로 바뀌었다. 1280 폭323.3,1440 폭354.7,간격16이다. 프로젝트1개도 같은 칸 폭을 유지하며0개에 가짜 카드를 만들지 않는다. 이름과 실제 `space.brief.text`가 우선이고 마지막 요청을 목적이라고 표시하지 않는다. 활동 시각은 기존 원문/내보내기 범위임을 나타낸다.

사이드바222px는 목표224~240의 예외로 총괄이 수용했다. 홈만 넓혀 프로젝트 진입 때 폭이 달라지거나 기존 공간13 폭을 바꾸는 것보다 일정한 탐색 폭이 낫다고 판단했다. 관리 메뉴는 별도 동작, 불러오기·예제는 보조 위치다.

## 고정 구현과 독립 확인
제품 후보 `1e51f0f9b56ed51e9ec4c529ca518aa256ad1ecf`, [PR #5](https://github.com/tlsee0813-cmd/agentflow-studio/pull/5). 제품7파일+HOME15 CI1파일. 저장 schema/server/provider/의존성 변경은 없다. 목록 진입은 전체 공간을 열며 Task/currentTaskId·수동 문장·미전송 초안을 바꾸지 않는다. 프로젝트별 지도 보기 기억과 목록 복귀 초점·스크롤을 연결한다.

- [작성자 원본17파일](https://github.com/tlsee0813-cmd/agentflow-studio/tree/2ed5a41bb4b7c8f36173bb81312fab498e186e42/docs/transfer/project-home-15/author-v0): 고정diff,보고,원시기록,대표PNG4. 정확606 소스에 offset 없이 적용하고7개 target blob을 대조했다. 작성자 결과는 독립 결과와 구분한다.
- [독립 실행](https://github.com/tlsee0813-cmd/agentflow-studio/blob/32252b6e7aafd6e727777940b58455ce5640880d/docs/transfer/project-home-15/independent-v0/REPORT.md): check/build4명령과 기존HOME15검사15개 실제exit0. 추가독립10장면의 child/collector/result각0. 초기 URL/fixture ID/selector 검사기 오류를 최종장면에 합산하지 않았다.
- 독립1280/1440에서 A/B/A 목적·저장 envelope불변, 실제두영역사각형·matrix일치를 확인했다. 20카드목록의 wheel→진입→복귀는 y848→848,668→668,호출카드초점복귀였다. 이름버튼Space와더보기summary Space/Escape도 직접실행했다. 선택 관측은 해당장면의일치이며 모든 선택상태복원정책의증거가 아니다.
- [별도 세션 최종 검토](https://github.com/tlsee0813-cmd/agentflow-studio/blob/c4794595fed57dd82dbda970d85c56fc5ea37e48/docs/transfer/project-home-15/independent-v0/REVIEW.md): 작성자/독립PNG각4장과코드·원시자료를 보고 현재범위수용,차단결함없음. 이 세션은 직접실행하지 않았고 준비된기존환경이실행했다. Sol코드검토도 기존 저장·복원·경합검사의 보호조건 제거를 찾지 못했다.
- 총괄은 작성자PNG4와 독립1280six를 직접보고 정보위계와비율을 수용했다. 단순 검사숫자가 아닌 실제화면과동작을 함께판단했다.

## 대표 화면
![독립1280 프로젝트 홈](https://raw.githubusercontent.com/tlsee0813-cmd/agentflow-studio/32252b6e7aafd6e727777940b58455ce5640880d/docs/transfer/project-home-15/independent-v0/independent/1280-six.png)

## 남은 보완
긴 공통 접두사가 같은 프로젝트들은 두 줄 생략 때문에 끝의 구분 문구가 숨을 수 있다. DOM/title/aria-label에 원문이 있다는 것으로 화면에서 키보드로 읽을 수 있다고 주장하지 않는다. 원문 손실·잘못된 연결은 없고 진입 후 전체확인이 가능해 이번 홈전체의 차단사유로 삼지 않았다. 다음 좁은보완은 **진입 전 전체 이름·목적 읽기 → 같은 카드초점으로 닫기**다. 기본카드밀도를 유지하고 키보드/포인터 양쪽에서 확인한다. 새 관리화면이나 연구목록을 늘리는 작업이 아니다.

제품13의 선택 카드 자체 접근 strict실패, GUIDE107 실제AI HOLD는 이번 홈으로 해결되지 않는다. 실사용자료·브라우저125% 확대·모든 경합/오류 경로·대규모목록을 전부 검증했다고 하지 않는다. 사용자의 Dify 실제대조기준을 따르며 사람사용기록 제출을 추가필수관문으로 만들지 않는다.

## 주제별 협업
[새 Pro 홈연구](https://chatgpt.com/c/6ad1cae0-2da4-83e8-a0c3-8699e2a84be1), [새 Opus 홈구현](https://claude.ai/chat/af32916c-7f77-418c-9955-fcdb2d2a1995), [새 Cloud 홈검토](https://chatgpt.com/c/6ad1cb08-d8b8-83e8-95f2-e2b1a1327fe8)를 분리했다. 보고 해석 연구와 홈 구현을 같은세션에 섞지 않았다. 새Cloud의 브라우저설치가 정책으로막혀 준비된환경은 실행만 담당하고 새세션은독립판단을 맡겼다. 총괄이 계약·예외·증거·남은위험을 통합했다.

## 통합과 체험
[PR #5](https://github.com/tlsee0813-cmd/agentflow-studio/pull/5)를 checkpoint에 병합했다: `168d47ff6e4cca6596b6d3c7306921b8544c14f6`. [Windows·Ubuntu 동일 후보 CI](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/38867405596)가 모두 성공했다. 공통 경고는 기존 artifact 업로드 action의 Node20 런타임 지원 종료 안내이며 제품 검사 실패가 아니다.

[새 PC 체험](http://127.0.0.1:8765/product15-preview/runtime/index.html)은 [고정 static overlay](https://github.com/tlsee0813-cmd/agentflow-studio/tree/32252b6e7aafd6e727777940b58455ce5640880d/docs/transfer/project-home-15/independent-v0/preview)를 기존 최소 runtime에 연결했다. 15파일428,631B의 HTTP 내용이 빌드 해시와 일치했다. 총괄이 기존 프로젝트 카드→전체 공간 제목초점→목록 같은카드초점을 직접확인했다. 자료 자동주입/초기화는 하지 않았다. 같은8765 origin의 기존저장소를 사용하는 로컬MOCK이며 공개배포·실제AI가 아니다. main/gh-pages와GUIDE107 HOLD는 유지한다.
