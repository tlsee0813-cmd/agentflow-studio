# 경험41 공개 확인과 정리

[기존 공개 PC 체험본](https://tlsee0813-cmd.github.io/agentflow-studio/)을 갱신했다. source `6840496f2d4a41d7e396f0febea3cc4cb1f90702`, gh-pages `77a3c0bd18e536bcb99b342c5d5b20fd84ea32be`. 원격 checkpoint에 정확 수용 소스를 fast-forward했고 PR23의 merged 상태를 확인했다. 별도 미검증 merge 소스를 배포하지 않았다.

## 공개 확인

- [HTTP 기록](HTTP_VERIFICATION.json): BUILD.txt가 정확 수용 source를 표시하며 공개 runtime19개가 로컬 검증 번들과 bytes/SHA256 모두 일치한다. `.nojekyll`을 포함한 배포 파일은20개다.
- 총괄이 공개 사이트의1280×720 IAB에서 홈→예제→시간 고르기 선택→이어가기→작업문 직접 입력→지도 복귀→다시 이어가기→다시 복귀→예제 닫기→새 프로젝트를 실행했다.
- 두 번 복귀 모두 scroll0/map top202.8/height501.2. 같은 작업문과 work-next 초점이 돌아왔다. 예제 닫기 후 프로젝트 목록은 비었고, 새 프로젝트의 목적/요청은 빈 값, 목적 입력 초점과 scroll0이었다. 마지막에 홈으로 돌아가 목록이 빈 상태를 다시 확인했다.
- [실제 공개 화면](public-1280.png)은 위 입력 전 예제 선택 패널이다. 공개 첫 화면 검사와 독립 로컬 수치/1280·1440·125% 상당 검사는 구분한다. 실제 AI 호출이나 사람 사용성 조사는 아니다.
- 신규 소스 이력43 blob과 runtime20파일의 실제 키 일치0건은 [배포 manifest](DEPLOYMENT.json)에 기록했다. 원본 키 값은 기록하지 않았다.

## 최소 증거와 보존

작성자/독립 실행/정적 검토/총괄 화면/CI를 별도 문서로 남겼다. 독립 보관 묶음은 개선 전2PNG·개선 후3PNG·최종 보고2개·측정/동일성 JSON2개·원본 합성 fixture3개, 총12파일695,124bytes다. 공개 확인 PNG는 별도 한 장이다. 중간 후보의 실패는 EVALUATION.md에 요약했다. 작성자 중복3PNG는 고정 구현 커밋의 history에서 회수 가능하며 AUTHOR.md에 링크를 남겼다.

GitHub checkpoint의 DECISION과 독립 RESULT를 다시 회수한 뒤 이번41 전용 임시 생성물·중간 반복 원자료를 정리했다. [정리 기록](CLEANUP.json):185파일7,188,900bytes 제거, 로컬 MOCK 서버 PID34680 종료. 중간 반복 원자료·전용 probe 임시 폴더·static-preview-dist·배포 보조2개가 대상이다. 대표 증거와 합성 fixture는 이 cycle에 유지한다. 작성자 중복3PNG는 앞선 증거 커밋에서 별도로 제거했다.

병합한 product/workspace-experience-41 브랜치는 정확6840496과 checkpoint 포함 관계를 확인한 뒤 삭제했다. 기존 dirty checkout·원본 실제 JSONL·키·공용 런타임·과거38의 삭제 차단 잔여물은 그대로다. 독립 보고/RESULT의 서버 running 표시는 측정 당시 사실이며 현재는 종료했다. Pro 접수/반환의 작은 비공개 기록은 중복 제출 방지용으로 유지한다.

추가 공개 문서·증거28파일906,599bytes도 커밋 전에 실제 키와 대조해 일치0건이었다. 후속 증거/정리 커밋의 app tree는 수용 소스와 동일하다.
