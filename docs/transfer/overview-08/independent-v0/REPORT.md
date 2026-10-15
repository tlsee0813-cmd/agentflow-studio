# cycle08 fix1 — 독립 첫 조망·명시 상세 관측

대상·계약·참조는 SOURCE.json. GitHub 고정 원본 42025B / SHA256 `85f07ee4159a6db825be2fa3163142b70b27c4fb56f090c934b3b41f1fe0eb81`을 변경 없이 실제 loopback HTTP로 제공했다. 세 최초 page.goto 모두 200, body bytes/SHA 일치, 파일 전후 SHA 일치. UTC/URL/console/환경은 result.json. 동적 Playwright 1.57.0 / 실제 system Chromium 154.0.8037.57. 기존 독립 Cloud 환경 재사용, 설치·TLS·정책 변경 없음.

**최신 단일 run02: 1280×720·1440×900·390×844 × 두 흐름 6/6 완주, 반복 검사 73 PASS / 0 FAIL.** child 0, 외부 collector 실제 subprocess exit 0. launch.py가 종료한 collector를 측정했고, launcher 자신의 exit를 자기 기록으로 외부 실측이라고 하지 않는다. 실행 도구도 launcher exit0을 관측했다. fatal/pageerror/cleanup 없음; favicon.ico 404 resource console 오류 1개는 pageerror와 구분. 이전 실행·작성자 78/24와 합산하지 않았다. 수집기 종료 전파 방식은 재사용했고 새 실패 probe는 실행하지 않았다.

## 두 흐름의 실제 결과

1. **초기/비교/맞춤:** 각 새 context에서 선택·스크롤 전 세 역할 이름/역할·개별 책임 칩/설명 및 두 기존 호출 양끝·라벨이 viewport와 overflow 조상 안에 함께 노출됐다. 390은 두 메뉴가 위에 나란히, 공통 계산이 아래이고 두 호출선이 실제로 남는다(이름 목록으로 대체하지 않음). 실제 최초 P3 선택 직전/직후 raw 카드·선·내용과 비교 전후를 모두 저장: 카드 외곽/배치/선은 유지. 변경 전 두 메뉴에만 누락 확인·경과 계산 칩이 있고 공통에는 기존 추정과 ‘두 메뉴에서 함’ 설명만 있다. 변경 후 두 책임은 공통에만, 표시 분기는 메뉴에 남는다. 삭제/새 계산/현재 최종 제품 상태로 세지 않았다.
실제 130% 줌/가능축 wheel 뒤 전체맞춤. 맞춤 후 이름·역할·개별 칩·단서의 실제 contents/clip/hit 및 원시 선·양끝을 다시 기록했다. 선택 P3·after 비교 보기 유지. 맞춤 matrix는 1280 **1.019**, 1440 **1.205**, 390 **0.994**, native scroll0. 이는 새 시야 계산이며 이전 보기 복원이 아니다. 이름 computed font16px, 역할12.5px와 실제 배율을 분리 저장했다. 최소 폰트 숫자로 일반적 가독성을 단정하지 않는다.
2. **한 부분/명시 왕복:** 별도 115% entry snapshot을 저장한 뒤 P3를 읽음. 실제 책임표 셀의 내용/clip/hit로 누락 확인·경과 계산·세 숫자/다운로드 상태·남는 추정 역할과 두 호출 유지 확인. 정상 reader wheel로 각 top100(최대1280 446 / 1440 266 / 390 358)에서 관련 P2 위치를 보고 복귀: 즉시 raw 행 x/y/w/h 및 scroll delta0, 출발 버튼 focus. 390은 ‘읽던 곳으로’, 넓은 폭은 reader가 남는 UI 그대로. 115% 관련 메뉴는 실제 clip 안이고 hit됨.
기본 준비문은 현재 입력/두 호출과 조정 필요 판단·선택지·범위 밖 제안, 후속 반영/닫힌 이유 미확인·영향없음 보장 금지라는 fix1 의미를 유지했다. 의미 있는 E를 실제 입력 후 닫기/재열기/전체복귀/재진입에서 유지. 1440 한 대표 폭에서만 P1을 방문해 P1 대상·네이티브 파일 요청 기본문에 E가 섞이지 않고 P3에 돌아와 E 유지 확인. 변경되지 않은 모든 peek 반복은 하지 않았다.

진입/복귀 raw 쌍을 모두 저장했고 카드 rect delta0, matrix·선택·비교·map/main scroll 유지. 선 pathRect는 1280/1440에서 두 선의 width만 -0.00006103515625px, 나머지 성분과390은0이었다(.01px 수치 비교, 문자열 동일 조건 없음). 기준 native map은 1280 left81/top0(max81/0), 1440 0/0(max0/0), 390 left11/top34(max24/35). 여유 없는 축은 0으로 남겼다. 맞춤 snapshot과 상세 entry snapshot은 별도이며 복귀 직후 보조 이동 없음. 수치 재계산용 derived-summary.json은 원시 result에서 읽기 전용 차분, 추가 PASS 집계 아님.

## 측정·경계

모든 overflow 조상/축과 viewport 교집합, transformed ancestor 비율, 대상 자체 content clip, Range 경계, 대표점 hit를 구분해 원시값을 저장했다. 개별 문구 hit는 접근 표본이며 문자 전체 잉크·사람 이해 증명이 아니다. SVG는 pointer-events:none: 라벨/선의 clip 및 underlying cover와 실제 화면, DOM path→screen matrix 양끝과 카드 대응을 기록하며 선 자체 클릭 성공을 요구하지 않는다. app state/API/DOM scroll 주입·force click·복귀 보정은 없다.
390 P1/P3 after 선택 예약줄은 실제 167/167, 자식 문구 box는 clip 안이고 hit됨. 문구 확대 일반화는 하지 않는다. **390 수동130% 공통 카드429px > 지도390px**로 부분 노출은 알려진 경계로 그대로 기록했다. 이 배율 locate의 전체 노출을 새로 시험하지 않았으며 모든 허용 배율 성공이라고 하지 않는다. 초기/전체맞춤/115% 한 경로와 구분한다.

첫 run01도 6/6·exit0이었으나 책임 컨테이너만 hit 측정하여 개별 문구 근거가 부족했다. 원본 코드 snapshot·JSON·로그를 보존한 뒤 개별 칩/단서 hit와 상세 셀 clip/hit를 같은 흐름에 보완한 run02를 최신 기준으로 삼았다. 첫 실패·fatal은 없었으며 수식/앱 수정도 없다. 코드는 해시별 snapshot 한 벌씩, PNG는 최신4장만 업로드해 동일 사본 중복을 피했다.

이번 좁은 검사에서 중요한 기능 결함은 발견하지 않았다. 큰 지도·사람 이해/사용성·실제 AI 송신/인계·원 프로젝트 실행/CI·터치·외부 원문 왕복·모든 줌 배율은 **NOT_RUN**. 공개 사람–Copilot 기록의 연구 시안이며 사람 성공이나 원 프로젝트 수용을 검증하지 않는다.

PNG: initial-1280 / initial-390 / selected-detail-1440 / default-preparation-390(편집 전).
재현: 고정 HTML을 site/overview-study.html에 추출하고 기존 venv Python으로 `launch.py <새run이름> snapshots/<검사해시.py>` 실행. 각 child-exit.json의 codeSHA256이 실행 코드를 고정한다. 소스 해시 불일치·FAIL/미완주/fatal/pageerror/cleanup은 nonzero. 기존 증거/제품·연구·main·배포·공유 index 변경 없음.
