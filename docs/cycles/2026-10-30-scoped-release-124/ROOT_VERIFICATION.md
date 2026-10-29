# 124 총괄 검증 — 기존 지도 작업용 별도 후보

제품 최종 cfe993f31a8c53284612c22b3ded0c0739257373 / app a0a56c1cb8f2a1fdde5c7afb136bc248c8b61b6b. 최신 checkpoint 2da557bb의 두 진행문서만 병합한 CI head는 df697411d0569aa02d98007d00ab4cfc3bcb1bb6이며 app tree는 같다. 공개73 app b670c0ea는 바꾸지 않았다. PR70은 누적 초안이며 전체 후보 병합 승인과 다르다.

## 직접 실행한 제품 경로

- 정확 core f09d12d 패키지의 54 browser assets와 27 Worker 모듈 각각을 bytes/SHA256으로 대조해 별도 private 디렉터리에 동결했다. 복사된 worker-existing-map.mjs가 HTTP 요청과 동일 assets를 직접 서빙했다. 외부 fetch는 차단하고 완료107 plan 및 완료109 scope의 저장 응답만 입력 messages 전체 일치 때 재생했다.
- 구판73과 같은 app의 완료88 보존 빌드 54개 해시를 확인해 재사용했다. 환경 재설치·구판 재빌드는 하지 않았다. old origin51915, candidate51916, 재가져오기51917은 각각 독립 저장이다. 원 공개주소를 검사로 수정하지 않았다.
- 구판 정상 UI에서 받은 project11 및 별도 과거 plan file2를 새 후보 정상 파일 가져오기로 읽었다. project는 schemaVersion→14 외 전부 동일(revision15·pasted3·readings3·areas5·철회/인용/위치 포함), plan bundle은 모든 키·값·배열 순서 동일했다. 과거 동결 요청 4013 UTF-16자 전부 보존했다.
- 첫 편집은 변경 의도 한 문장과 변환기 이름 한 곳이다. 반대 요구를 적자 낡은 요청 생성이 비활성화됐다. 새로고침 뒤에도 초안은 남고 plan bundle은 draft 외 전부 동일했다. 지도는 이름, revision15→16, 해당 containment revision0→1만 바뀌었다.
- 정상 새 백업14/plan4 내보내기→빈 별도 origin에 재가져오기→새로고침 뒤 프로젝트와 bundle 전체가 편집 직후와 정확히 같았다. 원 주소는 새 주소 편집 동안 모든 storage값이 그대로였다. 구판은14/.4를 정상 UI에서 거절했고 데이터는 그대로였다. 구판 검증 중 이동으로 last-navigation값만 달라졌음을 구분했다.
- 과거 public sidecar는 비어 있었다. 같은 owner의 별도 역사적 plan을 격리 사본에서 합친 표본이며 실제 당시 완전 sidecar였다고 주장하지 않는다. 서로 다른 RQ_1edf…와 reading의 RQ_efb3…를 임의로 연결하지 않았다.
- 실제104 지도에서 이어진107 프로젝트로 Display를 고른 후 원래107 의도를 입력했다. 정상 plan3 HTTP의 system/user messages 전체가 수용107 입력과 일치했고, 정상 scope HTTP는 수용109 입력과 일치했다. 반려107 scope는 쓰지 않았다. 외부 호출0, 응답재생2회. 새 요청 RQ_2270d57b-174f-4405-9ad3-72f3b25ed607(16202자)가 생성됐고 새로고침 뒤 다른 프로젝트를 포함한 plan 저장 전체가 동일했다. 새 생성 의미 품질 판정이 아니다.
- 기존 project의 저장된 철회·미구현 대조는 계속 열렸다. 새 보고의 map7 대조 생성은 제공하지 않는다. 이는 전체 처음 사용자의 자료→첫 지도→작업 결과 이해 경험 완성이 아니다.

## 최종 수리와 화면

독립 P2: REQUEST_CONTEXT_TOO_LARGE 및 map-reading.1+동결 요청에서 제한판이 불가능한 새 대조를 권했다. 작성자가 지도 제목/돌아와읽기 네 분기만 수리했다. 최종 독립 delta는 원P2 해소, 새P1/P2없음이다. 작성자 R 시나리오는 일반 Worker에서 두 조건의 CTA가 존재함을 먼저 확인하고, 수리를 되돌리면 실패함을 확인했다. 이는 작성자 실행이며 Root 재실행으로 세지 않는다.

최종 package는 core와 Worker modules 전체가 동일하며 assets는 BUILD.txt와 client/app.js만 다르다. Root가 final의 정확 동결 assets+Worker를 새 origin51918에서 실행했다. 정상 가져온 실제107 지도와 앞에서 만든 요청 bundle 전체가 그대로였고, Display의 HINK-E0213/SSD1673/reel_board 및 HINK-E0213A22/SSD1675A/reel_board@2 대응→원문 표→복귀→같은 변경안을1280×720에서 확인했다. 이 실제 표본은 map-reading.5이므로 P2 map-reading.1 반례 실행으로 세지 않는다.

늦게 도착시킨 정상 status에 새 프로젝트 이름·커서16·초점이 보존됐다. 빈 지도 직접 부분 폼의 두 값·커서14/20·초점도 보존됐다. 처음 폼 증거 수집은 숨은 empty-card 아래를 읽어 빈 배열이었으므로 제외하고, 실제 두 textbox에서 비공허 비교를 다시 했다. 123의 반환 textarea 전체값·방향·스크롤 검증은 완료 증거로 재사용하며 이번에 다시 실행하지 않았다.

첫 final CDP PNG는 Windows125% 화면배율로 우측이 잘려 전체화면 증거에서 제외했다. CSS viewport 자체는1280×720이었다. viewport capability와 정상 screenshot으로 전체 프레임을 다시 캡처한 *-correct.jpg 및 final-home-1280.jpg만 공개한다. 제품 overflow 결함으로 잘못 판정하지 않았다.

## 실행 근거의 층위

| 주체 | 검증 | 범위/상태 |
|---|---|---|
| Root | 잠금 Node24.19/TS5.8.3 type/boundary, core release6개, core/final dry-run | 통과·배포0 |
| Root | 위 정상 UI 이행/저장/실제자료 재생/최종 상태 지연 | 직접 관측·새AI0 |
| Root | exact core HTTP map6 first/later/map7/legacy/jobs6요청 |403, 추가provider0. 불완전 body로 parse보다 앞선 route차단 확인; 유효 input matrix는6집중검사 |
| Claude | continuity635, release124-flow6, reading123-flow11 | 작성자 통과 보고; 두 flow는CI 밖, 새124 성공stub은plan3뿐 |
| Claude | root app |278통과/1실패: 환경Node22.22가 검사요구22.16과 다름; 환경 재설치 안 함 |
| Sol High | core 및 final delta, 독립 migration oracle | 실행/생성 아님. P2수리 후 새P1P2없음 |
| CI | exact df697411 / run40966300557 | 양OS success. 원앱279씩, continuity Linux635/Windows632+3skip. 직접browser·smoke·default dry-run 통과 |

## 패키지와 남은 출시 경계

최종 named dry-run worker는 agentflow-studio-existing-map-124, policy existing-map, same-origin API/CSP self, storagePrefix agentflow.studio.preview: 이다. RELEASE_SELECTION의 browser-demo: 추정은 실제 패키지와 달랐으며 이 실측값을 채택한다. prefix를 임의 변경해 자료를 놓치게 하지 않는다. 최종 assets SHA ad5af7a029dae3afa5ced7b2b68183abd3839fa45184c64be718e6867f1f4188, modules SHA 1df394bd38dc2ff2cd04deb3d4c01d68be876efb70f88cc09aefba898c5678c9. manifest에는 secret 값이 없고 binding 이름만 있다. 공개 map-prompt 모듈이 closure에 남지만 제한 route가 실행을 막으며 로컬 CLI/jobs/Node 모듈은 없다.

이 단계는 배포하지 않았다. 향후 배포는 대상 Worker 존재/소유 확인, 이름·모델 등 설정 확인, 재빌드한 실제 업로드 bytes와 승인 manifest의 일치, 별도 origin 공개 smoke가 필요하다. dry-run은 자동 승격 기능이 아니다. same-origin public73 교체·자동 pre-upgrade backup·다운그레이드 성공도 아니다.

공개 제한 안내와 버튼은 일치하지만 일반 'AI 정리 가능' 표시는 남고 자세한 제한은 tooltip/홈/빈지도/반환 안내에 있다. 붙여넣기 보관 안내의 일반 '지도 정리나 요약' 표현과 상태 도착 전의 잠깐 기존 첫지도 카드도 남는다. 실제 지도 생성 버튼이 활성화됐다는 뜻은 아니다. 이 문구 밀도/미세 안내를 새 기반개발 이유로 확대하지 않는다.
