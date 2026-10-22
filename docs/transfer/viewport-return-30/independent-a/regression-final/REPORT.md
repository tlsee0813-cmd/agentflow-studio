# Cycle30 신규 회귀의 원본29/후보 비교

제품 기준 원본29 `aa0938ecbe96ec5fdb15eb4783e865bf7ab70c7b`, 후보30 `e5a5bf40d544cad62b4644ab13cc2958671b0869`. 원본에는 후보의 검사/fixture 두 파일만 overlay했고 제품은 불변입니다. 양쪽 모두 정확한 원검사 네 장면을 한 번 실행했습니다. 단언·준비·키/휠·제품 수정 및 결과 유도는 없습니다.

| 제품 | 1280 scroll0 | 1280 scroll1200 | 1440 scroll0 | 1440 scroll1200 | child / 외부 collector |
|---|---|---|---|---|---|
| 원본29 | PASS | FAIL | PASS | FAIL | 1 / 1 |
| 후보30 | PASS | PASS | PASS | PASS | 0 / 0 |

깊은 scroll 출발은 실제 native wheel 후 windowY=1200, saving=null입니다. 원본의 첫 동기 관측에서 지도 top=224.890625, 높이=704/884, bottom=928.890625/1108.890625. 후보의 동일 관측은 top=224.890625, 높이=479.109375/659.109375, bottom=704/884로 화면 끝에서 16px 안쪽입니다. scroll0에서는 두 제품 모두 후보와 같은 값입니다. 원본 깊은 장면의 잘못된 높이는 후속 두 프레임에도 그대로 남았습니다.

‘첫 관측’은 원검사가 설치한 trusted nav-space click의 bubble listener에서 제품 target handler 직후 같은 이벤트 task에 채집한 값입니다. 후속 requestAnimationFrame 두 값은 별도 raw이며 최초 실패를 대체하지 않습니다. 원본 실패 때문에 해당 장면의 후속 프레임은 수집되지만 후속 geometry 단언과 최종 저장상태 동등 단언에는 도달하지 않습니다. 후보 네 장면은 후속 프레임 및 저장자료/카메라/접힘/선택 보존 단언까지 완주했습니다. 이 검사는 모든 카드의 가독성이나 모든 상태 순열을 증명하지 않습니다.

검사 SHA256 `43798ea3a9503690155cc461f0a2c2447f54fb2b635153460fc6696e0b8fcc4d`, fixture `c50eb43a7747e824a23ff8de87588e608dc5430046528d13878d15eb65239aaa`. 후보 app `e52eb74e531302905d6e2c86e6be164425ea13d354f8db98007dfc45516748e8`. SOURCE_BINDING.before/after는 추출 원격 Git 객체·원본 파일·종료 후 파일 및 compiled runtime 해시를 연결합니다. 원본197/후보197 추출파일 전후 변경 0. fixture는 기존 정상 UI 백업의 합성자료이며 import가 이미 생성한 camera를 검증합니다. missing-camera 검사가 아닙니다.

Node22.16.0 / TypeScript5.8.3 / Playwright1.57.0 / 실제 Chromium154.0.8037.57. 양쪽 typecheck/root build/continuity build는 각각 exit0. 각 제품의 실제 loopback HTTP 응답 12개(index/CSS/app.js)가 HTTP200이며 body와 실행 dist 파일 bytes/SHA가 모두 일치했습니다. URL/UTC/버전은 raw에 있습니다. pageerror/capture-error 0, 원서버는 원래 cleanup terminate로 각각 -15 종료했습니다. 첫 실패 traceback·stdout/stderr·8개 원 PNG를 보존했습니다. PNG는 원 tearDown 최종 장면이며 첫 이벤트 동기 프레임이라고 부르지 않습니다.

runner는 응답/console/pageerror의 읽기 전용 수집과 원 teardown 이후 server returncode 기록만 추가했습니다. 원 test/fixture는 바이트 불변입니다. 응답 listener는 실행 계측 경계이며 무계측 실행이라고 주장하지 않습니다. 외부 collector 실제 종료는 tool 완료 metadata 전사 OUTER_EXIT_RECEIPT와 child returncode를 구분했습니다(전체 tool 원문 아님).

재현: 기존 환경 PATH에 tools/node_modules/.bin, BROWSER_EXECUTABLE=/usr/bin/chromium. prepare.py→build.py→collector.py base29→collector.py candidate30. collector는 원실패를 exit1로 전파합니다. 실행코드의 절대 scratch 경로는 현 Cloud 기준입니다. raw gzip은 RAW_INDEX의 압축 전 SHA와 재해제 바이트 동등을 확인했습니다. MANIFEST는 자신을 제외한 정확 payload 집합의 path/bytes/SHA256입니다. 전체 소스·빌드·node_modules는 공유하지 않습니다.

31/29 전체회귀, CI조회, 새 설치, paid AI, 사람 사용성 및 제품 채택 판정은 이번 범위 밖입니다. 이전31 증거는 변경하지 않았습니다.
