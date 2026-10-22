# 27 · 현재 상황과 대조해 설명 다시 기록 — 한정 수용
2026-10-23 KST · 종료 판단. 현재 작업은 [ACTIVE](../ACTIVE.md).

## 무엇이 달라졌나
25에서 사용자가 설명의 7일 오류를 30일로 정정한 뒤 작업문의 표시를 30일로 고치면, 설명이 오래된 참고가 되어 다음 요청·인계에서 제외됐다. 기존 맥락 무효화는 적절하지만 새 상황을 확인하고 설명을 다시 기록하는 입구가 없었다.

이제 해당 설명의 편집 안에서 현재 구상·조건과 관련 작업문을 펼쳐 읽고 **새 사용자 판본으로 기록**한다. 동일 문장도 명시 기록할 수 있다. 열 때의 프로젝트·영역·설명 판본·맥락을 저장 때 다시 검사하며 바뀌었으면 초안을 남기고 거절한다. 편집 중 자동으로 기준을 최신화하거나 과거 설명을 되살리지 않는다. 수동 작업문·조건·과거 보고·인계를 설명 저장이 수정하지 않는다. 사용자 설명은 출처 있는 참고이지 앱이 사실이나 실행 권한을 검증한 결과가 아니다.

[PR14](https://github.com/tlsee0813-cmd/agentflow-studio/pull/14)의 최종후보 `6b96543fdf980ff45f0e1b67f83e8a0a561a1542`를 checkpoint에 병합했다. 병합 `548cf48058706207430e2087d9fe99d3e8a5acb7`의 부모는 `0881e55e236c6746db793a1cd8ff32151c9f4142`와 최종후보다. 후보·병합의 app 전체 subtree `8d70e3bdd2f8592460c4a8d01a851456099d82f9`가 같다. 변경은 app.ts/domain.ts/신규 순수 단위 검사/기존 브라우저 검사 안내 위치의 네 파일이다. 저장 형식·의존성은 바꾸지 않았다.

## 실패를 찾아 고친 과정
독립 코드 검토에서 작업 읽기의 취소·저장 직후 펼침 기억이 편집기를 다시 열 수 있음을 찾았다. Cloud v0에서도 취소 후 textarea가 실제 화면에 남았고 저장은 맥락 없는 경고로 막혔다. `endEdit`에서 해당 편집기 기억을 함께 닫는 fix1을 적용했다. 같은 의미·절차의 좁은 실제 화면 검사에서 v0 child/outer1 → fix1 child/outer0, 실제 숨김과 명시 재열기를 확인했다. [원실패](https://github.com/tlsee0813-cmd/agentflow-studio/tree/3fda6dff3f1042e8e9d0b5e0e5eeb5d5839f0034/docs/transfer/description-refresh-27/independent-a/v0-cancel)를 보존했다.

첫 양PC 검사기는 POST 필드 `text`를 `summary`로 읽어 실패했다. 그 실행·PNG·코드를 보존하고 필드명과 정확한 대상 대조를 보완한 뒤 새 단일 실행을 완료했다. 과거 부분 실행을 성공 수에 합산하지 않았다.

## 검증의 서로 다른 층
- [작성자·단위 원자료66파일](https://github.com/tlsee0813-cmd/agentflow-studio/tree/ac648d81d395ac8f42b0b2f7b97377223e881dd2/docs/transfer/description-refresh-27): Node24 보조 타입/빌드·신규8+관련91 순수 단위99/99. 최초 도구 경로 실패와 재실행을 분리했다. 단위 검사는 UI 닫힘을 대신하지 않는다.
- [독립 Cloud 보고·실제 화면](https://github.com/tlsee0813-cmd/agentflow-studio/blob/5aab7997c7f3b2de6e2056ab15e8dc711e967b77/docs/transfer/description-refresh-27/independent-a/fix1/REPORT.md): 고정 소스, 실제 Node22.16·Playwright1.57·Chromium154.0.8037.57. 1280×720·1440×900 최신 실행2/2, fatal/pageerror/cleanup0, child/outer0. 서버 명시 종료-15는 검사 종료와 별도다. 30 HTTP 응답의 실행 파일 해시와 전후 고정 소스를 대조했다.
- [정확 후보 양OS CI](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/39835847977): Ubuntu·Windows 모두 completed/success. [Code Review 회수 원자료12파일](https://github.com/tlsee0813-cmd/agentflow-studio/tree/3a24e53ce28a6d80dec2673ab1c29b98f528630a/docs/transfer/description-refresh-27/ci-6b965)에 각 continuity275/275, 브라우저23묶음230과 수정한 understanding17 양PC가 보인다. 각 로그120000자 tail이어서 신규8개 개별 행·초기 Node 실행 버전은 회수하지 못했다. 설치 로그 Chromium143은 실제 browser.version 확인과 다르다. Windows502 조회 실패 후 같은 도구로 재회수했으며 우회하지 않았다. 각 annotation1은 upload-artifact Node 폐기 안내다.
- Astra가 소스와 Cloud 검사·저장·압축 원자료를 독립 대조해 추가 차단 결함 없이 통합 가능으로 판단했다. PNG 직접 검토는 하지 않았다. 총괄은 v0 취소 화면과 fix1의 1280 충돌·1440 A 관련 작업/B 현재 작업 화면을 직접 읽고 판단했다.

공유 작성자66개·CI12개는 원격 Git blob/크기와 대조했다. Cloud는 고정 커밋의 보고·JSON·PNG·원자료로 회수 가능하며 로컬 경로만 남기지 않는다.

## 관측된 사용 흐름과 한계
current=B 상태에서 A의 관련 작업 네 값·직접 수정 표기를 편집 안에서 읽었다. 입력 없이 편집을 연 뒤 A의 N을 정상 변경하고 저장하면 거절·초안 보존, 취소 후 명시 재열기하면 사용자r3(corrects2), 지도에서 새 명시 기록r4(corrects3)를 남겼다. 실제 A 재정리 POST와 clipboard H가 정확 A/r4를 참조했다. 표시30과 실제 보관7·배포금지를 분리해 유지했다.

**수동 네 칸 보존은 설명 기록 행위의 효과**다. 관측 전체에서는 충돌을 만들기 위해 N을 사용자가 한 번 바꿨다. 과거 r1/r2·H0/H1·원보고·B·기준·구상은 불변이었다. **관계·소속 표본은 빈 관계·평면**이므로 실제 연결/다층 전체를 UI에서 검증했다고 하지 않는다. 복귀 두 쌍의 matrix·선택·카드 좌표는 같았지만 임의 pan/zoom 전범위는 아니다. 보류-only 우회·프로젝트간 초안·migration/restore·늦은 수신 전체 순열·실제 AI 의미 품질은 이 좁은 정상 UI 실행의 범위 밖이다.

현재 맥락·작업문은 사용자가 펼칠 때 읽으며 기본 화면에 모두 늘어놓지 않는다. 그래도 긴 상세 읽기의 부담과 전체 지도 가독성은 이 기능만으로 해결되지 않았다. [28 지도 읽기 비교](../2026-10-23-map-reading-28/INPUT.md)로 이어간다. main `896dcf38`·공개 gh-pages `63f5540d`는 유지했다.
