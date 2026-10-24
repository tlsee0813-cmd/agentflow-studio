# AgentFlow 현재 상태

**설계46 진행:** 제품45를 유지하며 [소프트웨어 지도 설계](../SOFTWARE_MAP_DESIGN_KO.md) 한 문서를 지속 수정한다. 사용자 승인으로 Pro8개 주제 조사와 Opus 의미/탐색/시각 관점 비교를 시작했다. 실제 OSS 구성·현대 구조 표현·타 분야 UX·원연구를 교차 확인한다. 제품 구현은 착수하지 않는다.

**현재 수용45 · 기본 결함 수정:** [Studio](https://agentflow-studio.tlsee0813.workers.dev/#/p/ex-salon/in/book/slots) · [PR28](https://github.com/tlsee0813-cmd/agentflow-studio/pull/28). 예제 부분 주소를 spec key로 안정화했고, 한글 AI 요청은 최종 JSON의 UTF-8 바이트 예산으로 구성하며 포함/제외/발췌 범위를 표시한다. ‘진행 중’을 ‘요청만 있음’으로 교정하고 AI에도 같은 관측 의미를 명시했다. 지도 관계 설명 겹침 제거, 최근 기록의 최신/전체 범위, 잠깐 보고 열기 후 접힘 복원, 작은 기본 질문 입구와 초안 보존을 수정했다.

최종 source `aae976d0357d18479a38acb75269b7a7f886fdd8`, app tree `d4189c7ea6a920ed5d88e98e1ede4e059850d147`; merge `c798474ba24877d0fce165bc2efb4a1195ba251a`와 동일하다. [CI40087902257](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/40087902257)의 Ubuntu `120854578536`·Windows `120854578630` 모두 성공. 기존 Workers와 Pages `407d35e6bc4f57405d6b2cb74e2f3abe85f6e44a`를 갱신했으며 공개 BUILD.txt의 source 일치를 확인했다. 실제 비밀값 일치0을 검사한25자산/11서버모듈만 배포했다.

작성자: 기존 Claude session_019mbJshQGDVwW5sqoPHeX7y, `studio45-basic-fixes` 반환146bd972(중간361e3bb), Node300개·스텁 브라우저8흐름 통과. 총괄:1280×720/1440×900 화면과 연결 설명, 새로고침·새 탭의 같은 부분, 접힘 복귀, 질문 초안 왕복, 이름 변경 후 주소 유지·예제 초기화를 직접 확인했다. 배포 서비스의 실제 DeepSeek는 설정 연결 미완과 월요일 임시 고정을 보고 근거로 답했다. 긴 한글14기록·이모지·큰 관계 메타 입력은 스텁 공급자까지 검사했으며 실제 긴 AI 응답 품질이나 복잡한 일반 프로젝트는 검증하지 않았다. 이전 임의 UUID 예제 주소를 복원한 것은 아니며 새 주소부터 안정적이다. 독립 감사·추가 증거 묶음은 만들지 않았다.

**다음 / 사용자 범위 정정:** 기본 배경이 만들어진 단계다. 입력·출력 기능을 늘리기 전에 실제 공개 소프트웨어를 사례로 구성 단위·관계·층위·복잡성 표현을 사용자와 설계한다. 예제 몇 개의 성공을 다양한 게임·웹·일반 프로그램에 대한 설계 완료로 확대하지 않는다. 기록 붙여넣기·hook·인계문·저장소 분리·새 노드 종류·판단거리 배지 구현은 아직 착수하지 않는다.

**직전 수용44 · 2026-10-24:** [Studio 실제 AI 사용](https://agentflow-studio.tlsee0813.workers.dev) · [정적 Pages 체험](https://tlsee0813-cmd.github.io/agentflow-studio/). 사용자가43에서 지적한 노드/그룹 이동, 커서 기준 일반 휠 줌, 안으로 들어가기·상위 복귀·제자리 접기, 범위별 시점과 저장 프로젝트 배치 보존을 복원했다. [PR26](https://github.com/tlsee0813-cmd/agentflow-studio/pull/26)과 Workers 호환 수정 [PR27](https://github.com/tlsee0813-cmd/agentflow-studio/pull/27)을 병합했다. 총괄이1280 브라우저에서 조작·초안·3단계 층위·새로고침 배치·예제 초기화를 확인했다. 이는 브라우저 자동화 직접 사용이며 사람의 물리 마우스/트랙패드 검사는 아니다. 배치는 브라우저에 보존되지만 프로젝트 백업에는 아직 포함되지 않는다.

최종 배포 source `660fad24d3ad91951316e7abc1ca2bffe8c3d899`, app tree `5f95762473609b69294e517849a83db32ab901b1`; merge `51bcede262c0dde592c07859daaf6d8ab85fd01d`와 동일하다. [CI40080458577](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/40080458577)의 Windows `120832733745`·Ubuntu `120832733888` 모두 성공. 배포 BUILD.txt의 SHA와 일치하며 상태 API200, 잘못된 접속 코드401을 확인했다. 최종 Cloudflare 화면에서 실제 DeepSeek 질문 응답을 받았다: 휴무일 안내·필터는 보고된 구현으로, 설정 저장 위치·연결은 미확인으로 구분했고 근거 기록 두 개를 연결했다. 공급자 키는 Worker Secret이며 공개25자산/11서버모듈에 실제 비밀값 일치0을 배포 직전에 검사했다. Pages는 UI가 같은 `c0a805c`의 정적 빌드 `5345ca53cff559913ef2470fef8679fb3f7b0178`이며 공개 BUILD도 확인했다.

작성자299개 Node 검사·6개 스텁 브라우저 흐름, 총괄 직접 조작·실제 API, 양OS CI를 구별한다. `96a0145`의 Ubuntu 실패는 확대 후 화면 밖으로 이동한 그룹의 클릭 준비 문제였다. 복귀 좌표 검사를 추가하고 전체 보기 후 접근하도록 고쳤다. 첫 Cloudflare 실제 요청은 Workers가 지원하지 않는 `redirect:error` 때문에 실패했다. `manual`로 바꾸고302/307을 거절해 키가 다른 주소로 전달되지 않게 유지했다. 새 독립 감사·픽셀 증거 묶음은 만들지 않았다.

## 직전43

2026-10-24 KST. **사용자가42를 반려한 뒤 Studio43의 지도·부분·실제 AI 데모를 다시 구성하고 총괄 직접 사용·양OS CI를 확인했다.** [공개 정적 체험](https://tlsee0813-cmd.github.io/agentflow-studio/) · [PR25](https://github.com/tlsee0813-cmd/agentflow-studio/pull/25) · [로컬 실행](../../app/continuity/README.md) · [질문별 근거](../QUESTIONS.md).

43은 프로젝트 입구→고정 지도→선택한 부분의 기록·실제 AI 정리로 화면을 다시 구성했다. Claude 단일 세션 `session_019mbJshQGDVwW5sqoPHeX7y`의 결과를 회수·통합했다. 총괄은 `374f72e`를1280 화면에서 직접 사용했다. 실제 DeepSeek 답변이 기록의 임시 고정·설정 미연결을 짚었으며, 짧은 답과 접힌 상세·선택 때 변화 목록 접힘·지도 복귀 초안·새 프로젝트와 첫 부분·새로고침 초안 보존을 확인했다. 이후 UI·handler는 그대로이고 실행기와 정적 저장 접두사를 보정했다.

최종 source `00ca5753e46d34c42a535f7acbcea9b0a88d16b2`, app tree `c342d89bdc8a4edecd51d4e1c8d7d3124a57dca7`. [CI40076048672](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/40076048672)에서 Ubuntu `120819712336`·Windows `120819712517` 모두 성공했다. PR25 merge `af4675b881f85e3e9ad6457478f97ab001f9fa3c`의 app tree도 일치한다. Pages 배포 커밋은 `27505ed018676f87c725eae742c488c471a121e5`이며 기존 preview 저장 공간을 유지한다. 변경 소스·정적 출력50파일에 실제 키 일치0을 확인했다. 작성자 스텁 실행·총괄 실제 API 및 화면 사용·CI를 구별하며 새 독립 감사는 시행하지 않았다.

사용자 최신 결정에 따라 공개 AI 호스팅은 **Cloudflare Workers**로 전환·배포했다. 기존 로컬 실행과 Pages의 저장 자료는 유지하며 주소 간 자동 이전은 없다. 키는 Git 밖의 비공개 env 파일과 Worker Secret에만 둔다. Sites는 재개하지 않는다. 사용자가 직접 화면을 보고 반려했으므로 “사람이 한 번도 보지 않았다”는 주장은 사실이 아니다.

## 직전 배포42 — 기술 검증 기록이며 현재 제품 수용을 뜻하지 않음

- source `caf6126a4a2e592dc4f17626f0440d13a1d4c188`, app tree `9ba47af6a58cf97d717e743a862553ea2cf1053d`. [PR24](https://github.com/tlsee0813-cmd/agentflow-studio/pull/24)와 정확 양OS CI 성공을 확인했다. 후속 증거 문서 커밋과 제품 SHA는 구분한다.
- Pages `78356d033e455f2a255a5d03c9790495eb9c7d66`. [배포 파일/키 검사](2026-10-24-visual-design-42/DEPLOYMENT.json)와 [공개 HTTP19개 동일성](2026-10-24-visual-design-42/HTTP_VERIFICATION.json)을 확인했다. 실제 AI 없는 브라우저 MOCK·preview 저장 접두사다. 과거 private Sites35는 최신 체험본이 아니다.
- 홈의 시작 두 행, 연속 지도와 붙은 선택 패널, 문서형 작업 편집을 같은 글자·간격·표면·아이콘으로 구성했다. 초안·caret·예제 비저장·페이지/지도/카메라 복귀를 보존한다.
- 중간 후보의 헤더/팝오버, 참고 편집 높이, 관리 메뉴, 기록 많은 카드 소속 잘림과 반복 pan 취소를 재현·수정했다. 작성자·독립 실행·총괄 시각 판단·미실행을42 기록에서 구분한다.
- 임의 큰 지도·실제 브라우저 줌/IME·사람 사용성·실제AI 의미 품질은 미검증이다. 펼친 원문의 출처 메타 밀도는 남는다. 과거 반례와 GUIDE107 HOLD를 유지한다.

## 포함된 이전 범위

- [경험41](2026-10-24-workspace-experience-41/DECISION.md): 기능 흐름의 수용 기록이다. 사용자가 기본 시각 품질을 반려해42에서 시각 체계를 다시 구성했다.

- [결합38](2026-10-24-entry-integration-38/DECISION.md):36fix2+37, source c7329aa, PR21 merged. 1280 복귀 안내 때문에 지도 높이가 줄던 반례·예제 비저장·초안 보존 확인.
- [관측39](2026-10-24-organizer-observation-39/RESULT.md): 실제 JSONL 한 표본과 고정 project 사본, DeepSeek 출처 분류와 독립 대조. 실제 project handoff 연결 근거 없음, 수신 dry-run NOT_RUN.
- [검토40](2026-10-24-source-proposals-40/DECISION.md): source44cfc9a, PR22 merged. 연결 대기 제안의 출처/원문 검토·제외/되돌림·근거 분리만 수용했다. 실제 project 적용이나 자동 동일성 병합은 없다. 이전 공개d2ecd381은 rollback 기준이다.

## 접수와 반환 — 중복 제출 금지

| 담당/주제 | 원본 접수·반환 | 상태 |
|---|---|---|
| Claude37 | session_01KJRKarPuyzvnMWCkvYQbW1, 후속2/4,0fa38e0 | 완료·38에 결합·수용 |
| 독립 Sol High36/38 | /root/verify36_prepare,beb559/c7329aa | 완료·cycle38 최소 증거 |
| Pro38 가독성 | Oracle af-map-readable-delta-20261024,exec71068 | completed·exit0·원문3출처 대조 |
| DeepSeek 정리v0 | session-a924bcea-2100-41b0-8112-474736972dd0,c7329aa·실제8사건 | completed·exit0·독립 보정 완료 |
| 독립 정리v0 | /root/organizer_inputs,같은 실제표본/고정project | 완료·관측39 |
| Claude40 | session_014rmcC4wWchSKoq5jwVkZtF,후속2/3,44cfc9a | 완료·수용·PR22 |
| Pro40 | Oracle af-source-review-40-20261024,exec3771 | completed·exit0·기존 연구 재사용 |
| 독립 Sol High40 | /root/proposal40_review,248320d→44cfc9a | 완료·전체회귀/최종문구delta 구분 |
| Claude41 | session_01UkFFD6VJkUvYpFHh8Zorw8,같은 문제 후속13회,6840496 | 완료·수용·PR23 |
| Pro41 | Oracle af-workspace-experience-41-20261024,exec55225 | completed·exit0·Dify/VSCode 공식 대안·반례, 화면 실행 아님 |
| 독립 Sol High41 실행 | /root/experience41_audit,b74 실행→684 테스트만 차이 | 완료·3크기 대표/보존·wheel/center/zero·수신 경계 |
| 독립 Sol High41 정적 | /root/experience41_source_review,exact684 | 완료·계약/검사 변경 검토, 실행과 구분 |
| Pro42 | Oracle af-visual-design-42-20261024,exec16422 | 완료·공식 비교/반례·총괄 선택 |
| DeepSeek42 | session-c9e4b2eb-3c26-4855-8908-e8514492ea2d | 완료·Dify 고정 소스12행 추출·원문 대조 |
| Claude42 | session_013cKbrEwsEY47DiQW4LRQce,후속11까지 | caf6126 반환·유일 구현 작성자 |
| Cloud42 | local/01a168ed-bd09-7102-a483-781946e370b6,요청5~11 | 완료·제공 ZIP 독립 실행·최종 범위는42 판단 기록 |
| 독립 Sol High42 | /root/visual42_structure,/root/visual42_verify | 완료·정적/Windows 실행 분리·최종 최소 증거 |

## 다음 범위와 운영

43의 수용 범위는 로컬 실제 AI를 포함한 세 화면 데모다. 자동 로그 수집·연결·일반 정리 담당은 아직 없다. 예제는 명시된 합성 자료이며 실제 JSONL의 소속·인계가 확인된 것으로 취급하지 않는다. Q02/Q06의39 관측은 반복하지 않고 실제 연결 근거가 없는 상태를 유지한다.1280에서 부분 패널이 열리면 먼 노드는 드래그로 보며 전체 지도를 자동 축소하지 않는다. 아래41/42의 수용 표현은 당시 좁은 검증 이력이다.

Q04/Q13의 PC 흐름은41에 이어42의 시각 체계·반복 pan·소속 가독성까지 좁게 수용했다. Q02/Q06은39에서 선택한40의 좁은 검토 흐름을 유지한다. 실제 연결·자동 동일성·일반 추출기는 남아 있으며 질문 전체를 일괄 개발하지 않는다. 완료한 연구를 처음부터 반복하지 않는다.

총괄만 agentflow-coordinator/Ops를 쓴다. Pro 비교, Claude 좁은 구현, 준비된 Cloud 또는 작성자와 분리한 로컬 실행, DeepSeek 출처 있는 좁은 분류, Sol6.1 High 보조를 사용한다. Cloud는 해시 고정 공개 runtime ZIP을 정상 첨부해 독립 실행했다. Git 직접 조회/소스 재빌드는 프록시 오류로 하지 못했고, 웹 UI 이미지 출력 실패와 별도 Windows 원본 직접 검토를 구분한다. GitHub 연결은 정상이며409 HEAD 변경 응답을 인증 실패로 오해하지 않는다. 환경 재설치·계정 전환은 하지 않았다.

공개 Pages 허용·DeepSeek 키 공개 금지·로컬/저장소 정돈이 사용자 결정이다. runtime은 gh-pages, 결정/최소 증거는 각 cycle 한곳에 둔다. 큰 원로그/중복 ZIP은 공유하지 않는다. 38에서 자동 승인 검토가 차단한 강제 일괄 삭제는 재시도하지 않았고 약144MiB의 과거 잔여물은 보존했다.40의 전용 임시8,394,735bytes와 병합 브랜치는 정리 완료.41의 정리는 [RELEASE](2026-10-24-workspace-experience-41/RELEASE.md)에 기록한다. 기존 dirty checkout·원본 JSONL·키/워커 환경은 보존한다. 사람 사용 기록 제출을 관문으로 만들지 않는다.

42의 임시299파일·23,700,547bytes와 병합 브랜치도 [정리 완료](2026-10-24-visual-design-42/CLEANUP.json). 공개 탭은 최종 자산으로 갱신했다.
