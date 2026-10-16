# PC 지도 공간13 결과
2026-10-16 판단. 현재 진행·제품 통합 위치는 [ACTIVE](../ACTIVE.md)를 본다.

## 수용 범위
전체 공간에서 목적·기록·영역 추가가 지도를 밀어내던 문제를 줄였다. 목적은 한 줄과 전문 펼침, 기록은 실제 종류·건수가 보이는 펼침, 영역 추가는 명시적 펼침으로 바꿨다. 지도 옆 선택상세와 제품12의 읽기→명시 편집→지도 복귀는 유지한다. 정상 안내가 있을 때 도구가 첫 화면 아래에 놓이는 독립 발견을 fix1에서 PC 도구 상단 배치로 보완했다.

최종 제품 소스는 `606120500eeea50a20f00fb4678bced7a7d93d98`, [PR #4](https://github.com/tlsee0813-cmd/agentflow-studio/pull/4). source/domain/server/deps/schema를 넓히지 않았다. 기본 v0는 기존 제품12 기준6파일, fix1은 그 위 CSS4줄과 검사 변경이다. [병합 60c42c2c](https://github.com/tlsee0813-cmd/agentflow-studio/commit/60c42c2c2886ae7cd3f40c0cd895cadc937a2f57)로 checkpoint의 실제 app 소스에 통합했다. main/공개 체험판 배포와는 구분한다.

## 확인 근거
- [작성자 v0](https://github.com/tlsee0813-cmd/agentflow-studio/tree/cc5a54ae067217c3abd1c8ef81b5b3034412e63b/docs/transfer/pc-map-space-13/author-v0), [작성자 fix1](https://github.com/tlsee0813-cmd/agentflow-studio/tree/827f029e0dab79b48ebe8818fb15d32db7ed8d06/docs/transfer/pc-map-space-13/author-fix1): 고정 diff와 실패 검사 원본 보존. fix1 pc13 14·pc12 15·flow090 18 테스트와 정적/빌드의 실제 child 종료0. 단순 condition 행 수를 테스트 수나 독립 관측으로 합산하지 않았다.
- [v0 독립 결과](https://github.com/tlsee0813-cmd/agentflow-studio/blob/709dab4d730c87b44e1a08a1cddd0cb9832b807a/docs/transfer/pc-map-space-13/independent-v0/REPORT.md): 네 초기 장면 지도 가시 높이49.62–61.78%이지만 안내 시 도구 접근 실패를 발견했다.
- [fix1 독립 결과](https://github.com/tlsee0813-cmd/agentflow-studio/blob/77a0d39571ce371271dbd0adf0020aaade7b64be/docs/transfer/pc-map-space-13/independent-fix1/REPORT.md): 같은 강화 도구 검사에서 v0 고정8장면 중6실패·child/collector1, fix1 8장면 통과·child/collector0. 안내+기록펼침+선택상세와 긴 내용 표본에서 box/clip/hit, 실제 축소·확대·맞춤의 배율/기하와scroll0을 확인했다. 의도적 맞춤은 이전 보기 복원으로 세지 않았다.
- 독립 대표 복귀4경로에서 두PC의 R 편집 유지·RB→A, 해당 수동4필드·미전송·명시B·출발보기/초점이 유지됐다. 기존 제품12 전체 변형을 다시 모두 실행한 것은 아니다.
- 최종606 기준 [Windows·Ubuntu CI](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/38859480655) 둘 다 성공. Code Review 도구로 해당head를 확인했다. 두 annotation은 기존 upload-artifact의 Node20→24 전환 안내이며 테스트 실패가 아니다.

## 남은 조건과 판단
원래 계약의 ‘선택 후 선택 카드 자체 접근’ strict 조건은 여전히 실패다. 패널을 열면 오른쪽 선택 카드가 지도 밖으로 가는 기존 한계다. 패널의 대상 설명·닫기·복귀 통과와 이를 혼동하지 않는다. 폭 미리 예약안은 첫 카드 배율을1280에서92→61%,1440에서108→77%로 줄여 철회했다. 자동 맞춤·새 찾기 기능까지 이번 좁은 수정에 넣지 않았다.

따라서 **원래 모든 합격 조건 완료로 선언하지 않으며, 첫 화면 공간과 도구 접근 개선을 한정 수용한다.** 선택 대상과 전체 맥락을 함께 보이는 경험은 다음 제품 판단에 남긴다. 제품12보다 나아진 범위를 통합하고 기존 한계를 숨기지 않는 결정이다. 임의로 긴 내용·임의 pan/zoom 전부를 보장하지 않는다. 실제125% 확대와 독립 전체390 모바일은 이번 미실행이며 CSS760/761 관측과 구분한다.

[Dify 실제 비교와 외부 검토 수용](REVIEW_DECISION.md)에 따라 공간을 중심에 두고 선택한 부분을 상세에서 읽는 원리를 채택하되400px overlay나 초점 손실을 복제하지 않았다. 별도 사람 사용 기록 제출을 추가 관문으로 두지 않는다. 안내·오류는 유지했다.

## 다음 연결
[입력14](../2026-10-16-session-input-14/RESULT.md)는 실제 배정·반환을 기존 공통 지도에 넣고 후속fix1도 같은 부분으로 대응했다. 자동 추출·사용자 수정과 새 입력 병합은 아직 없고, URL 재로딩 때 선택이 초기화되는 공백을 확인했다. C11 URL 교체는 기존에 지원한 실시간 갱신의 실패가 아니라 미구현 경계다. 다음에는 실제 제품의 기존 보고 연결 경로에서 기록 추가·사용자 수정·보기 복원을 함께 시험한다. 자동 영역 설명 갱신과는 구분한다. 연구 설명·검사 배지를 제품 기본 화면의 읽을 거리로 그대로 늘리지 않는다.

## 체험 자산
[고정606의 정적 빌드 자산·출처](https://github.com/tlsee0813-cmd/agentflow-studio/tree/fd7bb35125a483d9699508bb35528ca1f4305d85/docs/transfer/pc-map-space-13/independent-fix1/preview)를 공유했다. 로컬 기존 서버에서는 `http://127.0.0.1:8765/product13-preview/runtime/index.html`로 열 수 있다. 공개 배포가 아니며 기존 제품12와 같은 origin의 브라우저 저장소를 공유한다. 이번 전환에서 백업 가져오기나 기존 자료 초기화를 하지 않았다.
