# 123 한정 수용 — 첫 지도 진입과 현재 이해 먼저 읽기

늦게 도착한 AI 상태 때문에 빈 지도 중앙에서 시작할 수 없던 문제를 고쳤다. 부분을 열면 설명 다음에 현재 주장 전체를 이어 읽고, 그 뒤에서 관계를 따라간다. 지연 응답이 다른 프로젝트의 긴 붙여넣기 초안을 다시 그릴 때 선택 방향과 읽던 위치를 잃던 기존 결함도 함께 수리했다.

## 수용 대상

- 설계046de03c3dbf15abb43c51f2b0beead60b7641a4 → core bc27a1adb40f003ffcd5443568c7b331a03d3507 → 최종 제품8c70bac0b2876ef052315bee0f36ea7976e2ec66.
- 정확 CI HEAD6a78336ee10cc2fdf29176d97d0637409e4b0a72는 checkpoint8c0579e8e3291f9495de2ab7487ae78e17d233b9의 ACTIVE/QUESTIONS 두 문서 충돌만 조정한 커밋이다. 제품 app tree c69120224cf09a0f7252f8bb7283f096d75171a6은8c70과 같다.
- 제품 변경은 app.ts14줄, return-view.ts6줄 및 별도 집중검사 reading123-flow.mjs다. 스키마·원문·claim 정렬·인용 identity·서버·생성 정책은 그대로다.

## 판단 근거

[총괄 직접 PC 검증](ROOT_VERIFICATION.md)에서 실제122 Power 주장은1280×720의 첫 화면 안으로242.1px 앞당겨졌고 후행 always-on/절전 불가 조건이 모두 보인다. Display의 두 패널 대응도 연속 읽었다. 근거와 관계 방문 뒤의 초점·스크롤·카메라, 저장 프로젝트 SHA가 그대로다. 1440×900 별도 실화면도 확인했다. 실제 사용자 연구나 모든 관계 탐색의 개선으로 확대하지 않는다.

상태 지연 후 중앙 첫 지도 시작이 나타났고 편집 중 부분 이름·설명·커서를 보존했다. 최종 수리에서는 다른 프로젝트의1870자 본문 전체·backward 선택[1849,1870]·scrollTop1317.5999755859375·초점·URL이 정상 응답 후 정확히 같았다. 만료된 첫 준비는 제외했다. 새 AI 생성0회.

작성자11개 집중 스텁 검사는 별도 실행이며 기본 CI에 포함되지 않는다. [작성자 범위](evidence/author-focused-summary.json), [독립 core](evidence/independent-code-review.json), [독립 final delta](evidence/independent-final-delta.json)를 회수했다. 독립 검토 새P1/P2 없음. Root 최종 Node24.19/잠금TS5.8.3 check/build 통과.

[정확6a78336 CI40961069081](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/40961069081)는 Linux·Windows 모두 completed/success다. 원앱 Node279개씩, continuity Linux629pass/0skip·Windows626pass/3skip, 양쪽 기존 직접 브라우저·Studio smoke·정적빌드·Worker dry-run 통과. Node22.16.0이며 Worker26 modules/assets54를 준비했고 배포하지 않았다. [정확 결과](evidence/ci-exact-head.json). 기본 CI의 스텁 성공을 새 생성 의미 검증으로 세지 않는다.

## 유지하는 한계와 다음 경계

접속 코드 없는 버튼 가시성은 기존 판정과 같고 서버401에서 입력을 요구한다. 인증 준비 UX 수용이 아니다. 8개 초과 관계·busy/ready 분기를 이번에 다시 실행했다고 주장하지 않는다. 가로스크롤은 전후0만 관찰했다. 돌아와 읽기 패널 본문 자체의 스크롤은 이 textarea 수리 범위 밖이다. 작성자의 작성 fixture와 Root의 실제122 관찰은 별도다.

122 한 건의 의미 수용,121 단일 요청 수용 및 후속 방문 미실행,89/104 결과를 재해석하지 않는다. 이번은 PC 읽기·시작·초안 보존 수용이다. 전체 생성 품질·세 원자료 최신 통합 경험·전체 제품 완성·공개 배포 수용은 아니다.

공개73 app b670c0ea300050e28cdba9655515ebcf2e03d9d5 / 미수용74 / UI 범위75 최종693d0c7을 구별하고 보존했다. stash fa07118ead372bcb3201c8032ca603a5ec0a7e7d·키·기존 미커밋은 그대로다. [PR69](https://github.com/tlsee0813-cmd/agentflow-studio/pull/69)는 누적 미병합 draft이며 독립 출시 패키지가 아니다.

다음은 완료105 공개 전달 경계와 현재14 저장 코드를 대조하여, 수용된 읽기·편집을 전달할 정확한 Worker/assets 조합과 이행·복구 조건을 선택한다. 새 기반 계층이나 실패 모델 재실험으로 넘어가지 않는다. 전체 목표 active.
