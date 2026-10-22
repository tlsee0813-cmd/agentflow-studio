# 29 · 작업문 곁에서 소유 부분 설명 읽기 — 한정 수용·checkpoint 통합
2026-10-23 KST. 현재 상태는 [ACTIVE](../ACTIVE.md).

## 사용자에게 달라지는 흐름
직접 작업문을 고칠 때 필요한 경우에만 그 작업이 속한 부분의 구상·설명을 곁에 연다. 전체 지도나 다음 요청의 선택 대상이 달라도 실제 편집 작업의 소유자를 따른다. 수동 입력으로 기준이 달라지면 현재 인계에 쓰이지 않는 참고라고 알리되 읽던 본문은 바꾸지 않는다.

명시적으로 닫았다 다시 열면 최신 적용 설명을 처음부터 읽는다. 같은 본문을 읽는 동안 새 보고가 도착하면 판본·펼친 근거·읽기 위치는 유지한다. 설명 보기는 자동 적용·실행·완료 판정이 아니며, 이미 있던 인계의 현재성 검사는 그대로다.

최종 후보 [aa0938ec](https://github.com/tlsee0813-cmd/agentflow-studio/commit/aa0938ecbe96ec5fdb15eb4783e865bf7ab70c7b) / [PR15](https://github.com/tlsee0813-cmd/agentflow-studio/pull/15). 변경은 app.ts·styles.css·새 브라우저 검사·CI 실행 단계 네 파일이다. 저장 형식·의존성은 바꾸지 않았다.

## 통합과 자동 회귀 검사

[병합5415b8aa](https://github.com/tlsee0813-cmd/agentflow-studio/commit/5415b8aa5fbf52a738ca833348f7f60247cfdbfd)는 문서 기준 a1774610와 최종 후보 aa0938ec를 합쳤다. 후보와 병합의 app 전체 subtree `540cce055c21c116ce21d7feda35e2ae5dd4a6c9`가 동일하다. main·공개 gh-pages는 이번 통합 대상이 아니다.

정확한 aa0938ec의 CI39849822053은 Ubuntu120072677865·Windows120072677503 모두 성공했다. 각 OS에서 continuity275 통과, 브라우저24묶음238개 Ran/OK이며 새29 검사8개와 기존 AREA17 12개를 포함한다. [최종 CI 요약·원 도구 응답](https://github.com/tlsee0813-cmd/agentflow-studio/tree/ef109d77bb99448b956c0466af3181dcb441b881/docs/transfer/work-reference-29/ci-aa0938). 각 로그는 마지막120000자라 앞부분을 완전한 로그로 주장하지 않는다. Node 실제 버전은 해당 tail에 없고 PW1.57/Chrome143은 설치 기록이다. Cloud 실제154 실행과 구분한다. 업로드 단계의 Node20 종료예정 경고는 각1건이며 테스트 실패가 아니다. 중간 Ubuntu 로그 읽기502는 최종 재조회 성공했고 CI 실패·수동 재실행으로 집계하지 않는다.

## 원실패와 수정
| 실제 발견 | 원자료 | 수정·대조 |
|---|---|---|
| 새 보고 수신 때 같은 설명의 내부 스크롤275→0. 바깥 body0만 보면 놓침 | [fix1 독립 실패](https://github.com/tlsee0813-cmd/agentflow-studio/blob/7f4b1c4503ff22dd76c74f4c9ee4f1497c5ea505/docs/transfer/work-reference-29/independent-a/fix1/REPORT.md) | 참고 본문 안 source-raw의 별도 max-height/overflow를 제거해 단일 스크롤로 정리 |
| 기존 AREA17 요청·복사 뒤 복귀 버튼이 화면 위로 밀림 | [기존27 통과·fix2 실패](https://github.com/tlsee0813-cmd/agentflow-studio/blob/de41f2c25027499797215e84c4252e00c0fc2d85/docs/transfer/work-reference-29/independent-a/fix2/REPORT.md) | 컨테이너를 열린 편집기에만 적용. 단일 CSS fix3에서 원단언 양PC 통과 |
| 같은 긴 설명을 명시 재열기해도 body150 유지 | [정확971 검사6통과·2실패](https://github.com/tlsee0813-cmd/agentflow-studio/blob/e5d5bb1d3c1444ac98133d48a1600908e9705f20/docs/transfer/work-reference-29/independent-a/test-fix2/REPORT.md) | 새 핀만0으로 만들던 누락을 고쳐 실제 열린 본문을0으로 초기화. 같은 검사8개 전부 통과 |

AREA17 원자료에서 대기 표시 제거 때 copy.pageTop이81.5px 줄었다. 기존27·fix3·fix4에서는 windowY215→134, fix2에서는215에 남았다. 복귀 버튼 자체 pageTop161.59375와 닫힌 편집기 높이는 동일했다. 원단언과 제품 JS 복귀 로직을 바꾸지 않은 CSS A/B 범위에서 개선을 확인했다. 이를 모든 브라우저 스크롤 원인이나 기존 origin 소실로 확대하지 않는다. [별도 fix3 결과](https://github.com/tlsee0813-cmd/agentflow-studio/tree/54a5565d5d1f176f7e7d1d9b13c9b165ecd3ae09/docs/transfer/work-reference-29/independent-a/fix3).

원작성자 검사에는 위치0에서 움직이지 않는 휠을 준 뒤 scrollend를 기다리는 준비 오류도 있었다. 가시 영역과 가능한 방향을 확인하도록 고쳤으며 이 준비 오류는 제품 재열기 누락과 구분했다. 기존 CI709e는 양OS 모두 AREA17에서 실패해 신규29 검사까지 도달하지 않았다. [원 CI 근거](https://github.com/tlsee0813-cmd/agentflow-studio/tree/f95118bb19fd3394af3c3e819c0cf2333612b70e/docs/transfer/work-reference-29/ci-709e).

## 최종 후보의 실제 화면
[독립 원문·재현 입력·대표 화면](https://github.com/tlsee0813-cmd/agentflow-studio/tree/212ab682d69f6389354883afffd96be15f3b49a6/docs/transfer/work-reference-29/independent-a/fix4). 정상 UI에서 A/B와 실제 파일용 인계/template을 만들고 명시 합성 반환 자료를 수신했다. 실제 사용자 발언·실제 AI 실행 표본이라고 부르지 않는다.

1280×720·1440×900에서 첫 U 키의 입력 DOM·초점·캐럿·다른 값과 선택 판본을 보존했다. 설명 문장과 N이 같은 화면에서 실제로 보이는 표본을 확인했다. U/N의 안내만30으로 고치고 S/C 실제 보관7·배포 금지는 유지했다. 실제 clipboard 인계의 정확한 A·수동 네 값·오래된 설명 제외를 확인했다. 과거 인계 두 개·원보고·B와 기존 구상·기준은 보존됐다. 전체 실행에서는 정상 후속 요청으로 기준 배열이2→4로 늘었으므로 전체 기준 무변경으로 쓰지 않는다. 관계는 처음과 끝 모두0개라 실제 관계의 보존 검증으로 확대하지 않는다.

마우스·Enter·Space로 명시 닫기/재열기 직후 body/summary[0,0], 닫힌 본문의 실제 숨김과 summary 초점을 확인했다. 반대로 수신 전후에는 body604→604 /567→567, 같은 r2·본문·열린 원문·같은 Range 상대위치를 보존했다. 그 뒤 명시 재열기만r3로 바뀌었다. B가 현재 작업인 채 A를 방문하거나 요청 대상으로 골라도 참고는B를 유지하고, 명시A 이어가기로만 바뀐다.

작성자 합성 fixture 검사8개, 기존 AREA17 두 메서드, 독립 정상 UI 양PC를 별도 실행·집계했다. 각각 child/collector0이며 정상 UI 실패·fatal·pageerror·cleanup은 없다. Node22.16/PW1.57/실제 Chromium154.0.8037.57, 소스196파일과 HTTP30응답의 실제 바이트 연결을 확인했다. reader 서버−15는 의도한 terminate이며 작성자/AREA17 harness의 서버 종료값은 NOT_CAPTURED다.

총괄은 최종1280 복귀 버튼,1280 설명/N,1440 최신 설명 재열기 PNG를 직접 읽었다. 아래 링크는 다른 세션에서도 바로 회수된다.
- [1280 작업문과 선택 설명](https://raw.githubusercontent.com/tlsee0813-cmd/agentflow-studio/212ab682d69f6389354883afffd96be15f3b49a6/docs/transfer/work-reference-29/independent-a/fix4/reader/1280-selected-description-and-N.png)
- [1440 명시 재열기](https://raw.githubusercontent.com/tlsee0813-cmd/agentflow-studio/212ab682d69f6389354883afffd96be15f3b49a6/docs/transfer/work-reference-29/independent-a/fix4/reader/1440-new-description-explicit-reopen.png)
- [1280 복귀 버튼](https://raw.githubusercontent.com/tlsee0813-cmd/agentflow-studio/212ab682d69f6389354883afffd96be15f3b49a6/docs/transfer/work-reference-29/independent-a/fix4/area17/author-raw/area17-1280x720-product13-07-locate-new-request-work.png)

## 한계와 다음 연결
1280 Range 표본에는 줄바꿈·부분 잘림이 있으므로 모든 글자의 가독성 합격은 아니다. 새 보고 파일 수신 뒤 정상 페이지 이동으로 편집 위치에 돌아오는 행동과 내부 본문 위치 보존을 구분한다. JSON 원문 textarea 자체 내부 스크롤 보존은 미검증이다. 프로젝트 전환은 이번 독립 정상UI에서 반복하지 않았고 별도 작성자 test04 합성 경계에서 확인했다. 컨테이너760px 분기점 자체·임의 pan/zoom·큰 지도·터치·사람 연구·의미 충돌 자동 해결로 확대하지 않는다.

이 읽기 보조를 보고서 중심의 기본 화면으로 확장하지 않는다. 기본값은 접힘이며, 다음30은 전체 지도에 돌아왔을 때의 가용 높이,31은 접힌 부분의 기존 기록을 곧바로 찾는 흐름을 다룬다. Dify와는 명시 행동과 읽기 부담을 비교하며 실행 엔진을 복제하지 않는다.
