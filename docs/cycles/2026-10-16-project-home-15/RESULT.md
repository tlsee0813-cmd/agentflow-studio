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

## 첫 통합 당시 남은 보완
긴 공통 접두사가 같은 프로젝트들은 두 줄 생략 때문에 끝의 구분 문구가 숨을 수 있다. DOM/title/aria-label에 원문이 있다는 것으로 화면에서 키보드로 읽을 수 있다고 주장하지 않는다. 원문 손실·잘못된 연결은 없고 진입 후 전체확인이 가능해 이번 홈전체의 차단사유로 삼지 않았다. 당시 다음 좁은보완은 **진입 전 전체 이름·목적 읽기 → 같은 카드초점으로 닫기**로 정했고, 아래 후속 결과에서 완료했다. 기본카드밀도를 유지하고 키보드/포인터 양쪽에서 확인한다. 새 관리화면이나 연구목록을 늘리는 작업이 아니다.

제품13의 선택 카드 자체 접근 strict실패, GUIDE107 실제AI HOLD는 이번 홈으로 해결되지 않는다. 실사용자료·브라우저125% 확대·모든 경합/오류 경로·대규모목록을 전부 검증했다고 하지 않는다. 사용자의 Dify 실제대조기준을 따르며 사람사용기록 제출을 추가필수관문으로 만들지 않는다.

## 주제별 협업
[새 Pro 홈연구](https://chatgpt.com/c/6ad1cae0-2da4-83e8-a0c3-8699e2a84be1), [새 Opus 홈구현](https://claude.ai/chat/af32916c-7f77-418c-9955-fcdb2d2a1995), [새 Cloud 홈검토](https://chatgpt.com/c/6ad1cb08-d8b8-83e8-95f2-e2b1a1327fe8)를 분리했다. 보고 해석 연구와 홈 구현을 같은세션에 섞지 않았다. 새Cloud의 브라우저설치가 정책으로막혀 준비된환경은 실행만 담당하고 새세션은독립판단을 맡겼다. 총괄이 계약·예외·증거·남은위험을 통합했다.

## 통합과 체험
[PR #5](https://github.com/tlsee0813-cmd/agentflow-studio/pull/5)를 checkpoint에 병합했다: `168d47ff6e4cca6596b6d3c7306921b8544c14f6`. [Windows·Ubuntu 동일 후보 CI](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/38867405596)가 모두 성공했다. 공통 경고는 기존 artifact 업로드 action의 Node20 런타임 지원 종료 안내이며 제품 검사 실패가 아니다.

[새 PC 체험](http://127.0.0.1:8765/product15-preview/runtime/index.html)은 [고정 static overlay](https://github.com/tlsee0813-cmd/agentflow-studio/tree/32252b6e7aafd6e727777940b58455ce5640880d/docs/transfer/project-home-15/independent-v0/preview)를 기존 최소 runtime에 연결했다. 15파일428,631B의 HTTP 내용이 빌드 해시와 일치했다. 총괄이 기존 프로젝트 카드→전체 공간 제목초점→목록 같은카드초점을 직접확인했다. 자료 자동주입/초기화는 하지 않았다. 같은8765 origin의 기존저장소를 사용하는 로컬MOCK이며 공개배포·실제AI가 아니다. main/gh-pages와GUIDE107 HOLD는 유지한다.

## 후속 — 프로젝트 진입 전 전체 이름·목적 읽기

같은 접두사의 긴 이름·목적을 기존 더보기 → **이름·목적 전체 보기**에서 선택·복사하며 읽는다. 기본 3열·카드 높이·두 줄 밀도를 유지했다. 전체 읽기는 실제 저장된 목적을 사용하고 요청 문구로 대신하지 않는다. 읽기만으로 프로젝트·Task·저장을 바꾸지 않고, 닫기/Escape 후 같은 카드 더보기와 목록 위치로 돌아온다.

이 방식은 Pro의 자동풍선/명시창 비교, 현재 메뉴 코드, [WAI 모달 패턴](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)을 대조해 총괄이 채택했다. 긴 글의 선택·복사·키보드 스크롤을 명시창에서 유지하는 판단이다. 같은 접두사 A/B마다 메뉴→읽기→닫기가 필요하므로 카드 자체의 구별 문제가 완전히 해결됐다는 뜻은 아니다. Dify 공개 소스/문서와 직접 조작, 사람 사용성 결과를 구분한다.

### 구현과 실제 결함 수정

[PR #6](https://github.com/tlsee0813-cmd/agentflow-studio/pull/6). 첫 후보 `53d1cb2f1906e6d575f08f4533ac1644a2904894`는 작성자 HOME15 19검사가 통과했지만, 루트/Sol이 닫기 버튼 초점의 스크롤 경계를 발견해 독립 실제 조작에 추가했다. 두 PC에서 PageDown/End가 열린 창 뒤 목록을 y0→272/92로 움직이는 결함을 확인해 통합을 보류했다. 닫은 후 위치 복구는 이 실패를 상쇄하지 않는다.

최종 후보 `a5a48a715c41d1f8ea928af48a33d264c295a128`는 본문 밖 초점의 기본 키 스크롤만 막고, 본문 스크롤과 버튼 Space/Enter를 유지한다. 전역 overflow·기본 카드 배치는 바꾸지 않았다. v1 대비 제품 한 곳과 HOME15 검사만 수정했다.

- [작성자 v1 원본13파일](https://github.com/tlsee0813-cmd/agentflow-studio/tree/a05b9511e302fab0eaff1c5c44a435fe88504808/docs/transfer/project-home-15/author-read-full-v1), [fix2 원본9파일](https://github.com/tlsee0813-cmd/agentflow-studio/tree/10f9863d98c7e9d2a4bf17a02eaa9b87f1a70638/docs/transfer/project-home-15/author-read-full-fix2): manifest·크기·원격 Gitblob/원본 readback 대조. 정확 기준에 offset 없이 적용했다. 새 test10은 수정 전 양PC에서 실패(exit1), 수정 후 HOME15 전체21개 통과(exit0)했다.
- [독립 v1 실패](https://github.com/tlsee0813-cmd/agentflow-studio/blob/66a5abf33bc9ae51f37b45bc8d9f56e81d0edde0/docs/transfer/project-home-15/independent-read-full-v1/REPORT.md), [fix2 재실행](https://github.com/tlsee0813-cmd/agentflow-studio/blob/4d004ca9e7d999230262c6c0152f18f841417a04/docs/transfer/project-home-15/independent-read-full-fix2/REPORT.md): 같은50관측이 46통과/4실패·child/collector1 → 50통과·child/collector0이다. 총괄도 검사 코드가 후보 경로 이외 동일한지 직접 대조했다. 실패4건은 두PC의 닫기 초점 PageDown/End이며 최종값은 배경 y0→0이다.
- 독립 HOME15 21개와 check/build/static build는 각 실제exit0. 별도50관측과 합산하지 않는다. 고정 소스178파일의 전후 해시가 모두 같다. 실제 키·휠·Range/클리핑/hit로 이름·목적 끝의 보임, 다음 카드 내용/스크롤0, 닫기/Escape 초점·Y 복귀, 읽기 저장불변을 확인했다.
- 외부 변경/휴지통/삭제는 격리된 두 번째 탭에서 fixture를 바꿔 닫을 때 덮어쓰지 않음을 확인한 것이다. 모든 실제 사용자 경합 조작을 검증한 뜻은 아니다. 열린 창은 읽기 전용 스냅샷이므로 최신 내용은 다시 열어 읽는다.

- [별도 최종 판단](https://github.com/tlsee0813-cmd/agentflow-studio/blob/60db94126570ebbfbeee7f94f24f5e16d7ea0936/docs/transfer/project-home-15/independent-read-full-fix2/REVIEW.md)이 좁은 후속 범위를 수용했다. 총괄은 작성자PNG2·독립1280 목적 끝 화면과 원시값을 직접 대조했다.
- [최종 동일 후보 Windows·Ubuntu CI](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/38873552364)는 모두 success다. 기존 artifact action의 Node20 지원 종료 안내는 제품 실패와 구분한다. PR #6 병합 `4393fcc77d71b9c51492e8dfd2701545caf17e5c`로 checkpoint에 통합했다.
- [갱신된 PC 체험](http://127.0.0.1:8765/product15-read-full-preview/runtime/index.html): [고정 overlay](https://github.com/tlsee0813-cmd/agentflow-studio/tree/4d004ca9e7d999230262c6c0152f18f841417a04/docs/transfer/project-home-15/independent-read-full-fix2/preview)와 기존12파일로 만든15파일434,670B가 모두 HTTP200·해시일치다. 총괄은 기존 짧은 목적의 한 프로젝트에서 전체읽기·닫기초점 PageDown/End·Space닫기 후 원카드 더보기 초점을 PC1280에서 확인했다. 이것은 독립의 긴목록·긴본문 fixture를 native에서 전부 재실행한 뜻이 아니다. 임시 viewport는 복원했다.

현재 기능은 읽기 전용 스냅샷이다. 실제 AI·스크린리더·125% 확대·임의 모든 키/내용·사람 이해도 완료를 주장하지 않는다. 사용자의 Dify 실제대조를 기준으로 하며 사람 실험 제출을 추가 관문으로 만들지 않는다. main/gh-pages는 유지했고 이 체험은 로컬 정적 MOCK이다.

운영 기록: 브라우저의 [Cloud 최초 준비 대화](https://chatgpt.com/c/6ad1cb08-d8b8-83e8-95f2-e2b1a1327fe8)에는 준비 답만 남는다. 실제 후속 독립 판단은 연결된 Codex 작업 **AgentFlow 홈15 독립 검토**(`01a14381-814b-73fa-8947-03a1fd41008c`)에서 진행했고 위 고정 REVIEW로 공유했다. 두 기록을 같은 브라우저 이력으로 간주하지 않는다.
