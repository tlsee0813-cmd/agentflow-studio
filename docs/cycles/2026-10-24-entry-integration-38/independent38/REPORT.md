# 결합38 독립 실행 판정

검증 SHA `c7329aa8b941791633d5f22da4ca105188aab0be`, app tree `af4556e7463fa76ce36938220c52447bd539cd3f`. 작성자와 분리한 로컬 담당이 서버판과 게시 후보 static-preview 빌드를 실행했다. 양PC의 첫 홈→예제지도→부분/작업→이어가기→지도복귀→예제닫기→내프로젝트 시작에서 수용을 막는 결함을 찾지 못했다. 제품/검사 소스는 수정하지 않았고, 번들을 제품 밖으로 옮긴 뒤 worktree/app 모두 clean이다. 게시·CI 판정은 총괄 담당이다.

환경: Windows NT10.0.26200.0 / 지정 Node경로의 실제 v24.19.0 / Python3.12.14 / TypeScript5.8.3 / pnpm11.25.0 / Playwright1.57.0 / 설치 Chrome155.0.8059.85. CI Node22.16.0·Python3.13.5·Chromium143와 다르다. pnpm 잠금파일 미생성 설치(exit0)는 npm ci 증거가 아니다. 직접 localhost HTTP와 native storage 사용, 유료AI 호출0. 기존36의 격리 Python 의존성을 재사용했고 복사하지 않았다.

| 검사 | 결과 |
|---|---|
| root type / boundary / build, continuity check / build | 각 exit0 |
| continuity source unit | 첫 실행246 pass+모듈로드 실패2; sparse에 exact-commit experiments/idea016/cases.mjs 추가 뒤 해당 두 파일33 pass / exit0. 총279개 assertion 성공, 제품/검사 수정 없음 |
| ENTRY37 전체 | 10/10, exit0 |
| MAP36 / VIEWPORT30 / HOME15 / FLOW083 | 12 / 4 / 21 / 12 모두 exit0 |
| static build / --preview build / static suite | exit0 / exit0 / 3/3 exit0 |
| 독립 static-preview probe | 양PC2/2, exit0 |
| 기존앱 tests/browser.py 추가1회 | 18/18, exit0 (22.25초) |

실제 화면4장을 직접 열어 읽었다. 홈에서 목적·비저장 예제·실제실행 아님을 구분할 수 있고, 지도에서 두 상위와 두 하위의 소속 및 역할을 읽을 수 있다. 이어가기 직후 작업 위치표시줄과 지도 복귀 버튼은 안내 아래에 보인다. 지도복귀에는 이어가기 안내가 남지 않으며 하단 ‘시간 고르기’·‘예약 확인’ 두 카드와 조작이 map clip 안에 있다. 1280 기본78% 글씨의 작음은 남고, 가림 해결과 가독성 한계를 구분한다. 1440은120%다. geometry.json은 복귀 전후 실제 높이·카드하단·hit를 담는다.

ENTRY37은 세 복귀 경로, 미전송 초안 보존, 예제13회 열기 뒤 합성6프로젝트 workspace 원문 바이트 동일·현재작업/초안/수동작업문/seq 보존, 실제 지도 memo 보존과 예제 memo0을 확인했다. 12칸 memo의 모든 슬롯을 각각 채운 별도시험은 하지 않았다; 기존검사는13번 예제가 실제 memo를 축출하지 않고 새 예제 id도 쓰지 않는 경계다. 유효 세션복원·손상저장·거부·WebLocks없음·legacy도 통과했다. 실제 사용자의 저장자료를 사용한 검사는 아니다.

독립 probe는 서버 suite가 놓칠 수 있는 게시 runtime 경계에 집중했다. 정상 UI만으로 static-preview에서 예제초안/작업문 편집→이어가기→복귀→닫기→다시 편집한 예제에서 내프로젝트 시작을 수행했다. 예제 동안 localStorage0·map memo0, 내프로젝트 시작의 빈 목적/초안·빈영역/작업/원문/기준·예제ID/문구 유입0, 새 프로젝트에 입력한 초안의 새로고침 복원, preview 접두사 외 쓰기0을 확인했다. static suite는35의 `agentflow.studio.preview:` 접두사와 demo/server/legacy/session 격리를 확인했다.

미실행/한계: 최종 양OS CI는 이 담당이 조회하지 않았고 Code Review 담당과 분리했다. 나머지 브라우저 전체, root 단위검사 전체, 임의 폰트/125%/큰지도/실제IME·다른탭 live, 실제AI 의미품질·사람 사용성은 검증하지 않았다. 기본78% 가독성·긴이름/소속/구상 clamp 한계는 남는다. GitHub Pages 실배포 화면은 아직 미확인이다.

공유 최소물: 이 보고, execution.json(환경/명령/exit), geometry.json, source-integrity.json, 독립 probe, 대표PNG4장과 MANIFEST. 별도 `static-preview-bundle`은 --preview 빌드한17파일(605855bytes), SHA256은 제품 밖 STATIC-BUNDLE-MANIFEST.json에 있다. ZIP/제품 runtime 중복사본은 만들지 않았고, raw 로그·관측·추가PNG는 공유 사본에 넣지 않았다.

추가 관측: Windows CI 첫 시도의 B01 page.goto 5000ms timeout 이후, 같은 제품 SHA에서 기존앱 browser suite를 로컬 native directHTTP로1회 실행해18/18 통과했다. 첫 `test_B01_real_mock_flow_browser_only_confirm_and_edit`도 ok이고 소스·검사·5000ms timeout을 바꾸지 않았다. Chrome155/Node24 환경이므로 CI Chromium143/Node22의 동일환경 재현 또는 CI 실패원인 확정이 아니다. 추가 suite의 PNG·환경 원자료는 raw/main-browser의 정리 대상이며 공유PNG를 늘리지 않았다.
